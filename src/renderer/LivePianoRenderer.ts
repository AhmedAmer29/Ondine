import { Application, Container } from 'pixi.js';
import type { CustomizationSettings } from '@/types';
import { hexToNumber } from '@/utils/color';
import { getLiveInputController, type LiveNoteEvent } from '@/live/LiveInputController';
import { TITLE_BAR_HEIGHT_PX } from './layoutConstants';
import { computeKeyboardLayout, type KeyboardLayout } from './keyboardGeometry';
import { KeyboardLayer, type ActiveKeyState } from './KeyboardLayer';
import { HitEffectsLayer, type ActiveGlowTarget } from './HitEffectsLayer';
import { LiveNotesLayer } from './LiveNotesLayer';
import { BackgroundLayer } from './BackgroundLayer';

// Mirrors PianoFlowRenderer's BASE_KEYBOARD_HEIGHT — kept as a separate constant deliberately (see
// LivePianoRenderer's class doc comment for why this class doesn't share a base with that one).
const BASE_KEYBOARD_HEIGHT = 140;
const LIVE_PIXELS_PER_SECOND = 130;
// Live mode has no song to split into hands against, so it deliberately ignores the
// left/right customization colors (unlike Play mode) and renders every key/note in one color.
const LIVE_MONO_COLOR_HEX = '#f97316';

/**
 * A second, much smaller Pixi host for Live mode: composes the same `KeyboardLayer` and
 * `HitEffectsLayer` `PianoFlowRenderer` uses (both already song/timeline-agnostic) with
 * `LiveNotesLayer` instead of the falling-notes `NotesLayer`, and has no `Camera`/scroll-zoom
 * concept at all — Live mode is always just the keyboard, centered, full width.
 *
 * This deliberately duplicates `PianoFlowRenderer.mount()`'s Pixi-hosting boilerplate (viewport
 * sizing, `position: fixed` canvas, resize-poll fallback) rather than extracting a shared base
 * class. That boilerplate is proven-stable, rarely-touched infrastructure; coupling two renderer
 * lifecycles through an abstraction while both are still new is the riskier move. If you fix a
 * resize/sizing bug here, check whether `PianoFlowRenderer` needs the same fix, and vice versa.
 */
export class LivePianoRenderer {
  private readonly app: Application;
  private readonly world: Container;
  private readonly background: BackgroundLayer;
  private readonly keyboardLayer: KeyboardLayer;
  private readonly hitEffectsLayer: HitEffectsLayer;
  private readonly liveNotesLayer: LiveNotesLayer;

  private settings: CustomizationSettings;
  private keyboardLayout: KeyboardLayout | null = null;
  private strikeLineY = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private initialized = false;
  private destroyed = false;

  private readonly activeKeyStates = new Map<number, ActiveKeyState>();
  private unsubscribeLiveInput: (() => void) | null = null;
  private lastFrameTimestamp = 0;
  private resizePollAccumulator = 0;

  constructor(settings: CustomizationSettings) {
    this.settings = settings;
    this.app = new Application();
    this.world = new Container();
    this.background = new BackgroundLayer();
    this.keyboardLayer = new KeyboardLayer();
    this.hitEffectsLayer = new HitEffectsLayer();
    this.liveNotesLayer = new LiveNotesLayer();

    this.keyboardLayer.onKeyDown = (midi) => getLiveInputController().noteOn(midi, 0.85, 'mouse');
    this.keyboardLayer.onKeyUp = (midi) => getLiveInputController().noteOff(midi, 'mouse');
  }

  async mount(element: HTMLElement): Promise<void> {
    const initialSize = this.measureTargetSize();
    await this.app.init({
      width: initialSize.width,
      height: initialSize.height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      preference: 'webgl',
    });

    if (this.destroyed) return;

    const canvasStyle = this.app.canvas.style;
    canvasStyle.position = 'fixed';
    canvasStyle.left = '0';
    canvasStyle.top = `${TITLE_BAR_HEIGHT_PX}px`;
    canvasStyle.display = 'block';
    element.appendChild(this.app.canvas);

    this.world.addChild(this.liveNotesLayer.container, this.keyboardLayer.container, this.hitEffectsLayer.container);
    this.app.stage.addChild(this.background.container, this.world);

    this.app.ticker.add(this.onTick);
    this.app.renderer.on('resize', this.handleResize);
    window.addEventListener('resize', this.handleWindowResize);

    this.lastWidth = initialSize.width;
    this.lastHeight = initialSize.height;
    this.initialized = true;
    this.applyLayoutForCurrentSize();
    this.background.resize(this.lastWidth, this.lastHeight, this.settings);

    this.unsubscribeLiveInput = getLiveInputController().subscribe(this.handleLiveNoteEvent);
  }

