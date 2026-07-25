import { BitmapText, Container, Graphics } from 'pixi.js';
import type { Hand } from '@/types';
import { midiToPitchName } from '@/midi/noteUtils';
import { hexToNumber } from '@/utils/color';
import type { KeyboardHandColors } from './KeyboardLayer';

interface LiveNoteVisual {
  readonly container: Container;
  readonly body: Graphics;
  readonly label: BitmapText;
  lastWidth: number;
  lastHeight: number;
  lastHand: Hand | null;
}

interface ActiveLiveNote {
  readonly visual: LiveNoteVisual;
  readonly midi: number;
  readonly startTime: number;
  readonly hand: Hand;
  endTime: number | null;
}

const OFFSCREEN_CULL_MARGIN = 60;
const MIN_LABEL_HEIGHT = 16;

/**
 * The Live-mode note visualization: a continuously-scrolling strip-chart, time-mirrored from
 * `NotesLayer`'s falling-toward-the-strike-line model. A held note's top edge recedes upward at a
 * constant rate from the moment it started while its bottom edge stays pinned to the keyboard; on
 * release the bottom edge starts receding too, at the same rate, so the note's height freezes and
 * the whole thing drifts upward and off-screen — making room at the keyboard for the next note on
 * the same key without ever overlapping a still-visible one.
 */
export class LiveNotesLayer {
  readonly container: Container;
  private readonly pool: LiveNoteVisual[] = [];
  private readonly free: LiveNoteVisual[] = [];
  private readonly activeByMidi = new Map<number, ActiveLiveNote>();
  private readonly finished: ActiveLiveNote[] = [];
  private getKeyCenterX: ((midi: number) => number | null) | null = null;
  private getKeyWidth: ((midi: number) => number) | null = null;
  private handColors: KeyboardHandColors = { left: '#3b82f6', right: '#ff8a3d' };

  constructor() {
    this.container = new Container();
  }

  /** Wires this layer to whatever keyboard layout is currently mounted, so it never needs its own copy of key geometry. */
  setLayoutSource(getKeyCenterX: (midi: number) => number | null, getKeyWidth: (midi: number) => number): void {
    this.getKeyCenterX = getKeyCenterX;
    this.getKeyWidth = getKeyWidth;
  }

  setHandColors(colors: KeyboardHandColors): void {
    this.handColors = colors;
  }

  /** A key was just pressed — starts a new growing note. Ignored if `midi` is already sounding (shouldn't happen given the ref-counted source tracking upstream, but stays defensive). */
  noteOn(midi: number, startTime: number, hand: Hand): void {
    if (this.activeByMidi.has(midi)) return;
    const visual = this.acquire();
    this.activeByMidi.set(midi, { visual, midi, startTime, hand, endTime: null });
  }

  /** A key was just released — the note stops growing and joins the scrolling-away queue. */
  noteOff(midi: number, endTime: number): void {
    const active = this.activeByMidi.get(midi);
    if (!active) return;
    this.activeByMidi.delete(midi);
    active.endTime = endTime;
    this.finished.push(active);
  }

  private acquire(): LiveNoteVisual {
    const recycled = this.free.pop();
    if (recycled) {
      recycled.container.visible = true;
      return recycled;
    }
    const body = new Graphics();
    const label = new BitmapText({
      text: '',
      style: { fontFamily: 'Inter, "SF Pro Display", system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: 0xffffff, align: 'center' },
    });
    label.anchor.set(0.5);
    label.alpha = 0.92;
    const container = new Container();
    container.addChild(body, label);
    this.container.addChild(container);
    const visual: LiveNoteVisual = { container, body, label, lastWidth: -1, lastHeight: -1, lastHand: null };
    this.pool.push(visual);
    return visual;
  }

  private release(visual: LiveNoteVisual): void {
    visual.container.visible = false;
    this.free.push(visual);
  }

  /** `now` and `strikeLineY` share the same clock/coordinate space `LivePianoRenderer` uses every frame. */
  update(now: number, strikeLineY: number, pixelsPerSecond: number): void {
    if (!this.getKeyCenterX || !this.getKeyWidth) return;

    for (const active of this.activeByMidi.values()) {
      this.drawNote(active, now, strikeLineY, pixelsPerSecond, true);
    }

    for (let i = this.finished.length - 1; i >= 0; i--) {
      const note = this.finished[i] as ActiveLiveNote;
      const bottomTime = note.endTime as number;
      const bottomY = strikeLineY - (now - bottomTime) * pixelsPerSecond;
      if (bottomY < -OFFSCREEN_CULL_MARGIN) {
        this.release(note.visual);
        this.finished.splice(i, 1);
        continue;
      }
      this.drawNote(note, now, strikeLineY, pixelsPerSecond, false);
    }
  }

  private drawNote(note: ActiveLiveNote, now: number, strikeLineY: number, pixelsPerSecond: number, held: boolean): void {
    const centerX = this.getKeyCenterX?.(note.midi) ?? null;
    if (centerX === null) {
      note.visual.container.visible = false;
      return;
    }
    const width = Math.max(3, (this.getKeyWidth?.(note.midi) ?? 12) - 2);

    const bottomTime = held ? now : (note.endTime as number);
    const topY = strikeLineY - (now - note.startTime) * pixelsPerSecond;
    const bottomY = strikeLineY - (now - bottomTime) * pixelsPerSecond;
    const height = Math.max(4, bottomY - topY);

    const visual = note.visual;
    visual.container.visible = true;
    visual.container.position.set(centerX - width / 2, topY);

    if (visual.lastWidth !== width || visual.lastHeight !== height || visual.lastHand !== note.hand) {
      const color = hexToNumber(note.hand === 'left' ? this.handColors.left : this.handColors.right);
      const radius = Math.min(6, width / 2, height / 2);
      visual.body.clear();
      visual.body.roundRect(0, 0, width, height, radius).fill({ color });
      visual.body.stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
      visual.lastWidth = width;
      visual.lastHeight = height;
      visual.lastHand = note.hand;
    }

    visual.label.text = midiToPitchName(note.midi).pitchClass;
    visual.label.position.set(width / 2, height / 2);
    visual.label.visible = height >= MIN_LABEL_HEIGHT;
  }

  /** Clears every note immediately — used when leaving Live mode or discarding a take. */
  reset(): void {
    for (const active of this.activeByMidi.values()) this.release(active.visual);
    this.activeByMidi.clear();
    for (const note of this.finished) this.release(note.visual);
    this.finished.length = 0;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
