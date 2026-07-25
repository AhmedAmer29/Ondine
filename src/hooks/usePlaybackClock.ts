import { useEffect } from 'react';
import { usePlaybackStore } from '@/state/playbackStore';

/** How often UI-facing playback state (timecode, status) refreshes. Well below frame rate on purpose. */
const UI_CLOCK_INTERVAL_MS = 1000 / 20;

/**
 * Drives `playbackStore.tickClock()` at a UI-appropriate rate (~20Hz) so time
 * displays and the seek bar stay smooth without re-rendering React at the
 * renderer's full 60-144fps. Mount this once near the app root.
 */
export function usePlaybackClock(): void {
  useEffect(() => {
    let frameId: number;
    let lastTick = 0;

    const loop = (timestamp: number): void => {
      if (timestamp - lastTick >= UI_CLOCK_INTERVAL_MS) {
        lastTick = timestamp;
        usePlaybackStore.getState().tickClock();
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);
}
