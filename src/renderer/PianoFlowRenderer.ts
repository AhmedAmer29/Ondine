import { Application, Container } from 'pixi.js';
import type { CameraState, CustomizationSettings, NoteJudgement, ParsedSong, PracticeHandMode } from '@/types';
import { SongQuery } from '@/midi/songQuery';
import { hexToNumber } from '@/utils/color';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';
import { TITLE_BAR_HEIGHT_PX } from './layoutConstants';
import { computeKeyboardLayout, type KeyboardLayout } from './keyboardGeometry';
import { NotesLayer } from './NotesLayer';
import { KeyboardLayer, type ActiveKeyState } from './KeyboardLayer';
import { BackgroundLayer } from './BackgroundLayer';
import { HitEffectsLayer, type ActiveGlowTarget } from './HitEffectsLayer';
import { Camera } from './Camera';

/** Notes below middle C read as "left hand" for clicked/manually-played keys, purely for coloring — there's no real hand to infer. */
const MANUAL_HAND_SPLIT_MIDI = 60;

export type FrameRateTarget = 30 | 60 | 120 | 144 | null;

export interface RenderStats {
  fps: number;
  frameTimeMs: number;
  visibleNoteCount: number;
}

const BASE_KEYBOARD_HEIGHT = 140;
/** How long a key is allowed to sit outside the "sounding notes" query before it's treated as truly released. */
const KEY_RELEASE_GRACE_SECONDS = 0.1;
/** A currentTime jump bigger than this between frames is a seek/scrub, not normal playback — don't fire impact VFX for every note it skipped over. */
const MAX_STEP_FOR_ATTACK_DETECTION_SECONDS = 0.5;

/**
 * Owns the PixiJS application and every visual layer. Runs its own ticker loop
 * driven by the audio clock (`PlaybackEngine.getCurrentTime()`), completely
 * outside React's render cycle — React only ever calls the setter methods
 * below in response to store changes, never on every frame.
 */
export class PianoFlowRenderer {
  private readonly app: Application;
  private readonly world: Container;
  private readonly background: BackgroundLayer;
  private readonly notesLayer: NotesLayer;
  private readonly keyboardLayer: KeyboardLayer;
  private readonly hitEffectsLayer: HitEffectsLayer;
  private readonly camera: Camera;

  private query: SongQuery | null = null;
  private settings: CustomizationSettings;
  private cameraState: CameraState;
  private practiceHandMode: PracticeHandMode = 'both';
  private selectedNoteId: number | null = null;
  private awaitingNoteIds: ReadonlySet<number> = EMPTY_NOTE_SET;
  private practiceJudgements: ReadonlyMap<number, NoteJudgement> = EMPTY_JUDGEMENT_MAP;

  private keyboardLayout: KeyboardLayout | null = null;
  private strikeLineY = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private initialized = false;
  private destroyed = false;
  private sizeOverride: { width: number; height: number } | null = null;

  private getCurrentTime: () => number = () => 0;
  private targetFrameInterval = 0;
  private frameAccumulator = 0;
  private fpsSamples: number[] = [];
  private stats: RenderStats = { fps: 0, frameTimeMs: 0, visibleNoteCount: 0 };
  private lastFrameTimestamp = 0;
  private readonly activeKeyStates = new Map<number, ActiveKeyState>();
  private readonly lastSoundingAtByMidi = new Map<number, number>();
  /** Keys currently held via a click/tap or the PC keyboard, layered on top of the song-driven active states every frame. */
  private readonly manualKeyStates = new Map<number, ActiveKeyState>();
  private lastRenderedTime: number | null = null;
  private resizePollAccumulator = 0;

