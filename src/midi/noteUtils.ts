import type { KeySignatureEvent } from '@/types';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const ACCIDENTAL_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** Lowest and highest MIDI note numbers on a standard 88-key piano. */
export const PIANO_MIN_MIDI = 21;
export const PIANO_MAX_MIDI = 108;
export const PIANO_KEY_COUNT = PIANO_MAX_MIDI - PIANO_MIN_MIDI + 1;

let noteIdCounter = 0;

/** One shared counter for every NoteEvent.id, real files and synthesized (Live-mode recording) songs alike — keeps two independently-parsed songs from ever colliding, since a lot of app state (selection, practice judgements) keys off this id. */
export function nextNoteId(): number {
  return noteIdCounter++;
}

/** A fresh unique id for a ParsedSong, shared by the real-file parser and the Live-mode recording synthesizer. */
export function generateSongId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `song-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiToPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function isAccidentalMidi(midi: number): boolean {
  return ACCIDENTAL_PITCH_CLASSES.has(midiToPitchClass(midi));
}

/** Finds the key signature in effect at `time`, or null if none has occurred yet. */
export function getActiveKeySignature(
  time: number,
  keySignatureEvents: readonly KeySignatureEvent[],
): KeySignatureEvent | null {
  let active: KeySignatureEvent | null = null;
  for (const event of keySignatureEvents) {
    if (event.time > time) break;
    active = event;
  }
  return active;
}

export interface PitchName {
  readonly name: string;
  readonly pitchClass: string;
  readonly octave: number;
}

/** Renders a MIDI note number to a display name. Accidentals are always spelled as sharps. */
export function midiToPitchName(midi: number): PitchName {
  const octave = midiToOctave(midi);
  const pc = midiToPitchClass(midi);
  const pitchClass = SHARP_NAMES[pc] as string;
  return { name: `${pitchClass}${octave}`, pitchClass, octave };
}

/** True if `midi` corresponds to a white key on the piano. */
export function isWhiteKey(midi: number): boolean {
  return !isAccidentalMidi(midi);
}

/** Clamps a MIDI note number into the playable 88-key range. */
export function clampToPianoRange(midi: number): number {
  return Math.min(PIANO_MAX_MIDI, Math.max(PIANO_MIN_MIDI, midi));
}
