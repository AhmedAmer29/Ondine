import { BitmapText, Container, FillGradient, Graphics } from 'pixi.js';
import type { NoteEvent, NoteJudgement } from '@/types';
import { lighten, mixColors, velocityToBrightness } from '@/utils/color';

const MIN_LABEL_HEIGHT = 15;
const LABEL_MAX_SCALE = 1;
const LABEL_MIN_SCALE = 0.3;

/**
 * A pooled visual for a single falling note. Geometry (the rounded rect + label
 * text) is only redrawn when the note it represents, or its pixel dimensions,
 * actually change; every other frame just updates a transform (position, tint),
 * which is what keeps this cheap enough for dense, huge MIDI files.
 */
export class NoteVisual {
  readonly container: Container;
  private readonly body: Graphics;
  private readonly label: BitmapText;

  private assignedNoteId: number | null = null;
  private lastWidth = -1;
  private lastHeight = -1;
  private lastRadius = -1;
  private lastGradient: FillGradient | null = null;
  private labelNaturalWidth = 0;

  constructor() {
    this.container = new Container();
    this.body = new Graphics();
    this.label = new BitmapText({
      text: '',
      style: {
        fontFamily: 'Inter, "SF Pro Display", system-ui, sans-serif',
        fontSize: 15,
        fontWeight: '600',
        fill: 0xffffff,
        align: 'center',
      },
    });
    this.label.anchor.set(0.5);
    this.label.alpha = 0.92;
    this.container.addChild(this.body, this.label);
    this.container.visible = false;
  }

  get noteId(): number | null {
    return this.assignedNoteId;
  }

  assign(
    note: NoteEvent,
    widthPx: number,
    heightPx: number,
    cornerRadius: number,
    gradient: FillGradient,
    showLabel: boolean,
    judgement?: NoteJudgement,
  ): void {
    this.container.visible = true;

    const dimensionsChanged =
      this.lastWidth !== widthPx || this.lastHeight !== heightPx || this.lastRadius !== cornerRadius || this.lastGradient !== gradient;

    if (dimensionsChanged) {
      this.redrawBody(widthPx, heightPx, cornerRadius, gradient);
      this.lastWidth = widthPx;
      this.lastHeight = heightPx;
      this.lastRadius = cornerRadius;
      this.lastGradient = gradient;
    }

    if (this.assignedNoteId !== note.id || dimensionsChanged) {
      this.label.text = note.pitchClass;
      if (this.labelNaturalWidth === 0) {
        this.labelNaturalWidth = this.label.width;
      }
      this.layoutLabel(widthPx, heightPx, showLabel);
    }

    const brightness = velocityToBrightness(note.velocity);
    let tint = mixColors(0x707070, 0xffffff, brightness);
    if (note.isChordRoot) tint = lighten(tint, 0.18);
    if (judgement === 'wrong') tint = mixColors(tint, 0xff3b30, 0.6);
    else if (judgement === 'missed') tint = mixColors(tint, 0x555555, 0.55);
    this.body.tint = tint;

    this.assignedNoteId = note.id;
  }

  setPosition(x: number, y: number): void {
    // The pivot is the note's own center, not its top-left corner, so that
    // `applySelectionPulse`'s scale animation grows/shrinks symmetrically
    // instead of visibly anchoring to one corner. Position is offset by the
    // same half-extents so the note's on-screen top-left still lands at
    // exactly (x, y) at rest (scale 1), same as before this existed.
    const halfW = this.lastWidth / 2;
    const halfH = this.lastHeight / 2;
    this.container.pivot.set(halfW, halfH);
    this.container.position.set(x + halfW, y + halfH);
  }

  /** Applies a gentle sine pulse used for the currently-selected note. */
  applySelectionPulse(phaseSeconds: number): void {
    const pulse = 0.85 + Math.sin(phaseSeconds * 6) * 0.15;
    this.container.scale.set(pulse);
  }

  clearSelectionPulse(): void {
    this.container.scale.set(1);
  }

  release(): void {
    this.container.visible = false;
    this.assignedNoteId = null;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private redrawBody(width: number, height: number, radius: number, gradient: FillGradient): void {
    const r = Math.max(1, Math.min(radius, width / 2, height / 2));
    this.body.clear();
    this.body.roundRect(0, 0, width, height, r).fill({ fill: gradient });
    this.body.stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
  }

  private layoutLabel(width: number, height: number, showLabel: boolean): void {
    this.label.position.set(width / 2, height / 2);
    if (!showLabel || height < MIN_LABEL_HEIGHT || this.labelNaturalWidth === 0) {
      this.label.visible = false;
      return;
    }
    // Scale by width only, never height: width is a constant per pitch (it comes from the key's
    // width), but height is note.duration * pixelsPerSecond, which differs per note instance —
    // scaling on it made two notes of the same pitch but different lengths show the label at
    // visibly different sizes. Height only decides whether the label fits at all (above).
    const fitScale = Math.min(LABEL_MAX_SCALE, (width - 4) / this.labelNaturalWidth);
    if (fitScale < LABEL_MIN_SCALE) {
      this.label.visible = false;
      return;
    }
    this.label.visible = true;
    this.label.scale.set(fitScale);
  }
}
