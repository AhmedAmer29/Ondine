const BASE_SEEK_STEP_SECONDS = 5;

/**
 * Scales the skip amount by playback speed, the way YouTube's seek buttons
 * feel proportional to what's actually playing: at 0.25x the same button
 * jumps a smaller amount of song-time than it does at 1x or 2x.
 */
export function computeSeekStepSeconds(tempoMultiplier: number): number {
  return BASE_SEEK_STEP_SECONDS * tempoMultiplier;
}
