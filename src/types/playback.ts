/** A continuous playback-speed multiplier (1 = normal speed), adjusted via a smooth slider. */
export type TempoMultiplier = number;

export const MIN_TEMPO_MULTIPLIER = 0.25;
export const MAX_TEMPO_MULTIPLIER = 2;

export type PracticeHandMode = 'both' | 'left' | 'right';

export interface LoopRegion {
  readonly startTime: number;
  readonly endTime: number;
  readonly label: string;
}

export type PlaybackStatus = 'idle' | 'countdown' | 'playing' | 'paused' | 'seeking' | 'ended';

export interface Bookmark {
  readonly id: string;
  readonly time: number;
  readonly label: string;
  readonly color: string;
}