  constructor(settings: CustomizationSettings, cameraState: CameraState) {
    this.settings = settings;
    this.cameraState = cameraState;
    this.app = new Application();
    this.world = new Container();
    this.background = new BackgroundLayer();
    this.notesLayer = new NotesLayer(settings);
    this.keyboardLayer = new KeyboardLayer();
    this.hitEffectsLayer = new HitEffectsLayer();
    this.camera = new Camera();
    this.keyboardLayer.onKeyDown = this.handleManualKeyDown;
    this.keyboardLayer.onKeyUp = this.handleManualKeyUp;
  }

  /** A key was clicked/tapped — play it and show the same press + impact feedback a real note gets. */
  private readonly handleManualKeyDown = (midi: number): void => {
    if (this.manualKeyStates.has(midi)) return;
    const hand: ActiveKeyState['hand'] = midi < MANUAL_HAND_SPLIT_MIDI ? 'left' : 'right';
    this.manualKeyStates.set(midi, { velocity: 0.85, hand, pedalOnly: false });
    this.fireHitEffect(midi, hand);
    getPlaybackEngine().previewNoteOn(midi);
  };

  private readonly handleManualKeyUp = (midi: number): void => {
    if (!this.manualKeyStates.delete(midi)) return;
    getPlaybackEngine().previewNoteOff(midi);
  };

  /**
   * `sizeOverride` is for the video exporter: it mounts into a detached,
   * off-screen container pre-sized to the chosen export resolution and needs
   * the canvas to match *that* exactly, not the live app window. Leave it
   * unset for the normal in-app mount, which always fills the real viewport.
   */
  async mount(element: HTMLElement, resolutionOverride?: number, sizeOverride?: { width: number; height: number }): Promise<void> {
    this.sizeOverride = sizeOverride ?? null;
    const initialSize = this.measureTargetSize();
    await this.app.init({
      width: initialSize.width,
      height: initialSize.height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: resolutionOverride === undefined,
      resolution: resolutionOverride ?? Math.min(2, window.devicePixelRatio || 1),
      preference: 'webgl',
    });

    // A caller may destroy() us while `app.init()` was in flight (React Strict
    // Mode mounts, unmounts, and remounts effects synchronously in dev).
    if (this.destroyed) return;

    const canvasStyle = this.app.canvas.style;
    if (sizeOverride) {
      // Stay inside the caller's (off-screen) container instead of jumping to
      // the real viewport, so the export renderer never becomes visible.
      canvasStyle.position = 'absolute';
      canvasStyle.left = '0';
      canvasStyle.top = '0';
    } else {
      // Pin to the viewport with `position: fixed`, not to the parent
      // container. A container's *computed* size can end up wrong for
      // reasons entirely outside this class's control — a flexbox edge case,
      // a resize a nested absolutely-positioned ancestor doesn't propagate,
      // DPI rounding in an embedded WebView — and every one of those
      // previously left the canvas visually smaller than the window.
      // `position: fixed` relative to the viewport has no such ancestor
      // chain to get wrong: the browser itself guarantees these bounds,
      // unconditionally.
      canvasStyle.position = 'fixed';
      canvasStyle.left = '0';
      canvasStyle.top = `${TITLE_BAR_HEIGHT_PX}px`;
    }
    // Deliberately NOT setting `width`/`height` here (not even 'auto'): a
    // <canvas> is a replaced element, so `width/height: auto` resolves to its
    // *intrinsic* size — the internal pixel buffer, which is the logical size
    // times `resolution` (2x on most displays). That silently doubled the
    // rendered size and clipped it to one quarter of the viewport, which is
    // exactly the "empty on the right/bottom" bug. `autoDensity: true` (set
    // above) already makes Pixi itself write the correct literal `px` width
    // and height onto this element, both now and on every future
    // `renderer.resize()` call — so the right fix is to leave it alone.
    canvasStyle.display = 'block';
    element.appendChild(this.app.canvas);

    this.world.addChild(this.notesLayer.container, this.keyboardLayer.container, this.hitEffectsLayer.container);
    this.app.stage.addChild(this.background.container, this.world);

    this.app.ticker.add(this.onTick);
    this.app.renderer.on('resize', this.handleResize);

    // Belt-and-suspenders resize detection on top of the CSS fix above, so the
    // renderer's *internal* layout (keyboard width, note lanes) always matches
    // what's actually on screen: a window-resize listener (the fundamental,
    // universally-fired browser event) plus a cheap poll inside the existing
    // per-frame ticker (see `onTick`) as a final fallback that can't miss a
    // resize regardless of which event the host under-delivers on.
    window.addEventListener('resize', this.handleWindowResize);

    this.lastWidth = initialSize.width;
    this.lastHeight = initialSize.height;
    this.initialized = true;
    this.applyLayoutForCurrentSize();
  }

