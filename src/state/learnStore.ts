import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

interface LearnState {
  streak: number;
  lastActiveDay: string | null;
  /** Call whenever the user actually does something in Learn mode — increments the streak once per calendar day, resets it if a day was skipped. */
  recordActivity: () => void;
}

export const useLearnStore = create<LearnState>()(
  persist(
    (set, get) => ({
      streak: 0,
      lastActiveDay: null,

      recordActivity: () => {
        const today = todayKey();
        const { lastActiveDay, streak } = get();
        if (lastActiveDay === today) return;

        const gap = lastActiveDay ? daysBetween(lastActiveDay, today) : null;
        const nextStreak = gap === 1 ? streak + 1 : 1;
        set({ streak: nextStreak, lastActiveDay: today });
      },
    }),
    { name: 'pianoflow-learn-progress' },
  ),
);
