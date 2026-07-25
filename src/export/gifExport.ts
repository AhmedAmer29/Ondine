import GIF from 'gif.js';
import type { CameraState, CustomizationSettings, ExportProgress, ExportSettings, ParsedSong } from '@/types';
import { saveBinaryFile } from '@/utils/saveFile';
import type { ExportCancellationToken } from './ExportEngine';
import { OfflineRenderer } from './OfflineRenderer';

export interface GifExportOptions {
  readonly song: ParsedSong;
  readonly customization: CustomizationSettings;
  readonly camera: CameraState;
  readonly settings: ExportSettings;
  readonly outputPath: string;
  readonly onProgress: (progress: ExportProgress) => void;
  readonly token: ExportCancellationToken;
}

/** Renders every frame deterministically, then encodes them into a single animated GIF via gif.js. */
export async function exportGif(options: GifExportOptions): Promise<void> {
  const { song, customization, camera, settings, outputPath, onProgress, token } = options;

  const totalFrames = Math.max(1, Math.round((settings.endTime - settings.startTime) * settings.fps));
  // GIF has no real alpha channel (only a single "key color" transparent index), so unlike the
  // PNG-sequence exporter, transparent background isn't offered here — frames always render opaque.
  const renderer = await OfflineRenderer.create(song, customization, camera, settings.resolution.width, settings.resolution.height, false);

  const gif = new GIF({
    workers: 4,
    quality: 10,
    workerScript: '/gif.worker.js',
    width: settings.resolution.width,
    height: settings.resolution.height,
    background: '#05060a',
  });

  try {
    onProgress({ phase: 'rendering-frames', currentFrame: 0, totalFrames, message: 'Rendering frames…' });

    const frameDelayMs = 1000 / settings.fps;
    for (let frame = 0; frame < totalFrames; frame++) {
      if (token.isCancelled) {
        onProgress({ phase: 'cancelled', currentFrame: frame, totalFrames, message: 'Cancelled.' });
        return;
      }
      if (token.isPaused) {
        onProgress({ phase: 'rendering-frames', currentFrame: frame, totalFrames, message: 'Paused.' });
        await token.waitWhilePaused();
        if (token.isCancelled) {
          onProgress({ phase: 'cancelled', currentFrame: frame, totalFrames, message: 'Cancelled.' });
          return;
        }
      }
      const time = settings.startTime + frame / settings.fps;
      const canvas = renderer.renderFrameToCanvas(time);
      gif.addFrame(canvas, { delay: frameDelayMs, copy: true });

      if (frame % 5 === 0 || frame === totalFrames - 1) {
        onProgress({ phase: 'rendering-frames', currentFrame: frame + 1, totalFrames, message: `Frame ${frame + 1} / ${totalFrames}` });
        // Rendering + `copy: true`'s frame clone is synchronous and adds up over hundreds of
        // frames — yielding every few frames keeps the tab responsive (repaints, the Cancel
        // button, the "did the app hang?" feeling) instead of blocking the main thread solid
        // for the entire render pass.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    if (token.isCancelled) {
      onProgress({ phase: 'cancelled', currentFrame: totalFrames, totalFrames, message: 'Cancelled.' });
      return;
    }

    onProgress({ phase: 'encoding', currentFrame: totalFrames, totalFrames, message: 'Encoding GIF…' });

    const blob = await new Promise<Blob>((resolve, reject) => {
      gif.on('finished', (result) => resolve(result));
      gif.on('progress', (percent) => {
        onProgress({ phase: 'encoding', currentFrame: totalFrames, totalFrames, message: `Encoding GIF… ${Math.round(percent * 100)}%` });
      });
      try {
        gif.render();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    try {
      await saveBinaryFile(outputPath, blob, 'image/gif');
    } catch (error) {
      throw new Error(`Failed to save the GIF (${blob.size} bytes): ${error instanceof Error ? error.message : String(error)}`);
    }

    onProgress({ phase: 'done', currentFrame: totalFrames, totalFrames, message: `Saved to ${outputPath}` });
  } finally {
    renderer.destroy();
  }
}
