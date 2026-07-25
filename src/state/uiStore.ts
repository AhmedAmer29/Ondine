import { create } from 'zustand';

export type AppMode = 'play' | 'live' | 'learn';

interface UiState {
  mode: AppMode;
  isFullscreen: boolean;
  controlsVisible: boolean;
  transportCollapsed: boolean;
  customizationPanelOpen: boolean;
  debugOverlayVisible: boolean;
  practicePanelOpen: boolean;
  exportPanelOpen: boolean;
  queuePanelOpen: boolean;
  librarySearchQuery: string;

  setMode: (mode: AppMode) => void;
  setFullscreen: (value: boolean) => void;
  setControlsVisible: (value: boolean) => void;
  toggleTransportCollapsed: () => void;
  toggleCustomizationPanel: () => void;
  setCustomizationPanelOpen: (value: boolean) => void;
  toggleDebugOverlay: () => void;
  togglePracticePanel: () => void;
  toggleExportPanel: () => void;
  toggleQueuePanel: () => void;
  setLibrarySearchQuery: (query: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  mode: 'play',
  isFullscreen: false,
  controlsVisible: true,
  transportCollapsed: false,
  customizationPanelOpen: false,
  debugOverlayVisible: false,
  practicePanelOpen: false,
  exportPanelOpen: false,
  queuePanelOpen: false,
  librarySearchQuery: '',

  setMode: (mode) => set({ mode }),
  setFullscreen: (value) => set({ isFullscreen: value }),
  setControlsVisible: (value) => set({ controlsVisible: value }),
  toggleTransportCollapsed: () => set((s) => ({ transportCollapsed: !s.transportCollapsed })),
  toggleCustomizationPanel: () => set((s) => ({ customizationPanelOpen: !s.customizationPanelOpen, exportPanelOpen: false })),
  setCustomizationPanelOpen: (value) => set({ customizationPanelOpen: value }),
  toggleDebugOverlay: () => set((s) => ({ debugOverlayVisible: !s.debugOverlayVisible })),
  togglePracticePanel: () => set((s) => ({ practicePanelOpen: !s.practicePanelOpen })),
  toggleExportPanel: () => set((s) => ({ exportPanelOpen: !s.exportPanelOpen, customizationPanelOpen: false })),
  toggleQueuePanel: () => set((s) => ({ queuePanelOpen: !s.queuePanelOpen })),
  setLibrarySearchQuery: (query) => set({ librarySearchQuery: query }),
}));
