import type { Hand, HandHint, MidiTrackData, NoteEvent } from '@/types';
import { clusterNotesIntoChords } from './chordDetection';

const MIN_SPLIT_GAP_SEMITONES = 4;
const DEFAULT_THRESHOLD_MIDI = 60; // middle C

function averagePitch(notes: readonly NoteEvent[]): number {
  if (notes.length === 0) return DEFAULT_THRESHOLD_MIDI;
  const sum = notes.reduce((acc, n) => acc + n.midi, 0);
  return sum / notes.length;
}

function median(values: number[]): number {
  if (values.length === 0) return DEFAULT_THRESHOLD_MIDI;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted[mid];
  if (midValue === undefined) return DEFAULT_THRESHOLD_MIDI;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + midValue) / 2 : midValue;
}

/**
 * Assigns each note in `notes` to a hand.
 *
 * Two strategies are used depending on the source material:
 *  - If the song was authored with exactly two melodic tracks (the common
 *    convention for piano MIDI exports, treble/bass), each track is assigned
 *    wholesale to the hand matching its average pitch.
 *  - Otherwise, a pitch-gap clustering heuristic splits simultaneity clusters
 *    at their widest interior gap, falling back to a global median threshold
 *    for notes that don't cluster with anything.
 *
 * Mutates `note.hand` in place and returns the inferred `handHint` per track.
 */
export function detectHands(tracks: readonly MidiTrackData[], allNotes: NoteEvent[]): Map<number, HandHint> {
  const melodicTracks = tracks.filter((t) => !t.instrument.percussion && t.notes.length > 0);
  const trackHints = new Map<number, HandHint>();

  if (melodicTracks.length === 2) {
    const [a, b] = melodicTracks as [MidiTrackData, MidiTrackData];
    const avgA = averagePitch(a.notes);
    const avgB = averagePitch(b.notes);
    const rightTrack = avgA >= avgB ? a : b;
    const leftTrack = avgA >= avgB ? b : a;
    trackHints.set(rightTrack.index, 'right');
    trackHints.set(leftTrack.index, 'left');
    for (const note of rightTrack.notes) note.hand = 'right';
    for (const note of leftTrack.notes) note.hand = 'left';
    return trackHints;
  }

  const globalThreshold = clampThreshold(median(allNotes.map((n) => n.midi)));
  const clusters = clusterNotesIntoChords(allNotes, 0.05);

  for (const cluster of clusters) {
    const sorted = [...cluster.notes].sort((a, b) => a.midi - b.midi);
    let splitIndex = -1;
    let widestGap = MIN_SPLIT_GAP_SEMITONES;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const gap = curr.midi - prev.midi;
      if (gap >= widestGap) {
        widestGap = gap;
        splitIndex = i;
      }
    }

    if (splitIndex === -1) {
      const hand: Hand = averagePitch(sorted) >= globalThreshold ? 'right' : 'left';
      for (const note of sorted) note.hand = hand;
    } else {
      for (let i = 0; i < sorted.length; i++) {
        sorted[i]!.hand = i < splitIndex ? 'left' : 'right';
      }
    }
  }

  for (const track of tracks) {
    if (track.notes.length === 0) {
      trackHints.set(track.index, 'unknown');
      continue;
    }
    const rightCount = track.notes.filter((n) => n.hand === 'right').length;
    const leftCount = track.notes.length - rightCount;
    if (rightCount > 0 && leftCount > 0) trackHints.set(track.index, 'both');
    else trackHints.set(track.index, rightCount > 0 ? 'right' : 'left');
  }

  return trackHints;
}

function clampThreshold(value: number): number {
  return Math.min(72, Math.max(48, value));
}

/** Manually reassigns every note within [startTime, endTime] to `hand`. Used by manual hand-split editing. */
export function reassignHandRange(notes: NoteEvent[], startTime: number, endTime: number, hand: Hand): void {
  for (const note of notes) {
    if (note.time >= startTime && note.time <= endTime) {
      note.hand = hand;
    }
  }
}
