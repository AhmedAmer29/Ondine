import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '@/state/playbackStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useSongStore } from '@/state/songStore';

/** When a song finishes and the queue has more songs, loads and plays the next one automatically. */
export function usePlaylistAutoAdvance(): void {
  const status = usePlaybackStore((s) => s.status);
  const wasEndedRef = useRef(false);

  useEffect(() => {
    if (status !== 'ended') {
      wasEndedRef.current = false;
      return;
    }
    if (wasEndedRef.current) return;
    wasEndedRef.current = true;

    const { autoAdvance, peekNext } = usePlaylistStore.getState();
    if (!autoAdvance) return;

    const next = peekNext();
    if (!next) return;

    void useSongStore
      .getState()
      .loadFromPath(next.path)
      .then(() => void usePlaybackStore.getState().play());
  }, [status]);
}
