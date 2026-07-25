import { create } from 'zustand';

interface DebugState {
  fps: number;
  frameTimeMs: number;
  visibleNoteCount: number;
  setStats: (stats: { fps: number; frameTimeMs: number; visibleNoteCount: number }) => void;
}

export const useDebugStore = create<DebugState>()((set) => ({
  fps: 0,
  frameTimeMs: 0,
  visibleNoteCount: 0,
  setStats: (stats) => set(stats),
}));
