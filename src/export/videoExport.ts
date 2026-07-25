import * as Tone from 'tone';
import type { CameraState, CustomizationSettings, ExportProgress, ExportSettings, ParsedSong } from '@/types';
import { PianoFlowRenderer } from '@/renderer';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';
import { saveBinaryFile } from '@/utils/saveFile';
import type { ExportCancellationToken } from './ExportEngine';

export interface VideoExportOptions {
  readonly song: ParsedSong;
  readonly customization: CustomizationSettings;
  readonly camera: CameraState;
  readonly settings: ExportSettings;
  readonly outputPath: string;
  readonly onProgress: (progress: ExportProgress) => void;
  readonly token: ExportCancellationToken;
}

const CANDIDATE_MIME_TYPES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function getSupportedMimeTypes(): string[] {
  return CANDIDATE_MIME_TYPES.filter((candidate) => MediaRecorder.isTypeSupported(candidate));
}

interface RecorderWithMimeType {
  recorder: MediaRecorder;
  mimeType: string;
}

function createMediaRecorder(stream: MediaStream, bitrate: number): RecorderWithMimeType {
  const supportedTypes = getSupportedMimeTypes();
  const triedTypes: string[] = [];

  for (const mimeType of supportedTypes) {
    triedTypes.push(`${mimeType} (+bitrate)`);
    try {
      return {
        recorder: new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: bitrate,
        }),
        mimeType,
      };
    } catch {
      // fall through to try again without explicit bitrate
    }

    triedTypes.push(`${mimeType} (-bitrate)`);
    try {
      return {
        recorder: new MediaRecorder(stream, {
          mimeType,
        }),
        mimeType,
      };
    } catch {
      // try next mime type
    }
  }

  throw new Error(
    `Unable to create a MediaRecorder for this export configuration. ` +
      `Try lowering resolution, frame rate, or bitrate. Supported mime types: ${supportedTypes.join(', ') || 'none'}. ` +
      `Tried: ${triedTypes.join(', ')}.`,
  );
}

/**
 * Records the song as an actual video, in real time: mounts a hidden
 * full-resolution renderer, captures its canvas via `captureStream`, taps the
 * shared audio engine into the same MediaStream, and encodes with
 * `MediaRecorder`. Unlike the PNG/GIF exporters this cannot run faster than
 * real playback speed — muxed audio+video requires it. Codec is whatever the
 * browser actually supports (checked live, never assumed).
 */
export async function exportVideo(options: VideoExportOptions): Promise<void> {
  const { song, customization, camera, settings, outputPath, onProgress, token } = options;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0px';
  container.style.width = `${settings.resolution.width}px`;
  container.style.height = `${settings.resolution.height}px`;
  document.body.appendChild(container);

  const renderer = new PianoFlowRenderer(customization, camera);
  const engine = getPlaybackEngine();
  // Tone's context is always a live AudioContext during playback (never OfflineAudioContext), which is
  // the only AnyAudioContext variant that lacks createMediaStreamDestination.
  const streamDestination = (Tone.getContext().rawContext as AudioContext).createMediaStreamDestination();

  let recorder: MediaRecorder | null = null;
  let settled = false;

  try {
    await renderer.mount(container, 1, { width: settings.resolution.width, height: settings.resolution.height });
    renderer.setSong(song);
    renderer.setCameraState(camera);
    renderer.setTimeProvider(() => engine.getCurrentTime());

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Export renderer failed to create a canvas.');

    const videoStream = canvas.captureStream(settings.fps);
    engine.connectToMediaStreamDestination(streamDestination);
    const combinedStream = new MediaStream([...videoStream.getVideoTracks(), ...streamDestination.stream.getAudioTracks()]);

    const chunks: Blob[] = [];
    const recorderWithMime = createMediaRecorder(combinedStream, settings.bitrateMbps * 1_000_000);
    recorder = recorderWithMime.recorder;
    const mimeType = recorderWithMime.mimeType;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<void>((resolve, reject) => {
      if (!recorder) return reject(new Error('Recorder not initialized'));
      recorder.onstop = () => resolve();
      recorder.onerror = (event) => {
        const error = (event as unknown as { error?: unknown }).error;
        const details = String(error ?? 'unknown error');
        reject(
          new Error(
            `MediaRecorder error: ${details}. ` +
              `This may mean the requested export settings (${settings.resolution.width}×${settings.resolution.height} @ ${settings.fps}fps, ${settings.bitrateMbps} Mbps) ` +
              `are unsupported by your browser/encoder. Try lowering resolution, frame rate, or bitrate.`,
          ),
        );
      };
    });

    // Video capture is real-time, so "pause" here means actually pausing the recorder and the
    // song underneath it (not just skipping progress updates) — otherwise the song would keep
    // advancing, and playing, while the recorder sits idle, permanently desyncing the output.
    const unsubscribePause = token.onPauseChange(() => {
      if (token.isCancelled) return; // let the poll loop's own cancellation handling take it from here
      if (token.isPaused) {
        if (recorder && recorder.state === 'recording') recorder.pause();
        engine.pause();
      } else {
        if (recorder && recorder.state === 'paused') recorder.resume();
        void engine.play();
      }
    });

    try {
      engine.seek(settings.startTime);
      await engine.ensureAudioStarted();
      recorder.start(250);
      await engine.play();

      const durationSeconds = settings.endTime - settings.startTime;
      onProgress({ phase: 'rendering-frames', currentFrame: 0, totalFrames: Math.round(durationSeconds * settings.fps), message: 'Recording…' });

      await new Promise<void>((resolve) => {
        const poll = (): void => {
          const elapsed = engine.getCurrentTime() - settings.startTime;
          const totalFrames = Math.round(durationSeconds * settings.fps);
          const currentFrame = Math.min(totalFrames, Math.round(elapsed * settings.fps));
          const message = token.isPaused ? 'Paused.' : token.isFinishRequested ? 'Finishing export…' : `Recording ${elapsed.toFixed(1)}s / ${durationSeconds.toFixed(1)}s`;
          onProgress({ phase: 'rendering-frames', currentFrame, totalFrames, message });

          // A deliberate pause also stops `engine.isPlaying()` from being true — don't mistake
          // that for "recording finished" the way an unrequested stop would be.
          if (
            token.isCancelled ||
            token.isFinishRequested ||
            engine.getCurrentTime() >= settings.endTime ||
            (!engine.isPlaying() && !token.isPaused)
          ) {
            resolve();
            return;
          }
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      });
    } finally {
      unsubscribePause();
    }

    if (recorder.state === 'paused') recorder.resume();
    engine.pause();
    recorder.stop();
    await finished;
    settled = true;

    if (token.isCancelled) {
      onProgress({ phase: 'cancelled', currentFrame: 0, totalFrames: 0, message: 'Cancelled.' });
      return;
    }

    onProgress({ phase: 'encoding', currentFrame: 0, totalFrames: 0, message: 'Saving file…' });
    const blob = new Blob(chunks, { type: mimeType });
    try {
      await saveBinaryFile(outputPath, blob, mimeType);
    } catch (error) {
      throw new Error(`Failed to save the recording (${blob.size} bytes): ${error instanceof Error ? error.message : String(error)}`);
    }

    onProgress({ phase: 'done', currentFrame: 0, totalFrames: 0, message: `Saved to ${outputPath} (${mimeType.split(';')[0]})` });
  } finally {
    if (recorder && recorder.state !== 'inactive' && !settled) {
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
    }
    engine.disconnectFromMediaStreamDestination(streamDestination);
    renderer.destroy();
    container.remove();
  }
}
