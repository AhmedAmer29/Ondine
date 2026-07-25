import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bookmark } from '@/types';

interface BookmarkStoreState {
  /** Bookmarks per song, keyed by ParsedSong.id, since positions are only meaningful within one song. */
  bookmarksBySong: Record<string, Bookmark[]>;

  getBookmarks: (songId: string) => Bookmark[];
  addBookmark: (songId: string, time: number, label: string) => void;
  removeBookmark: (songId: string, bookmarkId: string) => void;
}

const BOOKMARK_COLORS = ['#facc15', '#60a5fa', '#f472b6', '#4ade80'];

// A stable reference for "no bookmarks yet" — returning a fresh `[]` literal from a selector
// every call breaks zustand's referential-equality check and causes infinite re-renders.
const EMPTY_BOOKMARKS: Bookmark[] = [];

export const useBookmarkStore = create<BookmarkStoreState>()(
  persist(
    (set, get) => ({
      bookmarksBySong: {},

      getBookmarks: (songId) => get().bookmarksBySong[songId] ?? EMPTY_BOOKMARKS,

      addBookmark: (songId, time, label) => {
        const existing = get().bookmarksBySong[songId] ?? [];
        const bookmark: Bookmark = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          time,
          label,
          color: BOOKMARK_COLORS[existing.length % BOOKMARK_COLORS.length] as string,
        };
        set((state) => ({
          bookmarksBySong: { ...state.bookmarksBySong, [songId]: [...existing, bookmark].sort((a, b) => a.time - b.time) },
        }));
      },

      removeBookmark: (songId, bookmarkId) => {
        const existing = get().bookmarksBySong[songId] ?? [];
        set((state) => ({
          bookmarksBySong: { ...state.bookmarksBySong, [songId]: existing.filter((b) => b.id !== bookmarkId) },
        }));
      },
    }),
    { name: 'pianoflow-bookmarks' },
  ),
);
