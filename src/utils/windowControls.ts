/** True when running inside the Tauri shell, false during plain browser dev/preview. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function getWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export async function toggleWindowFullscreen(): Promise<boolean> {
  if (!isTauriRuntime()) {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    return Boolean(document.fullscreenElement);
  }
  const win = await getWindow();
  const isFullscreen = await win.isFullscreen();
  await win.setFullscreen(!isFullscreen);
  return !isFullscreen;
}

export async function isWindowFullscreen(): Promise<boolean> {
  if (!isTauriRuntime()) return Boolean(document.fullscreenElement);
  const win = await getWindow();
  return win.isFullscreen();
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const win = await getWindow();
  await win.minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const win = await getWindow();
  await win.toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const win = await getWindow();
  await win.close();
}

export async function setWindowClosable(isClosable: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  const win = await getWindow();
  await win.setClosable(isClosable);
}

export async function startWindowDrag(): Promise<void> {
  if (!isTauriRuntime()) return;
  const win = await getWindow();
  await win.startDragging();
}
