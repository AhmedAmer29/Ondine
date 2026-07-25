import { FillGradient } from 'pixi.js';
import type { GradientDef } from '@/types';

/**
 * Builds a vertical (top-to-bottom, local-space) gradient fill. PianoFlow keeps
 * exactly one shared FillGradient per hand color scheme and reuses it across every
 * pooled note sprite via `.tint`, rather than allocating a gradient texture per note.
 */
export function createVerticalGradient(def: GradientDef): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: def.from },
      { offset: 1, color: def.to },
    ],
  });
}
