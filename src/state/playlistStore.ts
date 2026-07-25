import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueueItem {
  readonly path: string;
  readonly name: string;
}

interface PlaylistState {
  queue: QueueItem[];
  currentIndex: number;
  autoAdvance: boolean;

  addToQueue: (item: QueueItem) => void;
  removeFromQueue: (path: string) => void;
  clearQueue: () => void;
  setAutoAdvance: (value: boolean) => void;
  /** Returns the item to load next, or null if the queue is exhausted. Advances currentIndex. */
  peekNext: () => QueueItem | null;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      autoAdvance: true,

      addToQueue: (item) => {
        if (get().queue.some((q) => q.path === item.path)) return;
        set((state) => ({ queue: [...state.queue, item] }));
      },

      removeFromQueue: (path) => {
        set((state) => {
          const index = state.queue.findIndex((q) => q.path === path);
          if (index === -1) return state;
          const queue = state.queue.filter((q) => q.path !== path);
          const currentIndex = index < state.currentIndex ? state.currentIndex - 1 : state.currentIndex;
          return { queue, currentIndex };
        });
      },

      clearQueue: () => set({ queue: [], currentIndex: -1 }),

      setAutoAdvance: (value) => set({ autoAdvance: value }),

      peekNext: () => {
        const { queue, currentIndex } = get();
        const nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) return null;
        set({ currentIndex: nextIndex });
        return queue[nextIndex] ?? null;
      },
    }),
    { name: 'pianoflow-playlist' },
  ),
);
