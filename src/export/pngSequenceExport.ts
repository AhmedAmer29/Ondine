import { writeFile, mkdir, exists, remove } from '@tauri-apps/plugin-fs';
import type { CameraState, CustomizationSettings, ExportProgress, ExportSettings, ParsedSong } from '@/types';
import type { ExportCancellationToken } from './ExportEngine';
import { OfflineRenderer } from './OfflineRenderer';

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface PngSequenceExportOptions {
  readonly song: ParsedSong;
  readonly customization: CustomizationSettings;
  readonly camera: CameraState;
  readonly settings: ExportSettings;
  readonly outputDir: string;
  readonly onProgress: (progress: ExportProgress) => void;
  readonly token: ExportCancellationToken;
}

/** Renders every frame in [startTime, endTime) deterministically and writes it as a numbered PNG into `outputDir`. */
export async function exportPngSequence(options: PngSequenceExportOptions): Promise<void> {
  const { song, customization, camera, settings, outputDir, onProgress, token } = options;

  if (!(await exists(outputDir))) await mkdir(outputDir, { recursive: true });

  const totalFrames = Math.max(1, Math.round((settings.endTime - settings.startTime) * settings.fps));
  const renderer = await OfflineRenderer.create(
    song,
    customization,
    camera,
    settings.resolution.width,
    settings.resolution.height,
    settings.transparentBackground,
  );

  try {
    onProgress({ phase: 'rendering-frames', currentFrame: 0, totalFrames, message: 'Rendering frames…' });

    for (let frame = 0; frame < totalFrames; frame++) {
      if (token.isCancelled) {
        onProgress({ phase: 'cancelled', currentFrame: frame, totalFrames, message: 'Cancelled — deleting partial frames…' });
        // This folder was freshly created just for this export (auto-numbered, never pre-existing
        // user content), so it's always safe to wipe it wholesale rather than leaving a folder of
        // half a frame sequence behind.
        await remove(outputDir, { recursive: true }).catch(() => {});
        return;
      }
      if (token.isPaused) {
        onProgress({ phase: 'rendering-frames', currentFrame: frame, totalFrames, message: 'Paused.' });
        await token.waitWhilePaused();
        if (token.isCancelled) continue; // loop back around to the cancel branch above
      }

      const time = settings.startTime + frame / settings.fps;
      const dataUrl = await renderer.renderFrameToPng(time);
      const bytes = dataUrlToBytes(dataUrl);
      const filename = `frame_${String(frame + 1).padStart(6, '0')}.png`;
      await writeFile(`${outputDir}/${filename}`, bytes);

      if (frame % 5 === 0 || frame === totalFrames - 1) {
        onProgress({ phase: 'rendering-frames', currentFrame: frame + 1, totalFrames, message: `Frame ${frame + 1} / ${totalFrames}` });
      }
    }

    onProgress({ phase: 'done', currentFrame: totalFrames, totalFrames, message: `Saved ${totalFrames} frames to ${outputDir}` });
  } finally {
    renderer.destroy();
  }
}
