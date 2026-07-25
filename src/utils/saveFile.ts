import { isTauriRuntime } from './windowControls';

/**
 * Writes data to disk. In the desktop app, `pathOrName` must already be a real path chosen via
 * a Tauri save dialog. In a plain browser build there's no dialog at all — `pathOrName` is just
 * the filename the browser's download uses, saved wherever the user's browser puts downloads.
 *
 * Accepts a `Blob` in addition to a raw `Uint8Array` — pass whichever a caller already has rather
 * than making it materialize one first. This matters for large video/GIF exports specifically:
 * `writeFile` accepts a `ReadableStream<Uint8Array>`, and `Blob.stream()` gives it that directly,
 * so a multi-hundred-MB recording streams straight to disk instead of first getting copied into
 * one contiguous in-memory buffer (`await blob.arrayBuffer()`) and copied *again* into the IPC
 * call — the double-copy that was the actual crash risk on large exports.
 */
export async function saveBinaryFile(pathOrName: string, data: Uint8Array | Blob, mimeType = 'application/octet-stream'): Promise<void> {
  if (isTauriRuntime()) {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(pathOrName, data instanceof Blob ? data.stream() : data);
    return;
  }

  const blob = data instanceof Blob ? data : new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = pathOrName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Resolves where a file should be written: a real Tauri save-dialog path on desktop, or just the default filename on web (there's nothing to prompt — the browser handles the download location). Returns null if the user cancelled the desktop dialog. */
export async function resolveSavePath(defaultName: string, dialogTitle: string, filterName: string, extensions: string[]): Promise<string | null> {
  if (!isTauriRuntime()) return defaultName;
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ title: dialogTitle, defaultPath: defaultName, filters: [{ name: filterName, extensions }] });
}

/** Strips characters that are invalid (or awkward) in a filename on any OS, collapses whitespace, and falls back to a generic name if nothing usable is left. */
export function sanitizeExportName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'export';
}

/**
 * Resolves an auto-numbered, collision-free path under `{appDataDir}/exports/{subfolder}/` for
 * the render pipeline's video/GIF/PNG-sequence exports — desktop only, since there's no
 * equivalent "app data directory" to write into from a plain browser tab (those exports stay
 * download-only on web, same as MIDI/PDF export). `extension` (with its leading dot, e.g. '.gif')
 * targets a file; pass `null` for a directory target (the PNG-sequence exporter's output folder).
 * Collisions get " (2)", " (3)", etc. appended, mirroring how Windows/macOS handle duplicate
 * filenames in Explorer/Finder.
 */
export async function resolveAutoExportPath(subfolder: string, exportName: string, extension: string | null): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs');

  const baseDir = await join(await appDataDir(), 'exports', subfolder);
  if (!(await exists(baseDir))) await mkdir(baseDir, { recursive: true });

  const baseName = sanitizeExportName(exportName);
  let suffix = 0;
  for (;;) {
    const candidateName = suffix === 0 ? baseName : `${baseName} (${suffix + 1})`;
    const candidatePath = await join(baseDir, extension ? `${candidateName}${extension}` : candidateName);
    if (!(await exists(candidatePath))) return candidatePath;
    suffix += 1;
  }
}

/** The resolved `{appDataDir}/exports` path, for display — doesn't create anything or touch the filesystem. Resolves to null on web (there's no app data directory to show). */
export async function getExportsRootPath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return join(await appDataDir(), 'exports');
}

/** Opens the app's exports root folder (`{appDataDir}/exports`) in the OS file explorer, creating it first if nothing's been exported yet. Desktop-only — no-op on web. */
export async function openExportsRootFolder(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
  const { openPath } = await import('@tauri-apps/plugin-opener');

  const dir = await getExportsRootPath();
  if (!dir) return;
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  await openPath(dir);
}

/** Opens a specific exported file/folder in the OS file explorer — a directory opens directly, a file gets revealed/selected within its parent folder. Desktop-only — no-op on web. */
export async function revealExport(outputPath: string, isDirectory: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  if (isDirectory) {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(outputPath);
  } else {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    await revealItemInDir(outputPath);
  }
}
