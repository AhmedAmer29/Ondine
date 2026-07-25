import { Application, Container, Rectangle } from 'pixi.js';
import type { CameraState, CustomizationSettings, NoteJudgement, ParsedSong } from '@/types';
import { SongQuery } from '@/midi/songQuery';
import { computeKeyboardLayout, type KeyboardLayout } from '@/renderer/keyboardGeometry';
import { NotesLayer } from '@/renderer/NotesLayer';
import { KeyboardLayer, type ActiveKeyState } from '@/renderer/KeyboardLayer';
import { BackgroundLayer } from '@/renderer/BackgroundLayer';
import { Camera } from '@/renderer/Camera';

const BASE_KEYBOARD_HEIGHT = 140;

/**
 * A non-interactive, deterministic sibling to `PianoFlowRenderer`: given an
 * exact song time, renders exactly one frame at an arbitrary target
 * resolution and hands back the pixels. Used by the PNG-sequence and GIF
 * exporters, which need frame-accurate output decoupled from real time and
 * from the on-screen canvas the user is looking at.
 */
export class OfflineRenderer {
  private readonly app: Application;
  private readonly world: Container;
  private readonly background: BackgroundLayer;
  private readonly notesLayer: NotesLayer;
  private readonly keyboardLayer: KeyboardLayer;
  private readonly camera: Camera;

  private readonly settings: CustomizationSettings;
  private readonly cameraState: CameraState;
  private query: SongQuery;
  private keyboardLayout: KeyboardLayout;
  private strikeLineY = 0;
  private readonly width: number;
  private readonly frame: Rectangle;

  private constructor(
    app: Application,
    song: ParsedSong,
    settings: CustomizationSettings,
    cameraState: CameraState,
    width: number,
    height: number,
    transparent: boolean,
  ) {
    this.app = app;
    this.settings = settings;
    this.cameraState = cameraState;
    this.width = width;
    // `extract` has no notion of "the canvas viewport" on its own — without an explicit frame it
    // extracts the target container's own bounding box, which for a falling-notes highway is
    // taller than the visible strike-line area (notes still animating in above it). That's what
    // let frames leak content past the intended crop.
    this.frame = new Rectangle(0, 0, width, height);
    this.world = new Container();
    this.background = new BackgroundLayer();
    this.notesLayer = new NotesLayer(settings);
    this.keyboardLayer = new KeyboardLayer();
    this.camera = new Camera();
    this.query = new SongQuery(song);

    this.notesLayer.setSong(song);

    this.world.addChild(this.notesLayer.container, this.keyboardLayer.container);
    if (!transparent) this.app.stage.addChild(this.background.container);
    this.app.stage.addChild(this.world);

    this.keyboardLayout = computeKeyboardLayout(width);
    const keyboardHeight = BASE_KEYBOARD_HEIGHT * (height / 900);
    this.keyboardLayer.rebuild(this.keyboardLayout, keyboardHeight, settings.keyboardColor);
    this.strikeLineY = height - keyboardHeight;

    this.notesLayer.container.position.set(0, 0);
    this.keyboardLayer.container.position.set(0, this.strikeLineY);

    if (!transparent) this.background.resize(width, height, settings);
  }

  static async create(
    song: ParsedSong,
    settings: CustomizationSettings,
    cameraState: CameraState,
    width: number,
    height: number,
    transparent: boolean,
  ): Promise<OfflineRenderer> {
    const app = new Application();
    await app.init({
      width,
      height,
      backgroundAlpha: transparent ? 0 : 1,
      antialias: true,
      resolution: 1,
      autoStart: false,
      preference: 'webgl',
    });
    app.ticker.stop();
    return new OfflineRenderer(app, song, settings, cameraState, width, height, transparent);
  }

  /** Renders the frame at `time` (seconds) and returns a PNG data URL. */
  async renderFrameToPng(time: number): Promise<string> {
    this.renderFrame(time);
    return this.app.renderer.extract.base64({ target: this.app.stage, format: 'png', frame: this.frame });
  }

  /** Renders the frame at `time` and returns the backing canvas directly — cheaper than PNG round-tripping for GIF encoding. */
  renderFrameToCanvas(time: number): HTMLCanvasElement {
    this.renderFrame(time);
    return this.app.renderer.extract.canvas({ target: this.app.stage, frame: this.frame }) as HTMLCanvasElement;
  }

  private renderFrame(time: number): void {
    this.background.update(0);

    this.notesLayer.update(
      {
        currentTime: time,
        layout: this.keyboardLayout,
        strikeLineY: this.strikeLineY,
        zoom: this.cameraState.highwayZoom,
        selectedNoteId: null,
        practiceHandMode: 'both',
        awaitingNoteIds: EMPTY_SET,
        judgements: EMPTY_MAP,
      },
      0,
    );

    const soundingByMidi = new Map<number, ActiveKeyState>();
    for (const note of this.query.getSoundingNotesAt(time)) {
      const existing = soundingByMidi.get(note.midi);
      if (!existing || note.velocity > existing.velocity) {
        soundingByMidi.set(note.midi, { velocity: note.velocity, hand: note.hand, pedalOnly: time > note.endTime });
      }
    }
    this.keyboardLayer.update(soundingByMidi, 999, {
      left: this.settings.leftHandGradient.to,
      right: this.settings.rightHandGradient.to,
    });

    this.camera.apply(this.world, this.keyboardLayer.totalWidth, this.strikeLineY, this.width);

    this.app.render();
  }

  destroy(): void {
    this.notesLayer.destroy();
    this.keyboardLayer.destroy();
    this.background.destroy();
    this.app.destroy(true, { children: true });
  }
}

const EMPTY_SET: ReadonlySet<number> = new Set();
const EMPTY_MAP: ReadonlyMap<number, NoteJudgement> = new Map();
