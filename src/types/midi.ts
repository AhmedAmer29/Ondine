/** Which hand a note is assigned to, for coloring and split-hand practice. */
export type Hand = 'left' | 'right' | 'unknown';

/** A single playable note, normalized to absolute seconds regardless of tempo changes. */
export interface NoteEvent {
  /** Stable identity across re-renders; unique within a ParsedSong. */
  readonly id: number;
  /** MIDI note number, 0-127 (60 = middle C / C4). */
  readonly midi: number;
  /** Pitch class + octave, e.g. "F#4". */
  readonly name: string;
  /** Pitch class without octave, e.g. "F#". */
  readonly pitchClass: string;
  readonly octave: number;
  /** True for the five black keys per octave. */
  readonly isAccidental: boolean;
  /** Absolute start time in seconds from the start of the song. */
  readonly time: number;
  /** Duration in seconds, already adjusted for the song's tempo map. */
  readonly duration: number;
  /** time + duration, cached for hot-path comparisons. */
  readonly endTime: number;
  /** endTime, extended to when the sustain pedal lifts if it was held through the note's release. */
  readonly effectiveEndTime: number;
  /** 0-1 normalized velocity. */
  readonly velocity: number;
  readonly trackIndex: number;
  readonly channel: number;
  hand: Hand;
  /** True if this note is the lowest note of a detected chord voicing at its start time. */
  isChordRoot: boolean;
  /** True if this note belongs to the algorithmically-detected melodic line. */
  isMelody: boolean;
  /** True while the sustain pedal is held through this note's release. */
  sustained: boolean;
}

export interface TempoEvent {
  readonly time: number;
  readonly bpm: number;
}

export interface TimeSignatureEvent {
  readonly time: number;
  readonly numerator: number;
  readonly denominator: number;
  /** Which measure number this event begins at (0-indexed). */
  readonly measure: number;
}

export type KeyMode = 'major' | 'minor';

export interface KeySignatureEvent {
  readonly time: number;
  /** Tonic pitch class, e.g. "E".*/
  readonly tonic: string;
  readonly mode: KeyMode;
}

export interface ControlChangeEvent {
  readonly time: number;
  readonly controllerNumber: number;
  /** 0-1 normalized value. */
  readonly value: number;
}

export interface SustainPedalSpan {
  readonly startTime: number;
  readonly endTime: number;
}

export interface MarkerEvent {
  readonly time: number;
  readonly text: string;
}

export interface LyricEvent {
  readonly time: number;
  readonly text: string;
}

export interface InstrumentInfo {
  readonly number: number;
  readonly name: string;
  readonly family: string;
  readonly percussion: boolean;
}

export type HandHint = Hand | 'both';

export interface MidiTrackData {
  readonly index: number;
  name: string;
  readonly channel: number;
  readonly instrument: InstrumentInfo;
  readonly notes: NoteEvent[];
  readonly controlChanges: ReadonlyMap<number, ControlChangeEvent[]>;
  readonly sustainSpans: SustainPedalSpan[];
  muted: boolean;
  solo: boolean;
  color: string;
  handHint: HandHint;
}

export interface ParsedSong {
  readonly id: string;
  name: string;
  readonly fileName: string;
  readonly filePath: string | null;
  readonly durationSeconds: number;
  readonly ppq: number;
  readonly tracks: MidiTrackData[];
  /** All notes across all tracks, flattened and sorted by start time. */
  readonly notes: NoteEvent[];
  readonly tempoEvents: TempoEvent[];
  readonly timeSignatureEvents: TimeSignatureEvent[];
  readonly keySignatureEvents: KeySignatureEvent[];
  readonly markers: MarkerEvent[];
  readonly lyrics: LyricEvent[];
  readonly averageBpm: number;
  readonly minMidi: number;
  readonly maxMidi: number;
  readonly loadedAt: number;
}

export interface RecentFileEntry {
  readonly path: string;
  readonly name: string;
  readonly lastOpened: number;
  readonly durationSeconds: number;
  readonly favorite: boolean;
}
