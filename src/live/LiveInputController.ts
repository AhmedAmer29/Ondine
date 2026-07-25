import type { Hand } from '@/types';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';
import { getMidiInputManager, type MidiNoteEvent } from '@/practice/midiInput';

export type LiveInputSource = 'mouse' | 'midi';

export interface LiveNoteEvent {
  readonly midi: number;
  readonly on: boolean;
  readonly velocity: number;
  readonly hand: Hand;
  readonly timestamp: number;
}

export interface RecordedNote {
  readonly midi: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly velocity: number;
  readonly hand: Hand;
}

type LiveNoteListener = (event: LiveNoteEvent) => void;

/** Notes below middle C read as "left hand" purely for coloring — Live mode has no real hand detection, just a pitch split. */
const HAND_SPLIT_MIDI = 60;

function inferHand(midi: number): Hand {
  return midi < HAND_SPLIT_MIDI ? 'left' : 'right';
}

interface OpenRecordedNote {
  readonly startTime: number;
  readonly velocity: number;
  readonly hand: Hand;
}

/**
 * Singleton owning "what's currently being played live," across both input sources (mouse click
 * and a connected MIDI keyboard — PC-keyboard typing was deliberately dropped). Ref-counts which
 * sources are holding each key rather than last-writer-wins: two sources can legitimately hold the
 * same physical key at once (e.g. clicking a key a MIDI keyboard is also holding), and releasing
 * just one of them must not cut the sound while the other is still held.
 *
 * Drives `PlaybackEngine.previewNoteOn/Off` for sound and emits note on/off events any subscriber
 * (the Live renderer, the record buffer) can listen to — mirroring the pub/sub shape
 * `MidiInputManager.subscribe()` already establishes elsewhere in this codebase.
 */
class LiveInputController {
  private readonly holders = new Map<number, Set<LiveInputSource>>();
  private readonly listeners = new Set<LiveNoteListener>();
  private midiUnsubscribe: (() => void) | null = null;

  private recording = false;
  private recordingStartTimestamp = 0;
  private recordedNotes: RecordedNote[] = [];
  private readonly openRecordedNotes = new Map<number, OpenRecordedNote>();

  private now(): number {
    return performance.now() / 1000;
  }

  /** Starts (if needed) and subscribes to the shared MIDI input manager. Safe to call repeatedly. */
  connectMidi(): void {
    if (this.midiUnsubscribe) return;
    const manager = getMidiInputManager();
    void manager.start();
    this.midiUnsubscribe = manager.subscribe((event: MidiNoteEvent) => {
      if (event.on) this.noteOn(event.midi, event.velocity, 'midi');
      else this.noteOff(event.midi, 'midi');
    });
  }

  /** Only ever unsubscribes this controller's own listener — never calls `MidiInputManager.stop()`, which would tear down every other consumer's connection too (Practice mode's, in particular). */
  disconnectMidi(): void {
    this.midiUnsubscribe?.();
    this.midiUnsubscribe = null;
  }

  noteOn(midi: number, velocity: number, source: LiveInputSource): void {
    let sources = this.holders.get(midi);
    if (!sources) {
      sources = new Set();
      this.holders.set(midi, sources);
    }
    const wasSounding = sources.size > 0;
    sources.add(source);
    if (wasSounding) return;

    const hand = inferHand(midi);
    getPlaybackEngine().previewNoteOn(midi, velocity);
    if (this.recording) {
      this.openRecordedNotes.set(midi, { startTime: this.now() - this.recordingStartTimestamp, velocity, hand });
    }
    this.emit({ midi, on: true, velocity, hand, timestamp: this.now() });
  }

  noteOff(midi: number, source: LiveInputSource): void {
    const sources = this.holders.get(midi);
    if (!sources || !sources.delete(source)) return;
    if (sources.size > 0) return;
    this.holders.delete(midi);

    const hand = inferHand(midi);
    getPlaybackEngine().previewNoteOff(midi);
    if (this.recording) {
      const open = this.openRecordedNotes.get(midi);
      if (open) {
        this.recordedNotes.push({ midi, startTime: open.startTime, endTime: this.now() - this.recordingStartTimestamp, velocity: open.velocity, hand: open.hand });
        this.openRecordedNotes.delete(midi);
      }
    }
    this.emit({ midi, on: false, velocity: 0, hand, timestamp: this.now() });
  }

  subscribe(listener: LiveNoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: LiveNoteEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** Every key currently sounding from any source, and which sources hold it — for a late subscriber to sync its initial state. */
  getHeldMidis(): ReadonlySet<number> {
    return new Set(this.holders.keys());
  }

  startRecording(): void {
    this.recording = true;
    this.recordedNotes = [];
    this.openRecordedNotes.clear();
    this.recordingStartTimestamp = this.now();
  }

  /** Force-closes any still-held notes at "now" so a take stopped mid-chord doesn't lose them. */
  stopRecording(): RecordedNote[] {
    this.recording = false;
    const relativeNow = this.now() - this.recordingStartTimestamp;
    for (const [midi, open] of this.openRecordedNotes) {
      this.recordedNotes.push({ midi, startTime: open.startTime, endTime: relativeNow, velocity: open.velocity, hand: open.hand });
    }
    this.openRecordedNotes.clear();
    return this.recordedNotes;
  }

  isRecording(): boolean {
    return this.recording;
  }

  /** Releases every currently-held key across all sources — used when leaving Live mode, so nothing keeps sounding after the view goes away. */
  releaseAll(): void {
    for (const [midi, sources] of this.holders) {
      for (const source of [...sources]) this.noteOff(midi, source);
    }
  }
}

let shared: LiveInputController | null = null;

export function getLiveInputController(): LiveInputController {
  if (!shared) shared = new LiveInputController();
  return shared;
}
