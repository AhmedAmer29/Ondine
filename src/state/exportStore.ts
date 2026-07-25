import { create } from 'zustand';
import { EXPORT_RESOLUTIONS, resolveExportDimensions, type ExportFormat, type ExportSettings } from '@/types';
import { runExport, ExportCancellationToken } from '@/export/ExportEngine';
import { useSongStore } from './songStore';
import { useCustomizationStore } from './customizationStore';
import { useCameraStore } from './cameraStore';
import { setWindowClosable } from '@/utils/windowControls';

interface CompletedExport {
  readonly outputPath: string;
  readonly isDirectory: boolean;
}

interface ExportState {
  settings: ExportSettings;
  isRunning: boolean;
  isPaused: boolean;
  isFinishing: boolean;
  progressMessage: string;
  progressFraction: number;
  errorMessage: string | null;
  /** Set once a run finishes successfully; cleared the moment a new export starts. Drives the ExportPanel's post-export success view. */
  lastCompleted: CompletedExport | null;

  update: <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => void;
  start: () => Promise<void>;
  cancel: () => void;
  finish: () => void;
  pause: () => void;
  resume: () => void;
  dismissCompleted: () => void;
}

let activeToken: ExportCancellationToken | null = null;

export const useExportStore = create<ExportState>()((set, get) => ({
  settings: {
    format: 'png-sequence',
    aspect: 'landscape',
    resolution: EXPORT_RESOLUTIONS[1] as ExportSettings['resolution'],
    fps: 60,
    codec: 'h264',
    bitrateMbps: 20,
    transparentBackground: false,
    startTime: 0,
    endTime: 0,
    exportName: '',
  },
  isRunning: false,
  isPaused: false,
  isFinishing: false,
  progressMessage: '',
  progressFraction: 0,
  errorMessage: null,
  lastCompleted: null,

  update: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),

  start: async () => {
    const song = useSongStore.getState().song;
    if (!song || get().isRunning) return;

    const settings = { ...get().settings };
    if (settings.endTime <= settings.startTime) settings.endTime = song.durationSeconds;
    settings.resolution = { ...settings.resolution, ...resolveExportDimensions(settings.resolution, settings.aspect) };

    activeToken = new ExportCancellationToken();
    set({ isRunning: true, isPaused: false, isFinishing: false, errorMessage: null, progressMessage: 'Starting…', progressFraction: 0, lastCompleted: null });
    void setWindowClosable(false);

    try {
      const result = await runExport(
        {
          song,
          customization: useCustomizationStore.getState().settings,
          camera: useCameraStore.getState(),
          settings,
          onProgress: (progress) => {
            const fraction =
              progress.totalFrames > 0
                ? progress.currentFrame / progress.totalFrames
                : progress.phase === 'encoding' || progress.phase === 'done'
                ? 1
                : 0;
            set({ progressMessage: progress.message, progressFraction: fraction });
          },
        },
        activeToken,
      );
      if (result.cancelled) {
        set({ progressMessage: '' });
      } else {
        set({ lastCompleted: { outputPath: result.outputPath, isDirectory: settings.format === ('png-sequence' as ExportFormat) } });
      }
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : 'Export failed.' });
    } finally {
      set({ isRunning: false, isPaused: false, isFinishing: false });
      void setWindowClosable(true);
      activeToken = null;
    }
  },

  cancel: () => {
    activeToken?.cancel();
    set({ isFinishing: false });
  },

  finish: () => {
    if (!activeToken || get().isFinishing || !get().isRunning) return;
    activeToken.finish();
    set({ isFinishing: true, progressMessage: 'Finishing export…' });
  },

  pause: () => {
    activeToken?.pause();
    set({ isPaused: true });
  },

  resume: () => {
    activeToken?.resume();
    set({ isPaused: false });
  },

  dismissCompleted: () => set({ lastCompleted: null }),
}));
