import { ArrowLeft, Minus, Square, Upload, X } from 'lucide-react';
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from '@/utils/windowControls';
import { useUiStore, type AppMode } from '@/state/uiStore';
import { useSongStore } from '@/state/songStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { usePracticeStore } from '@/state/practiceStore';
import { pickMidiFile } from '@/utils/fileDialog';
import { countdownController } from '@/practice/countdown';
import { ModeTabs } from './ModeTabs';
import { ThemePresetDropdown } from './ThemePresetDropdown';
import { MidiStatusIndicator } from './MidiStatusIndicator';

function subtitleFor(mode: AppMode, songName: string | null): string {
  if (mode === 'live') return 'Free play — click a key or plug in a MIDI keyboard';
  if (mode === 'learn') return 'Skill tracks, guided practice sessions';
  return songName ?? 'No song loaded';
}

/** Custom frameless title bar — the window has native decorations disabled, so this owns dragging, the window controls, and now the app's mode navigation. */
export function TitleBar(): React.ReactElement {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const song = useSongStore((s) => s.song);
  const loadFromPath = useSongStore((s) => s.loadFromPath);
  const loadFromFile = useSongStore((s) => s.loadFromFile);

  const handleOpenMidi = async (): Promise<void> => {
    const { path, file } = await pickMidiFile();
    if (path) await loadFromPath(path);
    else if (file) await loadFromFile(file);
    else return;
    setMode('play');
  };

  // Learn's "session" (a loaded song, practice engaged) is a detour from its menu, not a
  // separate screen — this is how you back out of it, same as the practice apps this exists
  // alongside. Resets playback and practice state rather than leaving them running underneath.
  const handleBackToLearnMenu = (): void => {
    countdownController.cancel();
    usePlaybackStore.getState().restart();
    const practice = usePracticeStore.getState();
    if (practice.settings.enabled) void practice.toggleEnabled();
    useSongStore.getState().closeSong();
  };

  return (
    <div
      data-tauri-drag-region
      className="glass-bar flex h-11 shrink-0 items-center gap-3 pr-1.5 pl-3 text-[11px] font-medium text-white/45 select-none"
    >
      <div data-tauri-drag-region className="flex shrink-0 items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-5 w-5" draggable={false} />
        <span className="text-xs font-semibold text-white/80">Ondine</span>
      </div>

      <ModeTabs />

      {mode === 'learn' && song && (
        <button
          type="button"
          onClick={handleBackToLearnMenu}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-orange-300 transition-colors hover:bg-orange-500/25 hover:text-orange-200"
        >
          <ArrowLeft size={13} />
          <span>Menu</span>
        </button>
      )}

      <span data-tauri-drag-region className="flex-1 truncate text-white/40">
        {subtitleFor(mode, song?.name ?? null)}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void handleOpenMidi()}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/8 hover:text-white/90"
        >
          <Upload size={13} />
          <span>Open MIDI</span>
        </button>
        <ThemePresetDropdown />
        <MidiStatusIndicator />
      </div>

      <div className="ml-1 flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => void minimizeWindow()}
          className="flex h-7 w-9 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/8 hover:text-white"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          aria-label="Maximize"
          onClick={() => void toggleMaximizeWindow()}
          className="flex h-7 w-9 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/8 hover:text-white"
        >
          <Square size={11} />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => void closeWindow()}
          className="flex h-7 w-9 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-red-500 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
