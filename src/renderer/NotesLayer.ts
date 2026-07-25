import { Container, type FillGradient } from 'pixi.js';
import type { CustomizationSettings, NoteEvent, NoteJudgement, ParsedSong, PracticeHandMode } from '@/types';
import type { KeyboardLayout } from './keyboardGeometry';
import { NoteVisual } from './NoteVisual';
import { createVerticalGradient } from './gradients';
import { lowerBound } from '@/utils/binarySearch';

/** How far behind the playhead a note can start and still potentially be visible (covers long sustained notes). */
const LOOKBEHIND_SECONDS = 20;
const BASE_PIXELS_PER_SECOND = 170;

export interface NotesLayerFrameParams {
  readonly currentTime: number;
  readonly layout: KeyboardLayout;
  readonly strikeLineY: number;
  readonly zoom: number;
  readonly selectedNoteId: number | null;
  readonly practiceHandMode: PracticeHandMode;
  readonly awaitingNoteIds: ReadonlySet<number>;
  readonly judgements: ReadonlyMap<number, NoteJudgement>;
}

/**
 * Renders every currently-relevant falling note using a pool of reusable
 * `NoteVisual` instances. Only notes inside the current time window are ever
 * touched per frame — the song can contain hundreds of thousands of notes
 * without this layer's per-frame cost growing with total song size.
 */
export class NotesLayer {
  readonly container: Container;

  private song: ParsedSong | null = null;
  private readonly pool: NoteVisual[] = [];
  private readonly free: NoteVisual[] = [];
  private readonly activeByNoteId = new Map<number, NoteVisual>();

  private rightGradient: FillGradient;
  private leftGradient: FillGradient;
  private neutralGradient: FillGradient;
  private settings: CustomizationSettings;
  private elapsedForPulse = 0;

  constructor(initialSettings: CustomizationSettings) {
    this.container = new Container();
    this.settings = initialSettings;
    this.rightGradient = createVerticalGradient(initialSettings.rightHandGradient);
    this.leftGradient = createVerticalGradient(initialSettings.leftHandGradient);
    this.neutralGradient = createVerticalGradient({ from: '#9ca3af', to: '#e5e7eb' });
  }

  setSong(song: ParsedSong | null): void {
    this.song = song;
    for (const visual of this.activeByNoteId.values()) this.releaseToPool(visual);
    this.activeByNoteId.clear();
  }

  updateCustomization(settings: CustomizationSettings): void {
    const rightChanged =
      settings.rightHandGradient.from !== this.settings.rightHandGradient.from ||
      settings.rightHandGradient.to !== this.settings.rightHandGradient.to;
    const leftChanged =
      settings.leftHandGradient.from !== this.settings.leftHandGradient.from ||
      settings.leftHandGradient.to !== this.settings.leftHandGradient.to;

    this.settings = settings;
    if (rightChanged) this.rightGradient = createVerticalGradient(settings.rightHandGradient);
    if (leftChanged) this.leftGradient = createVerticalGradient(settings.leftHandGradient);
  }

  getPixelsPerSecond(zoom: number): number {
    return BASE_PIXELS_PER_SECOND * zoom;
  }

  update(params: NotesLayerFrameParams, deltaSeconds: number): void {
    this.elapsedForPulse += deltaSeconds;
    const song = this.song;
    if (!song || song.notes.length === 0) return;

    const pixelsPerSecond = this.getPixelsPerSecond(params.zoom);
    const lookaheadSeconds = params.strikeLineY / pixelsPerSecond + 0.5;
    const lowIdx = lowerBound(song.notes, params.currentTime - LOOKBEHIND_SECONDS, (n) => n.time);
    const cutoffTime = params.currentTime + lookaheadSeconds;

    const stillWanted = new Set<number>();

    for (let i = lowIdx; i < song.notes.length; i++) {
      const note = song.notes[i] as NoteEvent;
      if (note.time > cutoffTime) break;
      if (note.endTime < params.currentTime) continue;
      if (!this.isHandVisible(note, params.practiceHandMode)) continue;

      stillWanted.add(note.id);
      this.renderNote(note, params, pixelsPerSecond);
    }

    for (const [noteId, visual] of this.activeByNoteId) {
      if (!stillWanted.has(noteId)) {
        this.activeByNoteId.delete(noteId);
        this.releaseToPool(visual);
      }
    }
  }

  private isHandVisible(note: NoteEvent, handMode: PracticeHandMode): boolean {
    if (handMode === 'both') return true;
    return note.hand === handMode || note.hand === 'unknown';
  }

  private renderNote(note: NoteEvent, params: NotesLayerFrameParams, pixelsPerSecond: number): void {
    const key = params.layout.byMidi.get(note.midi);
    if (!key) return;

    let visual = this.activeByNoteId.get(note.id);
    if (!visual) {
      visual = this.acquireFromPool();
      this.activeByNoteId.set(note.id, visual);
    }

    const widthPx = Math.max(3, key.width * this.settings.noteWidthScale - 2);
    const heightPx = Math.max(5, note.duration * pixelsPerSecond);
    const bottomY = params.strikeLineY - (note.time - params.currentTime) * pixelsPerSecond;
    const topY = bottomY - heightPx;

    const gradient = note.hand === 'right' ? this.rightGradient : note.hand === 'left' ? this.leftGradient : this.neutralGradient;
    const judgement = params.judgements.get(note.id);

    visual.assign(note, widthPx, heightPx, this.settings.cornerRadius, gradient, this.settings.showNoteLabels, judgement);
    visual.setPosition(key.centerX - widthPx / 2, topY);

    if (params.selectedNoteId === note.id || params.awaitingNoteIds.has(note.id)) {
      visual.applySelectionPulse(this.elapsedForPulse);
    } else {
      visual.clearSelectionPulse();
    }
  }

  private acquireFromPool(): NoteVisual {
    const recycled = this.free.pop();
    if (recycled) return recycled;
    const created = new NoteVisual();
    this.pool.push(created);
    this.container.addChild(created.container);
    return created;
  }

  private releaseToPool(visual: NoteVisual): void {
    visual.release();
    this.free.push(visual);
  }

  destroy(): void {
    for (const visual of this.pool) visual.destroy();
    this.pool.length = 0;
    this.free.length = 0;
    this.activeByNoteId.clear();
    this.container.destroy({ children: true });
  }
}
