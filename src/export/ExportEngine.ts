import type { CameraState, CustomizationSettings, ExportProgress, ExportSettings, ParsedSong } from '@/types';
import { isTauriRuntime } from '@/utils/windowControls';
import { resolveAutoExportPath, sanitizeExportName } from '@/utils/saveFile';
import { exportPngSequence } from './pngSequenceExport';
import { exportGif } from './gifExport';
import { exportVideo } from './videoExport';

export interface RunExportArgs {
  readonly song: ParsedSong;
  readonly customization: CustomizationSettings;
  readonly camera: CameraState;
  readonly settings: ExportSettings;
  readonly onProgress: (progress: ExportProgress) => void;
}

export interface ExportResult {
  /** The final file path (video/GIF) or directory (PNG sequence) that was written to — meaningful even when `cancelled` is true if a PNG-sequence run had already written some frames before being stopped. */
  readonly outputPath: string;
  readonly cancelled: boolean;
}

/**
 * Cancellation + pause/resume control shared between an in-flight export (video/GIF/PNG-sequence)
 * and its ExportPanel controls. A plain mutable-flag class rather than a store slice because the
 * exporters themselves (plain async functions, not React) need to poll and await it mid-render.
 */
export class ExportCancellationToken {
  private cancelled = false;
  private paused = false;
  private finishRequested = false;
  private readonly pauseListeners = new Set<() => void>();

  cancel(): void {
    this.cancelled = true;
    // Release anything blocked in `waitWhilePaused()` so a cancel during a pause doesn't hang forever.
    if (this.paused) {
      this.paused = false;
      this.notifyPauseChange();
    }
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  pause(): void {
    if (this.paused || this.cancelled) return;
    this.paused = true;
    this.notifyPauseChange();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.notifyPauseChange();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isFinishRequested(): boolean {
    return this.finishRequested;
  }

  finish(): void {
    if (this.finishRequested || this.cancelled) return;
    this.finishRequested = true;
    if (this.paused) {
      this.paused = false;
      this.notifyPauseChange();
    }
  }

  onPauseChange(listener: () => void): () => void {
    this.pauseListeners.add(listener);
    return () => this.pauseListeners.delete(listener);
  }

  private notifyPauseChange(): void {
    for (const listener of this.pauseListeners) listener();
  }

  /** Resolves immediately if not paused; otherwise blocks until `resume()` or `cancel()`. Exporters await this between units of work (a rendered frame, an encoded chunk). */
  async waitWhilePaused(): Promise<void> {
    while (this.paused) {
      await new Promise<void>((resolve) => {
        const unsubscribe = this.onPauseChange(() => {
          unsubscribe();
          resolve();
        });
      });
    }
  }
}

/**
 * Top-level export facade: resolves an output location appropriate to the chosen format (a
 * folder for PNG sequences, a file for GIF/video) and dispatches to the matching exporter.
 * Desktop exports go straight to `{appDataDir}/exports/{format}/{name}` — no save dialog, no
 * per-export decision — auto-numbered on a name collision.
 */
export async function runExport(args: RunExportArgs, token: ExportCancellationToken): Promise<ExportResult> {
  const { song, customization, camera, settings, onProgress } = args;
  const exportName = sanitizeExportName(settings.exportName || song.name);

  if (settings.format === 'png-sequence') {
    // A PNG sequence is many individual files written into a folder — there's no meaningful
    // browser-download equivalent for that (no folder picker, no batch download), so this one
    // stays desktop-only rather than faking it.
    if (!isTauriRuntime()) throw new Error('PNG sequence export is only available in the desktop app.');
    const outputDir = await resolveAutoExportPath('png-sequence', exportName, null);
    await exportPngSequence({ song, customization, camera, settings, outputDir, onProgress, token });
    return { outputPath: outputDir, cancelled: token.isCancelled };
  }

  if (settings.format === 'gif') {
    const outputPath = isTauriRuntime() ? await resolveAutoExportPath('gif', exportName, '.gif') : `${exportName}.gif`;
    await exportGif({ song, customization, camera, settings, outputPath, onProgress, token });
    return { outputPath, cancelled: token.isCancelled };
  }

  const outputPath = isTauriRuntime() ? await resolveAutoExportPath('video', exportName, '.mp4') : `${exportName}.mp4`;
  await exportVideo({ song, customization, camera, settings, outputPath, onProgress, token });
  return { outputPath, cancelled: token.isCancelled };
}
