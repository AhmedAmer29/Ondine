import { PIANO_MAX_MIDI, PIANO_MIN_MIDI, isWhiteKey } from '@/midi/noteUtils';

export interface KeyGeometry {
  readonly midi: number;
  readonly isBlack: boolean;
  /** Left edge in pixels, relative to the keyboard's own origin. */
  readonly x: number;
  readonly width: number;
  readonly centerX: number;
}

export interface KeyboardLayout {
  readonly totalWidth: number;
  readonly whiteKeyWidth: number;
  readonly blackKeyWidth: number;
  readonly keys: readonly KeyGeometry[];
  readonly byMidi: ReadonlyMap<number, KeyGeometry>;
}

/**
 * Position of each key, expressed in units of "white key width" measured from
 * the C at the start of its octave. White keys use their left edge; black keys
 * use their center, which is the true boundary between the two white keys they
 * sit between (e.g. C# is centered exactly on the C|D seam) — this is what
 * makes a black key visually straddle both of its neighbors instead of
 * floating entirely over just one of them.
 */
const KEY_POSITION_FROM_OCTAVE_START: Readonly<Record<number, number>> = {
  0: 0, // C
  1: 1, // C# — centered on the C|D boundary
  2: 1, // D
  3: 2, // D# — centered on the D|E boundary
  4: 2, // E
  5: 3, // F
  6: 4, // F# — centered on the F|G boundary
  7: 4, // G
  8: 5, // G# — centered on the G|A boundary
  9: 5, // A
  10: 6, // A# — centered on the A|B boundary
  11: 6, // B
};

function globalPosition(midi: number): number {
  const octave = Math.floor(midi / 12);
  const pitchClass = midi - octave * 12;
  return octave * 7 + (KEY_POSITION_FROM_OCTAVE_START[pitchClass] ?? 0);
}

/**
 * Computes real-piano-proportioned x/width for every key from `minMidi` to `maxMidi`
 * (default: the full 88-key range), fit to `totalWidth` pixels. Shared by the
 * falling-notes layer and the on-screen keyboard so notes land exactly above their key.
 */
export function computeKeyboardLayout(
  totalWidth: number,
  minMidi: number = PIANO_MIN_MIDI,
  maxMidi: number = PIANO_MAX_MIDI,
): KeyboardLayout {
  let whiteKeyCount = 0;
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (isWhiteKey(midi)) whiteKeyCount++;
  }
  const whiteKeyWidth = whiteKeyCount > 0 ? totalWidth / whiteKeyCount : totalWidth;
  const blackKeyWidth = whiteKeyWidth * 0.62;
  const originOffset = globalPosition(minMidi);

  const keys: KeyGeometry[] = [];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const local = globalPosition(midi) - originOffset;
    const isBlack = !isWhiteKey(midi);
    if (isBlack) {
      const centerX = local * whiteKeyWidth;
      const x = centerX - blackKeyWidth / 2;
      keys.push({ midi, isBlack: true, x, width: blackKeyWidth, centerX });
    } else {
      const x = local * whiteKeyWidth;
      keys.push({ midi, isBlack: false, x, width: whiteKeyWidth, centerX: x + whiteKeyWidth / 2 });
    }
  }

  const byMidi = new Map(keys.map((k) => [k.midi, k]));
  return { totalWidth: whiteKeyCount * whiteKeyWidth, whiteKeyWidth, blackKeyWidth, keys, byMidi };
}
