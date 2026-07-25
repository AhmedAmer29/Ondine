import { SongQuery } from '@/midi/songQuery';
import type { NoteEvent, ParsedSong } from '@/types';

/** Quantization grid resolution: 4 slots per quarter note (16th-note grid). */
const SLOTS_PER_QUARTER = 4;

export type StaffId = 'treble' | 'bass';

export interface ScoreEvent {
  readonly startSlot: number;
  /** Always a power of two (1/2/4/8/16), matching a real notated duration. */
  readonly slotCount: number;
  /** MIDI note numbers sounding at this event; empty means a rest. */
  readonly midiKeys: readonly number[];
}

export interface ScoreMeasure {
  readonly index: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly treble: readonly ScoreEvent[];
  readonly bass: readonly ScoreEvent[];
}

function slotsPerMeasure(numerator: number, denominator: number): number {
  return Math.max(1, Math.round(numerator * (4 / denominator) * SLOTS_PER_QUARTER));
}

function assignStaff(note: NoteEvent): StaffId {
  if (note.hand === 'right') return 'treble';
  if (note.hand === 'left') return 'bass';
  return note.midi >= 60 ? 'treble' : 'bass';
}

/** Largest power-of-two slot count <= n, capped at 16 (a whole note) since that's the longest single notated duration this grid represents. */
function largestPow2(n: number): number {
  let p = 1;
  while (p * 2 <= n && p < 16) p *= 2;
  return p;
}

/** Decomposes a rest span into a greedy sequence of power-of-two-length tokens (e.g. 24 -> [16, 8]). */
function splitRestSlots(slotCount: number): number[] {
  const tokens: number[] = [];
  let remaining = slotCount;
  while (remaining > 0) {
    const token = largestPow2(remaining);
    tokens.push(token);
    remaining -= token;
  }
  return tokens;
}

/**
 * Quantizes one hand's notes within a measure onto the slot grid, groups simultaneous notes into
 * chords, and fills every gap with rests so the measure always sums to exactly `slotCount`.
 * A note's notated length is capped at the gap to the next note (or measure end) — this can
 * shorten an unusually long or oddly-timed note rather than tie it across multiple tokens, a
 * deliberate v1 simplification for auto-transcribed rhythm.
 */
function layoutStaff(notes: readonly NoteEvent[], measureStart: number, measureEnd: number, slotCount: number): ScoreEvent[] {
  const slotDuration = (measureEnd - measureStart) / slotCount;
  const notesBySlot = new Map<number, number[]>();

  for (const note of notes) {
    if (note.time < measureStart || note.time >= measureEnd) continue;
    const rawSlot = (note.time - measureStart) / slotDuration;
    const startSlot = Math.min(slotCount - 1, Math.max(0, Math.round(rawSlot)));
    const existing = notesBySlot.get(startSlot);
    if (existing) {
      if (!existing.includes(note.midi)) existing.push(note.midi);
    } else {
      notesBySlot.set(startSlot, [note.midi]);
    }
  }

  const startSlots = [...notesBySlot.keys()].sort((a, b) => a - b);
  const events: ScoreEvent[] = [];
  let cursor = 0;

  for (const startSlot of startSlots) {
    if (startSlot < cursor) continue; // collided with the previous (longer) event — drop
    if (startSlot > cursor) {
      for (const restLen of splitRestSlots(startSlot - cursor)) {
        events.push({ startSlot: cursor, slotCount: restLen, midiKeys: [] });
        cursor += restLen;
      }
    }
    const nextStart = startSlots.find((s) => s > startSlot) ?? slotCount;
    const len = largestPow2(nextStart - startSlot);
    events.push({ startSlot, slotCount: len, midiKeys: notesBySlot.get(startSlot)! });
    cursor = startSlot + len;
  }

  if (cursor < slotCount) {
    for (const restLen of splitRestSlots(slotCount - cursor)) {
      events.push({ startSlot: cursor, slotCount: restLen, midiKeys: [] });
      cursor += restLen;
    }
  }

  return events;
}

/**
 * Quantizes a parsed song onto a 16th-note grid and splits it across grand-staff hands, one entry
 * per measure. Notes with an assigned hand (`NoteEvent.hand`, set by `detectHands` at load time)
 * use it directly; notes with no hand info fall back to a middle-C pitch threshold.
 */
export function buildScore(song: ParsedSong): ScoreMeasure[] {
  const query = new SongQuery(song);
  const lastMeasure = query.getMeasureAtTime(Math.max(0, song.durationSeconds - 0.001));

  const trebleNotes = song.notes.filter((n) => assignStaff(n) === 'treble');
  const bassNotes = song.notes.filter((n) => assignStaff(n) === 'bass');

  const measures: ScoreMeasure[] = [];
  for (let m = 0; m <= lastMeasure; m++) {
    const measureStart = query.getTimeAtMeasure(m);
    const measureEnd = query.getTimeAtMeasure(m + 1);
    const sig = query.getTimeSignatureAtTime(measureStart);
    const slotCount = slotsPerMeasure(sig.numerator, sig.denominator);

    measures.push({
      index: m,
      numerator: sig.numerator,
      denominator: sig.denominator,
      treble: layoutStaff(trebleNotes, measureStart, measureEnd, slotCount),
      bass: layoutStaff(bassNotes, measureStart, measureEnd, slotCount),
    });
  }

  return measures;
}
