export interface ColorStop {
  readonly offset: number;
  readonly color: string;
}

export interface GradientDef {
  readonly from: string;
  readonly to: string;
}

export type BackgroundStyle = 'matte' | 'aurora' | 'nebula' | 'midnight' | 'custom';

export interface CustomizationSettings {
  particleAmount: number;
  panelTransparency: number;
  cornerRadius: number;
  animationSpeed: number;
  noteWidthScale: number;
  laneWidthScale: number;
  keySizeScale: number;
  backgroundStyle: BackgroundStyle;
  backgroundColor: string;
  backgroundGradient: GradientDef;
  rightHandGradient: GradientDef;
  leftHandGradient: GradientDef;
  keyboardColor: string;
  fontFamily: string;
  showLightRays: boolean;
  showVignette: boolean;
  showNoteLabels: boolean;
  showFpsCounter: boolean;
  /** The metronome's own fixed tempo, independent of the song's tempo map or the playback speed slider. */
  metronomeBpm: number;
}

export const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  particleAmount: 0.4,
  panelTransparency: 1,
  cornerRadius: 14,
  animationSpeed: 1,
  noteWidthScale: 1,
  laneWidthScale: 1,
  keySizeScale: 1,
  backgroundStyle: 'aurora',
  backgroundColor: '#05060a',
  backgroundGradient: { from: '#0b0f1a', to: '#05060a' },
  rightHandGradient: { from: '#ff8a3d', to: '#ff4d4d' },
  leftHandGradient: { from: '#3b82f6', to: '#2f6fed' },
  keyboardColor: '#0e1220',
  fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  showLightRays: true,
  showVignette: true,
  showNoteLabels: true,
  showFpsCounter: false,
  metronomeBpm: 120,
};

/** A named bundle of the colors that make up a visual "theme" — applied as one unit via `customizationStore.updateMany`, rather than the individual color pickers in the Customization panel. */
export type ColorPresetName = 'Sunset' | 'Ocean' | 'Forest' | 'Midnight' | 'Mono';

export type ColorPreset = Pick<CustomizationSettings, 'backgroundGradient' | 'rightHandGradient' | 'leftHandGradient' | 'keyboardColor' | 'backgroundStyle'>;

export const COLOR_PRESETS: Record<ColorPresetName, ColorPreset> = {
  Sunset: {
    backgroundGradient: { from: '#1a0f0f', to: '#05060a' },
    rightHandGradient: { from: '#ff8a3d', to: '#ff4d4d' },
    leftHandGradient: { from: '#3b82f6', to: '#2f6fed' },
    keyboardColor: '#150e0e',
    backgroundStyle: 'aurora',
  },
  Ocean: {
    backgroundGradient: { from: '#061420', to: '#020608' },
    rightHandGradient: { from: '#22d3ee', to: '#0891b2' },
    leftHandGradient: { from: '#6366f1', to: '#3730a3' },
    keyboardColor: '#08131a',
    backgroundStyle: 'aurora',
  },
  Forest: {
    backgroundGradient: { from: '#0c1a10', to: '#03060a' },
    rightHandGradient: { from: '#4ade80', to: '#16a34a' },
    leftHandGradient: { from: '#facc15', to: '#ca8a04' },
    keyboardColor: '#0c130e',
    backgroundStyle: 'nebula',
  },
  Midnight: {
    backgroundGradient: { from: '#05060c', to: '#000000' },
    rightHandGradient: { from: '#a5b4fc', to: '#6366f1' },
    leftHandGradient: { from: '#7dd3fc', to: '#0ea5e9' },
    keyboardColor: '#07080d',
    backgroundStyle: 'midnight',
  },
  Mono: {
    backgroundGradient: { from: '#101012', to: '#050506' },
    rightHandGradient: { from: '#e5e7eb', to: '#9ca3af' },
    leftHandGradient: { from: '#9ca3af', to: '#4b5563' },
    keyboardColor: '#0d0d0f',
    backgroundStyle: 'matte',
  },
};