  /** The one true source of "how big should the visualizer be" — the viewport itself, never a container element's computed layout — unless an explicit export size was requested. */
  private measureTargetSize(): { width: number; height: number } {
    if (this.sizeOverride) return this.sizeOverride;
    return {
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight - TITLE_BAR_HEIGHT_PX),
    };
  }

  private readonly handleWindowResize = (): void => {
    this.syncCanvasSizeToViewport();
  };

  private syncCanvasSizeToViewport(): void {
    const { width, height } = this.measureTargetSize();
    // A tolerance, not strict equality, so sub-pixel measurement noise doesn't
    // constantly re-trigger a full layout rebuild.
    if (Math.abs(width - this.lastWidth) < 1 && Math.abs(height - this.lastHeight) < 1) return;
    // Record the size WE asked for, not a readback from the renderer: reading
    // `renderer.width / renderer.resolution` after resizing can round-trip to a
    // value a fraction of a pixel off the original (device-pixel rounding under
    // a fractional devicePixelRatio, e.g. Windows' 125%/150% display scaling).
    // That mismatch alone was enough to exceed the 1px tolerance above on the
    // *next* poll, resizing again, forever — silently rebuilding the entire
    // keyboard and background every ~0.5s and reading as periodic freezes and
    // key-color flicker. Comparing our own requested value against itself next
    // time makes this loop structurally impossible.
    this.lastWidth = width;
    this.lastHeight = height;
    this.app.renderer.resize(width, height);
  }

  setTimeProvider(getCurrentTime: () => number): void {
    this.getCurrentTime = getCurrentTime;
  }

  setSong(song: ParsedSong | null): void {
    this.query = song ? new SongQuery(song) : null;
    this.notesLayer.setSong(song);
    this.rebuildKeyboardLayout();
  }

  setCustomization(settings: CustomizationSettings): void {
    this.settings = settings;
    this.notesLayer.updateCustomization(settings);
    this.background.updateCustomization(settings);
    this.rebuildKeyboardLayout();
  }

  setCameraState(cameraState: CameraState): void {
    this.cameraState = cameraState;
  }

  setPracticeHandMode(mode: PracticeHandMode): void {
    this.practiceHandMode = mode;
  }

  setPracticeAwaitingNotes(ids: ReadonlySet<number>): void {
    this.awaitingNoteIds = ids;
  }

  setPracticeJudgements(judgements: ReadonlyMap<number, NoteJudgement>): void {
    this.practiceJudgements = judgements;
  }

  flashKeyMistake(midi: number): void {
    this.keyboardLayer.flashMistake(midi);
  }

  setSelectedNote(noteId: number | null): void {
    this.selectedNoteId = noteId;
  }

  setTargetFrameRate(fps: FrameRateTarget): void {
    this.targetFrameInterval = fps ? 1 / fps : 0;
  }

  getStats(): RenderStats {
    return this.stats;
  }

  private rebuildKeyboardLayout(): void {
    if (this.lastWidth <= 0 || this.lastHeight <= 0) return;
    this.keyboardLayout = computeKeyboardLayout(this.lastWidth);
    const keyboardHeight = BASE_KEYBOARD_HEIGHT;
    this.keyboardLayer.rebuild(this.keyboardLayout, keyboardHeight, this.settings.keyboardColor);
    // Keys sit flush against the bottom edge — no gap below the keyboard.
    this.strikeLineY = this.lastHeight - keyboardHeight;

    this.notesLayer.container.position.set(0, 0);
    this.keyboardLayer.container.position.set(0, this.strikeLineY);
  }

  /** Fires from the Pixi renderer's own `resize` event, which we only ever trigger ourselves (see `syncCanvasSizeToViewport`) — `lastWidth`/`lastHeight` are already correct by the time this runs. */
  private readonly handleResize = (): void => {
    this.applyLayoutForCurrentSize();
  };

  private applyLayoutForCurrentSize(): void {
    this.background.resize(this.lastWidth, this.lastHeight, this.settings);
    this.rebuildKeyboardLayout();
  }

  private readonly onTick = (): void => {
    const now = performance.now();
    const dt = this.lastFrameTimestamp ? Math.min(0.1, (now - this.lastFrameTimestamp) / 1000) : 1 / 60;
    this.lastFrameTimestamp = now;

    this.trackFps(dt);

    this.resizePollAccumulator += dt;
    if (this.resizePollAccumulator > 0.5) {
      this.resizePollAccumulator = 0;
      this.syncCanvasSizeToViewport();
    }

    if (this.targetFrameInterval > 0) {
      this.frameAccumulator += dt;
      if (this.frameAccumulator < this.targetFrameInterval) return;
      this.frameAccumulator %= this.targetFrameInterval;
    }

    this.renderFrame(dt);
  };

  private renderFrame(dt: number): void {
    const currentTime = this.getCurrentTime();
    const previousTime = this.lastRenderedTime ?? currentTime;
    this.lastRenderedTime = currentTime;

    this.background.update(dt);

    if (this.keyboardLayout) {
      if (this.query) {
        this.notesLayer.update(
          {
            currentTime,
            layout: this.keyboardLayout,
            strikeLineY: this.strikeLineY,
            zoom: this.cameraState.highwayZoom,
            selectedNoteId: this.selectedNoteId,
            practiceHandMode: this.practiceHandMode,
            awaitingNoteIds: this.awaitingNoteIds,
            judgements: this.practiceJudgements,
          },
          dt,
        );
      }

      // Not gated on `this.query`: clicking/tapping a key (or playing it from the PC keyboard)
      // should light it up and sound it even with no song loaded.
      this.updateActiveKeyStates(currentTime, previousTime);
      this.keyboardLayer.update(this.activeKeyStates, dt, {
        left: this.settings.leftHandGradient.to,
        right: this.settings.rightHandGradient.to,
      });
      this.hitEffectsLayer.syncSustainedGlows(this.buildActiveGlowTargets(), this.strikeLineY, dt);
      this.hitEffectsLayer.update(dt);

      this.camera.apply(this.world, this.keyboardLayer.totalWidth, this.strikeLineY, this.lastWidth);
    }

    this.stats.visibleNoteCount = this.activeKeyStates.size;
  }

  private updateActiveKeyStates(currentTime: number, previousTime: number): void {
    const seenThisFrame = new Set<number>();

    if (this.query) {
      const sounding = this.query.getSoundingNotesAt(currentTime);
      // Only a normal small forward step counts as "just struck" — guards a
      // seek/scrub (rewind, or a big forward jump) against firing a flood of
      // impact VFX for every note it skipped over.
      const isNormalForwardStep = currentTime > previousTime && currentTime - previousTime < MAX_STEP_FOR_ATTACK_DETECTION_SECONDS;

      for (const note of sounding) {
        seenThisFrame.add(note.midi);
        this.lastSoundingAtByMidi.set(note.midi, currentTime);
        const existing = this.activeKeyStates.get(note.midi);
        const pedalOnly = currentTime > note.endTime;
        if (!existing || note.velocity >= existing.velocity) {
          this.activeKeyStates.set(note.midi, { velocity: note.velocity, hand: note.hand, pedalOnly });
        }

        // Fire the impact VFX the exact frame this note's own attack time is
        // crossed, keyed off the note's real (midi, time) identity rather than
        // "wasn't in activeKeyStates a moment ago" — a note replayed
        // immediately after release stays continuously "active" through the
        // grace period below, so that older signal could never see it as fresh.
        if (isNormalForwardStep && !pedalOnly && note.time >= previousTime && note.time <= currentTime) {
          this.fireHitEffect(note.midi, note.hand);
        }
      }
    }

    // Manually held keys (click/tap, or the PC keyboard) always win and are protected from the
    // eviction pass below for as long as they're actually held down.
    for (const [midi, state] of this.manualKeyStates) {
      seenThisFrame.add(midi);
      this.lastSoundingAtByMidi.set(midi, currentTime);
      this.activeKeyStates.set(midi, state);
    }

    // Keys linger briefly after their note stops "sounding" this frame before
    // being cleared. Without this, two back-to-back notes on the same pitch
    // (repeated notes, trills) can hit a single-frame gap in the sounding
    // query right at the boundary, snapping the key's color off and back on
    // and reading as a flicker even though musically the note never released.
    for (const midi of this.activeKeyStates.keys()) {
      if (seenThisFrame.has(midi)) continue;
      const lastSoundingAt = this.lastSoundingAtByMidi.get(midi) ?? -Infinity;
      if (Math.abs(currentTime - lastSoundingAt) > KEY_RELEASE_GRACE_SECONDS) {
        this.activeKeyStates.delete(midi);
        this.lastSoundingAtByMidi.delete(midi);
      }
    }
  }

  private fireHitEffect(midi: number, hand: ActiveKeyState['hand']): void {
    const x = this.keyboardLayer.getKeyCenterX(midi);
    if (x !== null) {
      this.hitEffectsLayer.trigger(x, this.strikeLineY, hexToNumber(this.handColorHex(hand)));
    }
    this.keyboardLayer.triggerImpactBounce(midi);
  }

  private handColorHex(hand: ActiveKeyState['hand']): string {
    if (hand === 'left') return this.settings.leftHandGradient.to;
    if (hand === 'right') return this.settings.rightHandGradient.to;
    return '#94a3b8';
  }

  /** The current sounding keys' screen x-position and hand color, for the sustained glow VFX. */
  private buildActiveGlowTargets(): Map<number, ActiveGlowTarget> {
    const targets = new Map<number, ActiveGlowTarget>();
    for (const [midi, state] of this.activeKeyStates) {
      const x = this.keyboardLayer.getKeyCenterX(midi);
      if (x === null) continue;
      targets.set(midi, { x, color: hexToNumber(this.handColorHex(state.hand)) });
    }
    return targets;
  }

  private trackFps(dt: number): void {
    if (dt <= 0) return;
    this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 30) this.fpsSamples.shift();
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.stats.fps = Math.round(avg);
    this.stats.frameTimeMs = Math.round((dt * 1000 + Number.EPSILON) * 100) / 100;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (!this.initialized) return;

    for (const midi of this.manualKeyStates.keys()) getPlaybackEngine().previewNoteOff(midi);
    this.manualKeyStates.clear();

    window.removeEventListener('resize', this.handleWindowResize);
    this.app.renderer.off('resize', this.handleResize);
    this.app.ticker.remove(this.onTick);
    this.notesLayer.destroy();
    this.keyboardLayer.destroy();
    this.hitEffectsLayer.destroy();
    this.background.destroy();
    this.app.destroy(true, { children: true });
  }
}

const EMPTY_NOTE_SET: ReadonlySet<number> = new Set();
const EMPTY_JUDGEMENT_MAP: ReadonlyMap<number, NoteJudgement> = new Map();
