import type { NoteEvent } from '@/types';
import { midiToPitchClass } from './noteUtils';

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface ChordTemplate {
  readonly quality: string;
  readonly suffix: string;
  readonly intervals: readonly number[];
}

/** Interval sets measured in semitones from the root, ordered so richer chords are tried first. */
const CHORD_TEMPLATES: readonly ChordTemplate[] = [
  { quality: 'majorSeventh', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { quality: 'minorSeventh', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { quality: 'dominantSeventh', suffix: '7', intervals: [0, 4, 7, 10] },
  { quality: 'minorMajorSeventh', suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
  { quality: 'halfDiminishedSeventh', suffix: 'm7b5', intervals: [0, 3, 6, 10] },
  { quality: 'diminishedSeventh', suffix: 'dim7', intervals: [0, 3, 6, 9] },
  { quality: 'sixth', suffix: '6', intervals: [0, 4, 7, 9] },
  { quality: 'minorSixth', suffix: 'm6', intervals: [0, 3, 7, 9] },
  { quality: 'major', suffix: '', intervals: [0, 4, 7] },
  { quality: 'minor', suffix: 'm', intervals: [0, 3, 7] },
  { quality: 'diminished', suffix: 'dim', intervals: [0, 3, 6] },
  { quality: 'augmented', suffix: 'aug', intervals: [0, 4, 8] },
  { quality: 'sus4', suffix: 'sus4', intervals: [0, 5, 7] },
  { quality: 'sus2', suffix: 'sus2', intervals: [0, 2, 7] },
  { quality: 'fifth', suffix: '5', intervals: [0, 7] },
];

export interface DetectedChord {
  readonly root: number;
  readonly rootName: string;
  readonly quality: string;
  readonly name: string;
  readonly pitchClasses: readonly number[];
}

function intervalSetFrom(root: number, pitchClasses: readonly number[]): Set<number> {
  return new Set(pitchClasses.map((pc) => (pc - root + 12) % 12));
}

function scoreTemplate(template: ChordTemplate, intervals: Set<number>): number {
  const templateSet = new Set(template.intervals);
  let missing = 0;
  for (const i of templateSet) if (!intervals.has(i)) missing++;
  let extra = 0;
  for (const i of intervals) if (!templateSet.has(i)) extra++;
  return missing * 2 + extra;
}

/**
 * Identifies the chord formed by a set of simultaneously sounding MIDI notes.
 * Returns null when fewer than two distinct pitch classes are present.
 */
export function detectChord(midiNotes: readonly number[]): DetectedChord | null {
  const pitchClasses = Array.from(new Set(midiNotes.map(midiToPitchClass))).sort((a, b) => a - b);
  if (pitchClasses.length < 2) return null;

  const lowestSoundingPc = midiToPitchClass(Math.min(...midiNotes));

  let best: { template: ChordTemplate; root: number; score: number } | null = null;
  for (const root of pitchClasses) {
    const intervals = intervalSetFrom(root, pitchClasses);
    for (const template of CHORD_TEMPLATES) {
      if (template.intervals.length > pitchClasses.length) continue;
      const score = scoreTemplate(template, intervals);
      const rootBonus = root === lowestSoundingPc ? -0.5 : 0;
      const totalScore = score + rootBonus;
      if (!best || totalScore < best.score) {
        best = { template, root, score: totalScore };
      }
    }
  }

  if (!best) return null;
  const rootName = PITCH_CLASS_NAMES[best.root] as string;
  return {
    root: best.root,
    rootName,
    quality: best.template.quality,
    name: `${rootName}${best.template.suffix}`,
    pitchClasses,
  };
}

export interface NoteCluster {
  readonly time: number;
  readonly notes: NoteEvent[];
}

/** Groups notes whose onsets fall within `toleranceSeconds` of one another into simultaneity clusters. */
export function clusterNotesIntoChords(notes: readonly NoteEvent[], toleranceSeconds = 0.06): NoteCluster[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const clusters: NoteCluster[] = [];
  let current: NoteEvent[] = [];
  let clusterStart = 0;

  for (const note of sorted) {
    if (current.length === 0) {
      current = [note];
      clusterStart = note.time;
      continue;
    }
    if (note.time - clusterStart <= toleranceSeconds) {
      current.push(note);
    } else {
      clusters.push({ time: clusterStart, notes: current });
      current = [note];
      clusterStart = note.time;
    }
  }
  if (current.length > 0) clusters.push({ time: clusterStart, notes: current });
  return clusters;
}

/** Marks `isChordRoot` on the lowest note of each 3+ note simultaneity cluster. */
export function markChordRoots(notes: NoteEvent[]): void {
  const clusters = clusterNotesIntoChords(notes);
  for (const cluster of clusters) {
    if (cluster.notes.length < 3) continue;
    let lowest = cluster.notes[0]!;
    for (const note of cluster.notes) {
      if (note.midi < lowest.midi) lowest = note;
    }
    lowest.isChordRoot = true;
  }
}

/** Marks `isMelody` on the highest note within each right-hand simultaneity cluster. */
export function markMelody(notes: NoteEvent[]): void {
  const rightHandNotes = notes.filter((n) => n.hand === 'right');
  const clusters = clusterNotesIntoChords(rightHandNotes);
  for (const cluster of clusters) {
    let highest = cluster.notes[0]!;
    for (const note of cluster.notes) {
      if (note.midi > highest.midi) highest = note;
    }
    highest.isMelody = true;
  }
}
