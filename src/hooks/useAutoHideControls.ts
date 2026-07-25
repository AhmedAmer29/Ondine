import { useEffect, useRef } from 'react';
import { useUiStore } from '@/state/uiStore';
import { usePlaybackStore } from '@/state/playbackStore';

const IDLE_HIDE_DELAY_MS = 2600;

/**
 * Fades the transport UI out a couple seconds after the pointer stops moving,
 * but only while a song is actively playing — matches "the interface
 * disappears while playing; only playback controls remain visible."
 */
export function useAutoHideControls(): void {
  const status = usePlaybackStore((s) => s.status);
  const setControlsVisible = useUiStore((s) => s.setControlsVisible);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'playing') {
      setControlsVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }

    const resetTimer = (): void => {
      setControlsVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setControlsVisible(false), IDLE_HIDE_DELAY_MS);
    };

    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [status, setControlsVisible]);
}
