import { Container, FillGradient, Graphics } from 'pixi.js';
import type { Hand } from '@/types';
import type { KeyboardLayout } from './keyboardGeometry';
import { hexToNumber, mixColors } from '@/utils/color';

export interface ActiveKeyState {
  readonly velocity: number;
  readonly hand: Hand;
  /** True if the key is only still sounding because the sustain pedal is holding it, not physically depressed. */
  readonly pedalOnly: boolean;
}

export interface KeyboardHandColors {
  readonly left: string;
  readonly right: string;
}

export type KeyPointerHandler = (midi: number) => void;

interface KeyVisual {
  readonly midi: number;
  readonly isBlack: boolean;
  readonly body: Graphics;
  /** Solid, opaque hand-color fill drawn over `body`; alpha 0 = key shows its normal material. */
  readonly pressOverlay: Graphics;
  readonly pressDepth: number;
  currentOffsetY: number;
  targetOffsetY: number;
  currentPressAlpha: number;
  targetPressAlpha: number;
  currentOverlayColor: number;
  targetOverlayColor: number;
  mistakeFlash: number;
  impactPulse: number;
}

const LERP_RATE = 26;
const WHITE_TOP = 0xfbfaf6;
const WHITE_BOTTOM = 0xe9e5d8;
const BLACK_TOP = 0x2c2c30;
const BLACK_BOTTOM = 0x08080a;
const PEDAL_ONLY_ALPHA = 0.55;
const MISTAKE_COLOR = 0xff3b30;
const NEUTRAL_COLOR = 0x94a3b8;

function lerp(current: number, target: number, dt: number): number {
  const t = Math.min(1, dt * LERP_RATE);
  return current + (target - current) * t;
}

function handColor(hand: Hand, colors: KeyboardHandColors): number {
  if (hand === 'right') return hexToNumber(colors.right);
  if (hand === 'left') return hexToNumber(colors.left);
  return NEUTRAL_COLOR;
}

/**
 * The on-screen 88-key piano. Real proportions, sharp-edged materials with
 * subtle gradient shading, per-key press-depth animation, and a solid
 * hand-color fill that replaces the key's normal material while it sounds —
 * no outline, glow, or additive blending anywhere.
 */
export class KeyboardLayer {
  readonly container: Container;
  private readonly backing: Graphics;
  private readonly whiteLayer: Container;
  private readonly blackLayer: Container;
  private readonly keys = new Map<number, KeyVisual>();

  private whiteGradient: FillGradient;
  private blackGradient: FillGradient;
  private layout: KeyboardLayout | null = null;
  private keyboardHeight = 140;
  private backingColor = 0x0b0d14;

  /** Fired for a physical click/tap on a key — wired up by the owning renderer to play the note. */
  onKeyDown: KeyPointerHandler | null = null;
  onKeyUp: KeyPointerHandler | null = null;

  constructor() {
    this.container = new Container();
    this.backing = new Graphics();
    this.whiteLayer = new Container();
    this.blackLayer = new Container();
    this.whiteGradient = this.buildGradient(WHITE_TOP, WHITE_BOTTOM);
    this.blackGradient = this.buildGradient(BLACK_TOP, BLACK_BOTTOM);
    this.container.addChild(this.backing, this.whiteLayer, this.blackLayer);
  }

