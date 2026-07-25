import type { InstrumentInfo, MidiTrackData, NoteEvent, ParsedSong, TempoEvent, TimeSignatureEvent } from '@/types';
import { generateSongId, isAccidentalMidi, midiToPitchName, nextNoteId } from '@/midi/noteUtils';
import { detectHands } from '@/midi/handDetection';
import { markChordRoots, markMelody } from '@/midi/chordDetection';
import type { RecordedNote } from './LiveInputController';

const DEFAULT_BPM = 120;

export interface SynthesizeSongOptions {
  readonly name?: string;
  readonly bpm?: number;
}

/**
 * Builds a `ParsedSong` directly from a Live-mode recording buffer, reusing the same pure
 * pitch/hand/chord helpers the real MIDI-file parser uses (`noteUtils`, `detectHands`,
 * `markChordRoots`/`markMelody`) instead of round-tripping through actual `.mid` bytes — those
 * helpers are already plain synchronous array scans over a finished note list, which is exactly
 * what a just-stopped recording is. Tempo/time-signature default to a single event at time zero,
 * the same fallback `parseMidi.ts` already uses for a file with no real tempo map.
 *
 * Known limitation: no sustain-pedal capture. Live input (PC keyboard, mouse, and
 * `MidiInputManager`) only reports note-on/off today, never CC64, so `effectiveEndTime` is always
 * just `endTime`.
 */
export function synthesizeSongFromRecording(recordedNotes: readonly RecordedNote[], options: SynthesizeSongOptions = {}): ParsedSong {
  const sorted = [...recordedNotes].sort((a, b) => a.startTime - b.startTime);
  const bpm = options.bpm ?? DEFAULT_BPM;

  const instrument: InstrumentInfo = { number: 0, name: 'Piano', family: 'piano', percussion: false };
  const notes: NoteEvent[] = sorted.map((recorded) => {
    const pitch = midiToPitchName(recorded.midi);
    const duration = Math.max(0.02, recorded.endTime - recorded.startTime);
    const endTime = recorded.startTime + duration;
    return {
      id: nextNoteId(),
      midi: recorded.midi,
      name: pitch.name,
      pitchClass: pitch.pitchClass,
      octave: pitch.octave,
      isAccidental: isAccidentalMidi(recorded.midi),
      time: recorded.startTime,
      duration,
      endTime,
      effectiveEndTime: endTime,
      velocity: Math.max(0.05, Math.min(1, recorded.velocity)),
      trackIndex: 0,
      channel: 0,
      hand: 'unknown',
      isChordRoot: false,
      isMelody: false,
      sustained: false,
    };
  });

  const track: MidiTrackData = {
    index: 0,
    name: 'Live Recording',
    channel: 0,
    instrument,
    notes,
    controlChanges: new Map(),
    sustainSpans: [],
    muted: false,
    solo: false,
    color: '#3b82f6',
    handHint: 'unknown',
  };

  const handHints = detectHands([track], notes);
  track.handHint = handHints.get(0) ?? 'unknown';
  markChordRoots(notes);
  markMelody(notes);

  const midiValues = notes.map((n) => n.midi);
  const minMidi = midiValues.length > 0 ? Math.min(...midiValues) : 21;
  const maxMidi = midiValues.length > 0 ? Math.max(...midiValues) : 108;
  const durationSeconds = notes.length > 0 ? Math.max(...notes.map((n) => n.endTime)) : 0;

  const tempoEvents: TempoEvent[] = [{ time: 0, bpm }];
  const timeSignatureEvents: TimeSignatureEvent[] = [{ time: 0, numerator: 4, denominator: 4, measure: 0 }];

  return {
    id: generateSongId(),
    name: options.name ?? `Live recording — ${new Date().toLocaleString()}`,
    fileName: 'live-recording.mid',
    filePath: null,
    durationSeconds,
    ppq: 480,
    tracks: [track],
    notes,
    tempoEvents,
    timeSignatureEvents,
    keySignatureEvents: [],
    markers: [],
    lyrics: [],
    averageBpm: bpm,
    minMidi,
    maxMidi,
    loadedAt: Date.now(),
  };
}
