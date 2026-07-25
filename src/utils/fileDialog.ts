import { isTauriRuntime } from './windowControls';

/** Opens the native "choose a MIDI file" dialog (Tauri) or an `<input type="file">` fallback in the browser. */
export async function pickMidiFile(): Promise<{ path: string | null; file: File | null }> {
  if (isTauriRuntime()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      title: 'Open MIDI File',
      filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }],
    });
    return { path: typeof selected === 'string' ? selected : null, file: null };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi,audio/midi';
    input.onchange = () => {
      resolve({ path: null, file: input.files?.[0] ?? null });
    };
    input.click();
  });
}
