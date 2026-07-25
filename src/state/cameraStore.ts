import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CameraState } from '@/types';

interface CameraStoreState extends CameraState {
  setHighwayZoom: (zoom: number) => void;
}

export const useCameraStore = create<CameraStoreState>()(
  persist(
    (set) => ({
      highwayZoom: 1,
      setHighwayZoom: (zoom) => set({ highwayZoom: Math.min(2, Math.max(0.4, zoom)) }),
    }),
    { name: 'pianoflow-camera' },
  ),
);
