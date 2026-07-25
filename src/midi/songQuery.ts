import type { NoteEvent, ParsedSong, TimeSignatureEvent } from '@/types';
import { MeasureMap } from './measureUtils';
import { detectChord, type DetectedChord } from './chordDetection';
import { getActiveKeySignature } from './noteUtils';
import { lowerBound } from '@/utils/binarySearch';

/**
 * Notes are sorted by start time only, so a very long sustained note could in
 * principle start well before the window we're scanning. In practice MIDI note
 * durations are always short relative to a song, so bounding the look-behind
 * keeps every query below O(window size) instead of O(playback position).
 */
const LOOKBEHIND_SECONDS = 20;

/** Binary-search-backed read-only view over a parsed song, used by the renderer and playback hot paths. */
export class SongQuery {
  readonly song: ParsedSong;
  private readonly measureMap: MeasureMap;
  private readonly sortedTempos: readonly { time: number; bpm: number }[];

  constructor(song: ParsedSong) {
    this.song = song;
    this.sortedTempos = song.tempoEvents;
    this.measureMap = new MeasureMap(song.timeSignatureEvents, (time) => 60 / this.getBpmAtTime(time));
  }

  getBpmAtTime(time: number): number {
    let bpm = this.sortedTempos[0]?.bpm ?? 120;
    for (const event of this.sortedTempos) {
      if (event.time > time) break;
      bpm = event.bpm;
    }
    return bpm;
  }

  getTimeSignatureAtTime(time: number): TimeSignatureEvent {
    let active: TimeSignatureEvent = this.song.timeSignatureEvents[0] ?? {
      time: 0,
      numerator: 4,
      denominator: 4,
      measure: 0,
    };
    for (const event of this.song.timeSignatureEvents) {
      if (event.time > time) break;
      active = event;
    }
    return active;
  }

  getMeasureAtTime(time: number): number {
    return this.measureMap.getMeasureAtTime(time);
  }

  getTimeAtMeasure(measure: number): number {
    return this.measureMap.getTimeAtMeasure(measure);
  }

  getBeatInMeasureAtTime(time: number): number {
    const sig = this.getTimeSignatureAtTime(time);
    return this.measureMap.getBeatInMeasure(time, sig.numerator);
  }

  getKeySignatureAtTime(time: number) {
    return getActiveKeySignature(time, this.song.keySignatureEvents);
  }

  private startIndexFor(time: number): number {
    return lowerBound(this.song.notes, time - LOOKBEHIND_SECONDS, (n) => n.time);
  }

  /** Notes whose [time, endTime] span contains `time`. Bounded scan, safe for huge songs. */
  getActiveNotesAt(time: number): NoteEvent[] {
    const active: NoteEvent[] = [];
    const notes = this.song.notes;
    for (let i = this.startIndexFor(time); i < notes.length; i++) {
      const note = notes[i] as NoteEvent;
      if (note.time > time) break;
      if (note.endTime >= time) active.push(note);
    }
    return active;
  }

  /** Like `getActiveNotesAt`, but a note stays "sounding" through its sustain-pedal-extended release — used for keyboard key glow. */
  getSoundingNotesAt(time: number): NoteEvent[] {
    const sounding: NoteEvent[] = [];
    const notes = this.song.notes;
    for (let i = this.startIndexFor(time); i < notes.length; i++) {
      const note = notes[i] as NoteEvent;
      if (note.time > time) break;
      if (note.effectiveEndTime >= time) sounding.push(note);
    }
    return sounding;
  }

  getCurrentChordAt(time: number): DetectedChord | null {
    const active = this.getActiveNotesAt(time);
    if (active.length < 2) return null;
    return detectChord(active.map((n) => n.midi));
  }

  /** Notes starting within [time, time + lookaheadSeconds), sorted by start time. */
  getUpcomingNotes(time: number, lookaheadSeconds: number): NoteEvent[] {
    const end = time + lookaheadSeconds;
    const result: NoteEvent[] = [];
    const notes = this.song.notes;
    const startIdx = lowerBound(notes, time, (n) => n.time);
    for (let i = startIdx; i < notes.length; i++) {
      const note = notes[i] as NoteEvent;
      if (note.time > end) break;
      result.push(note);
    }
    return result;
  }
}
