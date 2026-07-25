import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HandHint, ParsedSong, RecentFileEntry } from '@/types';
import { SongQuery } from '@/midi/songQuery';
import { loadMidiFromFile, loadMidiFromPath, isMidiFileName } from '@/midi/loadMidiFile';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';
import { usePlaybackStore } from './playbackStore';

const MAX_RECENT_FILES = 20;

interface SongState {
  song: ParsedSong | null;
  query: SongQuery | null;
  isLoading: boolean;
  loadError: string | null;
  recentFiles: RecentFileEntry[];

  loadFromFile: (file: File) => Promise<void>;
  loadFromPath: (path: string) => Promise<void>;
  loadFromParsedSong: (song: ParsedSong) => void;
  setTrackMuted: (trackIndex: number, muted: boolean) => void;
  setTrackColor: (trackIndex: number, color: string) => void;
  setTrackHandHint: (trackIndex: number, hand: HandHint) => void;
  toggleFavorite: (path: string) => void;
  clearRecentFiles: () => void;
  closeSong: () => void;
}

function applyParsedSong(song: ParsedSong): void {
  const engine = getPlaybackEngine();
  engine.loadSong(song);
  usePlaybackStore.getState().resetForNewSong(song.durationSeconds);
}

export const useSongStore = create<SongState>()(
  persist(
    (set, get) => ({
      song: null,
      query: null,
      isLoading: false,
      loadError: null,
      recentFiles: [],

      loadFromFile: async (file: File) => {
        if (!isMidiFileName(file.name)) {
          set({ loadError: `"${file.name}" is not a MIDI file.` });
          return;
        }
        set({ isLoading: true, loadError: null });
        try {
          const song = await loadMidiFromFile(file);
          applyParsedSong(song);
          set({ song, query: new SongQuery(song), isLoading: false });
        } catch (error) {
          set({ isLoading: false, loadError: error instanceof Error ? error.message : 'Failed to load MIDI file.' });
        }
      },

      loadFromPath: async (path: string) => {
        set({ isLoading: true, loadError: null });
        try {
          const song = await loadMidiFromPath(path);
          applyParsedSong(song);
          set((state) => ({
            song,
            query: new SongQuery(song),
            isLoading: false,
            recentFiles: pushRecentFile(state.recentFiles, {
              path,
              name: song.name,
              lastOpened: Date.now(),
              durationSeconds: song.durationSeconds,
              favorite: state.recentFiles.find((r) => r.path === path)?.favorite ?? false,
            }),
          }));
        } catch (error) {
          set({ isLoading: false, loadError: error instanceof Error ? error.message : 'Failed to load MIDI file.' });
        }
      },

      /** Loads a song that's already fully in memory — e.g. a Live-mode recording — with no file/parsing round trip. Doesn't touch recentFiles since there's no real file path. */
      loadFromParsedSong: (song: ParsedSong) => {
        applyParsedSong(song);
        set({ song, query: new SongQuery(song), isLoading: false, loadError: null });
      },

      setTrackMuted: (trackIndex, muted) => {
        const song = get().song;
        if (!song) return;
        const track = song.tracks[trackIndex];
        if (!track) return;
        track.muted = muted;
        getPlaybackEngine().setTrackMuted(trackIndex, muted);
        set({ song: { ...song } });
      },

      setTrackColor: (trackIndex, color) => {
        const song = get().song;
        if (!song) return;
        const track = song.tracks[trackIndex];
        if (!track) return;
        track.color = color;
        set({ song: { ...song } });
      },

      setTrackHandHint: (trackIndex, hand) => {
        const song = get().song;
        if (!song) return;
        const track = song.tracks[trackIndex];
        if (!track) return;
        track.handHint = hand;
        const resolvedHand = hand === 'both' ? undefined : hand;
        if (resolvedHand) {
          for (const note of track.notes) note.hand = resolvedHand;
        }
        set({ song: { ...song } });
      },

      toggleFavorite: (path) => {
        set((state) => ({
          recentFiles: state.recentFiles.map((entry) =>
            entry.path === path ? { ...entry, favorite: !entry.favorite } : entry,
          ),
        }));
      },

      clearRecentFiles: () => set({ recentFiles: [] }),

      closeSong: () => set({ song: null, query: null }),
    }),
    {
      name: 'pianoflow-recent-files',
      partialize: (state) => ({ recentFiles: state.recentFiles }),
    },
  ),
);

function pushRecentFile(existing: RecentFileEntry[], entry: RecentFileEntry): RecentFileEntry[] {
  const filtered = existing.filter((e) => e.path !== entry.path);
  return [entry, ...filtered].slice(0, MAX_RECENT_FILES);
}
