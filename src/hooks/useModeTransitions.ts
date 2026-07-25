import { useEffect, useRef } from 'react';
import { useUiStore } from '@/state/uiStore';
import { useSongStore } from '@/state/songStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { usePracticeStore } from '@/state/practiceStore';
import { countdownController } from '@/practice/countdown';

/**
 * Practice mode is exclusive to Learn mode. Leaving Learn turns it off (Play mode is free play,
 * graded or not); returning to Learn with a song loaded turns it back on, pausing for a fresh
 * count-in instead of silently resuming mid-phrase under different grading rules.
 *
 * The metronome resets on every mode switch too — each mode tab (Play/Live/Learn) starts fresh
 * rather than carrying a click-track across into a tab where it wasn't turned on.
 */
export function useModeTransitions(): void {
  const mode = useUiStore((s) => s.mode);
  const prevModeRef = useRef(mode);

  useEffect(() => {
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;
    if (prevMode === mode) return;

    // Any pending count-in belonged to whatever mode we're leaving — a stale one left running
    // would fire play() later regardless of what mode the user has since switched to.
    countdownController.cancel();

    const playback = usePlaybackStore.getState();
    if (playback.metronomeEnabled) playback.toggleMetronome();

    const practice = usePracticeStore.getState();

    if (mode === 'learn') {
      const song = useSongStore.getState().song;
      if (song && !practice.settings.enabled) {
        usePlaybackStore.getState().pause();
        void practice.toggleEnabled().then(() => {
          // The user may have already navigated away again by the time this resolves —
          // don't arm a countdown for a mode they're no longer in.
          if (useUiStore.getState().mode === 'learn') countdownController.trigger();
        });
      }
    } else if (prevMode === 'learn' && practice.settings.enabled) {
      void practice.toggleEnabled();
    }
  }, [mode]);
}
