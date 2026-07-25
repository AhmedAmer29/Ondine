export type ExportFormat = 'mp4' | 'gif' | 'png-sequence';
export type ExportAspect = 'landscape' | 'portrait' | 'square';
export type ExportCodec = 'h264' | 'h265' | 'vp9' | 'prores';

export interface ExportResolution {
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const EXPORT_RESOLUTIONS: readonly ExportResolution[] = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
  { label: '8K', width: 7680, height: 4320 },
];

export interface ExportSettings {
  format: ExportFormat;
  aspect: ExportAspect;
  resolution: ExportResolution;
  fps: 24 | 30 | 60 | 120;
  codec: ExportCodec;
  bitrateMbps: number;
  transparentBackground: boolean;
  startTime: number;
  endTime: number;
  /** Base filename (desktop) or download filename (web) for the export. Falls back to the song name when empty. */
  exportName: string;
}

/** `resolution` is always stored in its landscape (width >= height) form; this derives the actual output dimensions for the chosen aspect. */
export function resolveExportDimensions(resolution: ExportResolution, aspect: ExportAspect): { width: number; height: number } {
  if (aspect === 'landscape') return { width: resolution.width, height: resolution.height };
  if (aspect === 'portrait') return { width: resolution.height, height: resolution.width };
  const size = Math.min(resolution.width, resolution.height);
  return { width: size, height: size };
}

export type ExportPhase = 'idle' | 'rendering-frames' | 'encoding' | 'done' | 'error' | 'cancelled';

export interface ExportProgress {
  phase: ExportPhase;
  currentFrame: number;
  totalFrames: number;
  message: string;
}
