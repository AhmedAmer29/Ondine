import { Midi } from '@tonejs/midi';
import type {
  ControlChangeEvent,
  InstrumentInfo,
  KeySignatureEvent,
  LyricEvent,
  MarkerEvent,
  MidiTrackData,
  NoteEvent,
  ParsedSong,
  TempoEvent,
  TimeSignatureEvent,
} from '@/types';
import { generateSongId, isAccidentalMidi, midiToPitchName, nextNoteId } from './noteUtils';
import { detectHands } from './handDetection';
import { markChordRoots, markMelody } from './chordDetection';
import { buildSustainSpans, getSustainedEndTime, isWithinSpans } from './sustainUtils';

export const TRACK_COLOR_PALETTE: readonly string[] = [
  '#3b82f6',
  '#f97316',
  '#a855f7',
  '#22d3ee',
  '#ef4444',
  '#84cc16',
  '#ec4899',
  '#eab308',
  '#14b8a6',
  '#8b5cf6',
];

/** Parses a raw MIDI file buffer into PianoFlow's normalized internal song representation. */
export async function parseMidiFile(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  filePath: string | null,
): Promise<ParsedSong> {
  const midi = new Midi(arrayBuffer);
  const header = midi.header;

  const tempoEvents = buildTempoEvents(header);
  const timeSignatureEvents = buildTimeSignatureEvents(header);
  const keySignatureEvents = buildKeySignatureEvents(header);
  const markers = buildMeta(header, 'marker');
  const lyrics = buildLyrics(header);

  const tracks: MidiTrackData[] = [];
  const allNotes: NoteEvent[] = [];

  midi.tracks.forEach((track, index) => {
    const instrument: InstrumentInfo = {
      number: track.instrument.number,
      name: track.instrument.name,
      family: track.instrument.family,
      percussion: track.instrument.percussion,
    };

    const controlChanges = new Map<number, ControlChangeEvent[]>();
    for (let ccNumber = 0; ccNumber < 128; ccNumber++) {
      const raw = track.controlChanges[ccNumber];
      if (raw && raw.length > 0) {
        controlChanges.set(
          ccNumber,
          raw.map((event) => ({ time: event.time, controllerNumber: ccNumber, value: event.value })),
        );
      }
    }

    const sustainSpans = buildSustainSpans(controlChanges.get(64) ?? [], midi.duration);

    const notes: NoteEvent[] = track.notes.map((n) => {
      const pitch = midiToPitchName(n.midi);
      const endTime = n.time + n.duration;
      const note: NoteEvent = {
        id: nextNoteId(),
        midi: n.midi,
        name: pitch.name,
        pitchClass: pitch.pitchClass,
        octave: pitch.octave,
        isAccidental: isAccidentalMidi(n.midi),
        time: n.time,
        duration: n.duration,
        endTime,
        effectiveEndTime: getSustainedEndTime(endTime, sustainSpans),
        velocity: n.velocity,
        trackIndex: index,
        channel: track.channel,
        hand: 'unknown',
        isChordRoot: false,
        isMelody: false,
        sustained: isWithinSpans(endTime, sustainSpans),
      };
      return note;
    });

    const trackData: MidiTrackData = {
      index,
      name: track.name.trim() || instrument.name || `Track ${index + 1}`,
      channel: track.channel,
      instrument,
      notes,
      controlChanges,
      sustainSpans,
      muted: false,
      solo: false,
      color: TRACK_COLOR_PALETTE[index % TRACK_COLOR_PALETTE.length] as string,
      handHint: 'unknown',
    };

    tracks.push(trackData);
    allNotes.push(...notes);
  });

  allNotes.sort((a, b) => a.time - b.time);

  const handHints = detectHands(tracks, allNotes);
  for (const track of tracks) {
    track.handHint = handHints.get(track.index) ?? 'unknown';
  }
  markChordRoots(allNotes);
  markMelody(allNotes);

  const midiValues = allNotes.map((n) => n.midi);
  const minMidi = midiValues.length > 0 ? Math.min(...midiValues) : 21;
  const maxMidi = midiValues.length > 0 ? Math.max(...midiValues) : 108;
  const averageBpm =
    tempoEvents.length > 0 ? tempoEvents.reduce((sum, t) => sum + t.bpm, 0) / tempoEvents.length : 120;

  return {
    id: generateSongId(),
    name: stripExtension(fileName) || header.name.trim() || 'Untitled',
    fileName,
    filePath,
    durationSeconds: midi.duration,
    ppq: header.ppq,
    tracks,
    notes: allNotes,
    tempoEvents,
    timeSignatureEvents,
    keySignatureEvents,
    markers,
    lyrics,
    averageBpm,
    minMidi,
    maxMidi,
    loadedAt: Date.now(),
  };
}

function buildTempoEvents(header: Midi['header']): TempoEvent[] {
  const events = header.tempos.map((t) => ({ time: t.time ?? header.ticksToSeconds(t.ticks), bpm: t.bpm }));
  if (events.length === 0 || (events[0] as TempoEvent).time > 0) {
    events.unshift({ time: 0, bpm: 120 });
  }
  return events;
}

function buildTimeSignatureEvents(header: Midi['header']): TimeSignatureEvent[] {
  const raw = header.timeSignatures.length > 0 ? header.timeSignatures : [{ ticks: 0, timeSignature: [4, 4] }];
  const result: TimeSignatureEvent[] = [];
  let measureAccumulator = 0;

  for (let i = 0; i < raw.length; i++) {
    const sig = raw[i];
    if (!sig) continue;
    const numerator = sig.timeSignature[0] ?? 4;
    const denominator = sig.timeSignature[1] ?? 4;
    result.push({
      time: header.ticksToSeconds(sig.ticks),
      numerator,
      denominator,
      measure: measureAccumulator,
    });

    const next = raw[i + 1];
    if (next) {
      const ticksPerMeasure = header.ppq * numerator * (4 / denominator);
      const elapsedTicks = next.ticks - sig.ticks;
      measureAccumulator += ticksPerMeasure > 0 ? Math.max(0, Math.round(elapsedTicks / ticksPerMeasure)) : 0;
    }
  }

  return result;
}

function buildKeySignatureEvents(header: Midi['header']): KeySignatureEvent[] {
  return header.keySignatures.map((k) => ({
    time: header.ticksToSeconds(k.ticks),
    tonic: k.key,
    mode: k.scale === 'minor' ? 'minor' : 'major',
  }));
}

function buildMeta(header: Midi['header'], type: string): MarkerEvent[] {
  return header.meta
    .filter((m) => m.type === type)
    .map((m) => ({ time: header.ticksToSeconds(m.ticks), text: m.text }));
}

function buildLyrics(header: Midi['header']): LyricEvent[] {
  return header.meta
    .filter((m) => m.type === 'lyrics' || m.type === 'text')
    .map((m) => ({ time: header.ticksToSeconds(m.ticks), text: m.text }));
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '');
}
