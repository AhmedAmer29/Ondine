import { useEffect, useState } from 'react';
import type { DetectedChord } from '@/midi/chordDetection';
import type { KeySignatureEvent, TimeSignatureEvent } from '@/types';
import { useSongStore } from '@/state/songStore';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';

const POLL_INTERVAL_MS = 1000 / 12;

export interface LiveSongInfo {
  readonly bpm: number;
  readonly measure: number;
  readonly beat: number;
  readonly timeSignature: TimeSignatureEvent;
  readonly chord: DetectedChord | null;
  readonly keySignature: KeySignatureEvent | null;
}

const EMPTY_TIME_SIGNATURE: TimeSignatureEvent = { time: 0, numerator: 4, denominator: 4, measure: 0 };

/** Polls SongQuery at a UI-appropriate rate for the "now playing" overlay: chord, key, BPM, measure, beat. */
export function useLiveSongInfo(): LiveSongInfo {
  const query = useSongStore((s) => s.query);
  const [info, setInfo] = useState<LiveSongInfo>({
    bpm: 120,
    measure: 0,
    beat: 0,
    timeSignature: EMPTY_TIME_SIGNATURE,
    chord: null,
    keySignature: null,
  });

  useEffect(() => {
    if (!query) return;
    let frameId: number;
    let lastPoll = 0;

    const loop = (timestamp: number): void => {
      if (timestamp - lastPoll >= POLL_INTERVAL_MS) {
        lastPoll = timestamp;
        const time = getPlaybackEngine().getCurrentTime();
        setInfo({
          bpm: Math.round(query.getBpmAtTime(time)),
          measure: query.getMeasureAtTime(time) + 1,
          beat: Math.floor(query.getBeatInMeasureAtTime(time)) + 1,
          timeSignature: query.getTimeSignatureAtTime(time),
          chord: query.getCurrentChordAt(time),
          keySignature: query.getKeySignatureAtTime(time),
        });
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [query]);

  return info;
}