  private buildGradient(top: number, bottom: number): FillGradient {
    return new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: top },
        { offset: 1, color: bottom },
      ],
    });
  }

  rebuild(layout: KeyboardLayout, keyboardHeight: number, keyboardColorHex: string): void {
    this.layout = layout;
    this.keyboardHeight = keyboardHeight;
    this.backingColor = hexToNumber(keyboardColorHex);

    this.whiteLayer.removeChildren();
    this.blackLayer.removeChildren();
    this.keys.clear();

    this.backing.clear();
    this.backing.rect(0, 0, layout.totalWidth, keyboardHeight).fill({ color: this.backingColor });

    for (const key of layout.keys) {
      const height = key.isBlack ? keyboardHeight * 0.6 : keyboardHeight;
      const width = key.width;

      const body = new Graphics();
      this.drawKeyBody(body, width, height, key.isBlack);
      body.position.set(key.x, 0);
      body.eventMode = 'static';
      body.cursor = 'pointer';
      const midi = key.midi;
      body.on('pointerdown', () => this.onKeyDown?.(midi));
      body.on('pointerup', () => this.onKeyUp?.(midi));
      body.on('pointerupoutside', () => this.onKeyUp?.(midi));

      const pressOverlay = new Graphics();
      const radius = key.isBlack ? 1.5 : 2;
      pressOverlay.roundRect(1, 0, Math.max(1, width - 2), height, radius).fill({ color: 0xffffff, alpha: 1 });
      pressOverlay.alpha = 0;
      pressOverlay.position.set(key.x, 0);

      const visual: KeyVisual = {
        midi: key.midi,
        isBlack: key.isBlack,
        body,
        pressOverlay,
        pressDepth: key.isBlack ? 3 : 5,
        currentOffsetY: 0,
        targetOffsetY: 0,
        currentPressAlpha: 0,
        targetPressAlpha: 0,
        currentOverlayColor: NEUTRAL_COLOR,
        targetOverlayColor: NEUTRAL_COLOR,
        mistakeFlash: 0,
        impactPulse: 0,
      };
      this.keys.set(key.midi, visual);

      const layer = key.isBlack ? this.blackLayer : this.whiteLayer;
      layer.addChild(body, pressOverlay);
    }
  }

  private drawKeyBody(g: Graphics, width: number, height: number, isBlack: boolean): void {
    g.clear();
    const radius = isBlack ? 1.5 : 2;
    const w = Math.max(1, width - 2);
    g.roundRect(1, 0, w, height, radius).fill({ fill: isBlack ? this.blackGradient : this.whiteGradient });

    if (isBlack) {
      // A thin glossy sheen near the top, like lacquered ebony catching light.
      g.roundRect(1, height * 0.04, w, Math.max(2, height * 0.05), radius).fill({ color: 0xffffff, alpha: 0.16 });
      g.roundRect(1, height - 4, w, 3.5, 1).fill({ color: 0x000000, alpha: 0.45 });
    } else {
      g.roundRect(1, height - 9, w, 6, 1.5).fill({ color: 0x000000, alpha: 0.05 });
    }
    g.stroke({ width: 1, color: 0x000000, alpha: isBlack ? 0.5 : 0.1 });
  }

  update(activeStates: ReadonlyMap<number, ActiveKeyState>, dt: number, handColors: KeyboardHandColors): void {
    for (const visual of this.keys.values()) {
      const state = activeStates.get(visual.midi);
      if (state) {
        visual.targetOffsetY = visual.pressDepth;
        visual.targetPressAlpha = state.pedalOnly ? PEDAL_ONLY_ALPHA : 1;
        visual.targetOverlayColor = handColor(state.hand, handColors);
      } else {
        visual.targetOffsetY = 0;
        visual.targetPressAlpha = 0;
      }

      visual.currentOffsetY = lerp(visual.currentOffsetY, visual.targetOffsetY, dt);
      visual.currentPressAlpha = lerp(visual.currentPressAlpha, visual.targetPressAlpha, dt);
      // Snap instantly on a fresh press (alpha was ~0, nothing visible to cross-fade from) so the
      // hand color reads immediately on attack; only cross-fade when the key is already showing a
      // color and the target changes underneath it, so nothing ever visibly re-tints mid-hold.
      if (visual.currentPressAlpha < 0.05 && visual.targetPressAlpha > 0) {
        visual.currentOverlayColor = visual.targetOverlayColor;
      } else {
        visual.currentOverlayColor = mixColors(visual.currentOverlayColor, visual.targetOverlayColor, Math.min(1, dt * LERP_RATE));
      }
      visual.mistakeFlash = Math.max(0, visual.mistakeFlash - dt * 2.5);
      visual.impactPulse = Math.max(0, visual.impactPulse - dt * 9);

      const bounceOffset = visual.impactPulse * (visual.isBlack ? 1.5 : 2.5);
      visual.body.position.y = visual.currentOffsetY + bounceOffset;
      visual.pressOverlay.position.y = visual.currentOffsetY + bounceOffset;

      const showingMistake = visual.mistakeFlash > 0.02;
      visual.pressOverlay.tint = showingMistake ? MISTAKE_COLOR : visual.currentOverlayColor;
      visual.pressOverlay.alpha = showingMistake ? visual.mistakeFlash : visual.currentPressAlpha;
    }
  }

  /** Triggers a brief red flash on `midi`, used when practice mode detects a wrong note. */
  flashMistake(midi: number): void {
    const visual = this.keys.get(midi);
    if (visual) visual.mistakeFlash = 1;
  }

  /** A brief extra dip beyond the normal press depth, for the instant a falling note lands. */
  triggerImpactBounce(midi: number): void {
    const visual = this.keys.get(midi);
    if (visual) visual.impactPulse = 1;
  }

  /** The on-screen x position of `midi`'s key center, or null if it's outside the current layout. */
  getKeyCenterX(midi: number): number | null {
    return this.layout?.byMidi.get(midi)?.centerX ?? null;
  }

  get totalWidth(): number {
    return this.layout?.totalWidth ?? 0;
  }

  get totalHeight(): number {
    return this.keyboardHeight;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
