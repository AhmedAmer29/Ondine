import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CUSTOMIZATION, type CustomizationSettings } from '@/types';

interface CustomizationStoreState {
  settings: CustomizationSettings;
  update: <K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => void;
  updateMany: (patch: Partial<CustomizationSettings>) => void;
  resetToDefaults: () => void;
}

export const useCustomizationStore = create<CustomizationStoreState>()(
  persist(
    (set) => ({
      settings: DEFAULT_CUSTOMIZATION,
      update: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
      updateMany: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      resetToDefaults: () => set({ settings: DEFAULT_CUSTOMIZATION }),
    }),
    { name: 'pianoflow-customization' },
  ),
);