  private measureTargetSize(): { width: number; height: number } {
    return { width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight - TITLE_BAR_HEIGHT_PX) };
  }

  private readonly handleWindowResize = (): void => {
    this.syncCanvasSizeToViewport();
  };

  private syncCanvasSizeToViewport(): void {
    const { width, height } = this.measureTargetSize();
    if (Math.abs(width - this.lastWidth) < 1 && Math.abs(height - this.lastHeight) < 1) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.app.renderer.resize(width, height);
  }

  private readonly handleResize = (): void => {
    this.applyLayoutForCurrentSize();
  };

  private applyLayoutForCurrentSize(): void {
    if (this.lastWidth <= 0 || this.lastHeight <= 0) return;
    this.background.resize(this.lastWidth, this.lastHeight, this.settings);
    this.keyboardLayout = computeKeyboardLayout(this.lastWidth);
    this.keyboardLayer.rebuild(this.keyboardLayout, BASE_KEYBOARD_HEIGHT, this.settings.keyboardColor);
    this.strikeLineY = this.lastHeight - BASE_KEYBOARD_HEIGHT;
    this.keyboardLayer.container.position.set(0, this.strikeLineY);

    const layout = this.keyboardLayout;
    this.liveNotesLayer.setLayoutSource(
      (midi) => layout.byMidi.get(midi)?.centerX ?? null,
      (midi) => layout.byMidi.get(midi)?.width ?? 12,
    );
  }

  setCustomization(settings: CustomizationSettings): void {
    this.settings = settings;
    this.liveNotesLayer.setHandColors({ left: LIVE_MONO_COLOR_HEX, right: LIVE_MONO_COLOR_HEX });
    this.applyLayoutForCurrentSize();
    this.background.updateCustomization(settings);
  }

  private handColorHex(_hand: ActiveKeyState['hand']): string {
    return LIVE_MONO_COLOR_HEX;
  }

  private readonly handleLiveNoteEvent = (event: LiveNoteEvent): void => {
    if (event.on) {
      this.activeKeyStates.set(event.midi, { velocity: event.velocity, hand: event.hand, pedalOnly: false });
      this.liveNotesLayer.noteOn(event.midi, event.timestamp, event.hand);
      const x = this.keyboardLayer.getKeyCenterX(event.midi);
      if (x !== null) this.hitEffectsLayer.trigger(x, this.strikeLineY, hexToNumber(this.handColorHex(event.hand)));
      this.keyboardLayer.triggerImpactBounce(event.midi);
    } else {
      this.activeKeyStates.delete(event.midi);
      this.liveNotesLayer.noteOff(event.midi, event.timestamp);
    }
  };

  private readonly onTick = (): void => {
    const now = performance.now();
    const dt = this.lastFrameTimestamp ? Math.min(0.1, (now - this.lastFrameTimestamp) / 1000) : 1 / 60;
    this.lastFrameTimestamp = now;

    this.resizePollAccumulator += dt;
    if (this.resizePollAccumulator > 0.5) {
      this.resizePollAccumulator = 0;
      this.syncCanvasSizeToViewport();
    }

    this.renderFrame(dt);
  };

  private renderFrame(dt: number): void {
    if (!this.keyboardLayout) return;
    const nowSeconds = performance.now() / 1000;

    this.keyboardLayer.update(this.activeKeyStates, dt, { left: LIVE_MONO_COLOR_HEX, right: LIVE_MONO_COLOR_HEX });
    this.liveNotesLayer.update(nowSeconds, this.strikeLineY, LIVE_PIXELS_PER_SECOND);
    this.hitEffectsLayer.syncSustainedGlows(this.buildActiveGlowTargets(), this.strikeLineY, dt);
    this.hitEffectsLayer.update(dt);
  }

  private buildActiveGlowTargets(): Map<number, ActiveGlowTarget> {
    const targets = new Map<number, ActiveGlowTarget>();
    for (const [midi, state] of this.activeKeyStates) {
      const x = this.keyboardLayer.getKeyCenterX(midi);
      if (x === null) continue;
      targets.set(midi, { x, color: hexToNumber(this.handColorHex(state.hand)) });
    }
    return targets;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (!this.initialized) return;

    getLiveInputController().releaseAll();
    this.unsubscribeLiveInput?.();
    window.removeEventListener('resize', this.handleWindowResize);
    this.app.renderer.off('resize', this.handleResize);
    this.app.ticker.remove(this.onTick);
    this.keyboardLayer.destroy();
    this.hitEffectsLayer.destroy();
    this.liveNotesLayer.destroy();
    this.app.destroy(true, { children: true });
  }
}
