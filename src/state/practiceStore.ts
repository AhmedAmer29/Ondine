import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PRACTICE_SETTINGS, EMPTY_PRACTICE_STATS, type PracticeSettings, type PracticeStats } from '@/types';
import { getPracticeEngine } from '@/practice/PracticeEngine';
import { getMidiInputManager } from '@/practice/midiInput';

interface PracticeStoreState {
  settings: PracticeSettings;
  stats: PracticeStats;
  midiConnected: boolean;
  midiSupported: boolean;
  connectedInputNames: string[];
  lastMistakeMidi: number | null;

  update: <K extends keyof PracticeSettings>(key: K, value: PracticeSettings[K]) => void;
  connectMidi: () => Promise<void>;
  toggleEnabled: () => Promise<void>;
  refreshStats: () => void;
  flashMistake: (midi: number) => void;
}

export const usePracticeStore = create<PracticeStoreState>()(
  persist(
    (set, get) => {
      // Runs once, at store creation: keeps connectedInputNames live across hot-plug/unplug
      // instead of the old snapshot-once-on-connect behavior, which went stale the moment a
      // keyboard was unplugged mid-session.
      getMidiInputManager().onDeviceChange(() => {
        set({ connectedInputNames: getMidiInputManager().connectedInputNames });
      });

      return {
        settings: DEFAULT_PRACTICE_SETTINGS,
        stats: EMPTY_PRACTICE_STATS,
        midiConnected: false,
        midiSupported: getPracticeEngine().isMidiSupported,
        connectedInputNames: [],
        lastMistakeMidi: null,

        update: (key, value) => {
          const next = { ...get().settings, [key]: value };
          getPracticeEngine().setSettings(next);
          set({ settings: next });
        },

        connectMidi: async () => {
          if (get().midiConnected) return;
          const engine = getPracticeEngine();
          const connected = await engine.connectMidiInput();
          set({ midiConnected: connected, connectedInputNames: engine.connectedInputNames });
        },

        toggleEnabled: async () => {
          const engine = getPracticeEngine();
          const nextEnabled = !get().settings.enabled;

          if (nextEnabled && !get().midiConnected) {
            await get().connectMidi();
          }

          const next = { ...get().settings, enabled: nextEnabled };
          engine.setSettings(next);
          engine.resetProgress();
          set({ settings: next, stats: engine.getStats() });
        },

        refreshStats: () => set({ stats: { ...getPracticeEngine().getStats() } }),

        flashMistake: (midi) => set({ lastMistakeMidi: midi }),
      };
    },
    {
      name: 'pianoflow-practice-settings',
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
