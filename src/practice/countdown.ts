import * as Tone from 'tone';
import { usePlaybackStore } from '@/state/playbackStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useSongStore } from '@/state/songStore';

const DEFAULT_COUNT_IN_BPM = 100;

export interface CountdownSnapshot {
  readonly isCounting: boolean;
  readonly count: number;
}

type Listener = () => void;

/**
 * Orchestrates the optional audible+visual count-in before playback starts.
 * A plain singleton (not a hook) so both the transport's Play button and the
 * Space-bar shortcut trigger identical, synchronized behavior, and the
 * CountdownOverlay can subscribe to it from anywhere via `useSyncExternalStore`.
 */
class CountdownController {
  private snapshot: CountdownSnapshot = { isCounting: false, count: 0 };
  private readonly listeners = new Set<Listener>();
  private clickSynth: Tone.Synth | null = null;
  private timeouts: number[] = [];

  getSnapshot = (): CountdownSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setSnapshot(next: CountdownSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  /** Voids any pending count-in (and the `play()` it would have fired) without touching current playback state — for when the context that started it (e.g. a Learn session) goes away mid-count. */
  cancel(): void {
    if (!this.snapshot.isCounting) return;
    this.clearTimeouts();
    this.setSnapshot({ isCounting: false, count: 0 });
  }

  trigger(): void {
    const playback = usePlaybackStore.getState();

    if (playback.status === 'playing') {
      playback.pause();
      return;
    }

    const practice = usePracticeStore.getState();
    const beats = practice.settings.enabled ? practice.settings.countdownBeats : 0;
    if (beats <= 0) {
      void playback.play();
      return;
    }

    void Tone.start().then(() => this.runCountdown(beats));
  }

  private runCountdown(beats: number): void {
    this.clearTimeouts();
    if (!this.clickSynth) {
      this.clickSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
        volume: -8,
      }).toDestination();
    }

    const query = useSongStore.getState().query;
    const { currentTime, tempoMultiplier } = usePlaybackStore.getState();
    // Match the count-in's clicks to whatever speed playback will actually run at — otherwise a
    // slowed-down practice tempo starts with a count-in that ticks at the song's full authored
    // speed, audibly out of sync with the material that follows.
    const bpm = (query ? query.getBpmAtTime(currentTime) : DEFAULT_COUNT_IN_BPM) * tempoMultiplier;
    // Floor comfortably above the overlay's own exit-animation duration (0.35s) — at bpm high
    // enough to hit the old 0.35s floor exactly, framer-motion's `mode="wait"` couldn't fully
    // animate one number out before the next arrived and silently dropped it from the sequence
    // (visually "4, 2, go" instead of "4, 3, 2, 1, go"), even though the audio clicks themselves
    // were always correct.
    const intervalSeconds = Math.max(0.5, 60 / bpm);

    this.setSnapshot({ isCounting: true, count: beats });

    for (let i = 0; i < beats; i++) {
      const id = window.setTimeout(() => {
        this.setSnapshot({ isCounting: true, count: beats - i });
        this.clickSynth?.triggerAttackRelease(i === 0 ? 'C6' : 'C5', 0.05);
      }, i * intervalSeconds * 1000);
      this.timeouts.push(id);
    }

    const finishId = window.setTimeout(
      () => {
        this.setSnapshot({ isCounting: false, count: 0 });
        void usePlaybackStore.getState().play();
      },
      beats * intervalSeconds * 1000,
    );
    this.timeouts.push(finishId);
  }

  private clearTimeouts(): void {
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.timeouts = [];
  }
}

export const countdownController = new CountdownController();
