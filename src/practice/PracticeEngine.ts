import type { NoteEvent, NoteJudgement, ParsedSong, PracticeHandMode, PracticeNoteState, PracticeSettings, PracticeStats } from '@/types';
import { EMPTY_PRACTICE_STATS } from '@/types';
import { clusterNotesIntoChords, type NoteCluster } from '@/midi/chordDetection';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';
import { getMidiInputManager, type MidiNoteEvent } from './midiInput';

const ONSET_TOLERANCE_SECONDS = 0.05;
const MISS_GRACE_SECONDS = 1.2;

export type MistakeListener = (midi: number) => void;

/**
 * Judges the user's live MIDI playing against the loaded song. Owns no UI —
 * `usePracticeEngine` polls its read-only getters every frame and the
 * renderer consults them to highlight the awaited notes and past mistakes.
 */
export class PracticeEngine {
  private song: ParsedSong | null = null;
  private settings: PracticeSettings;
  private clustersByHandMode = new Map<PracticeHandMode, NoteCluster[]>();
  private nextClusterIndex = 0;
  private pendingCluster: NoteCluster | null = null;
  private pendingUnresolvedMidis = new Set<number>();
  private judgements = new Map<number, PracticeNoteState>();
  private judgementValues = new Map<number, NoteJudgement>();
  private stats: PracticeStats = { ...EMPTY_PRACTICE_STATS };
  private unsubscribeMidi: (() => void) | null = null;
  private mistakeListeners = new Set<MistakeListener>();
  private lastCheckedTime = 0;

  constructor(initialSettings: PracticeSettings) {
    this.settings = initialSettings;
  }

  async setSong(song: ParsedSong | null): Promise<void> {
    this.song = song;
    this.clustersByHandMode.clear();
    this.judgements.clear();
    this.judgementValues.clear();
    this.resetProgress();
  }

  setSettings(settings: PracticeSettings): void {
    const handModeChanged = settings.handMode !== this.settings.handMode;
    this.settings = settings;
    if (handModeChanged) this.resetProgress();
  }

  /** Rewinds practice judging to the start (e.g. on restart or a fresh loop). Does not touch playback itself. */
  resetProgress(): void {
    this.nextClusterIndex = 0;
    this.pendingCluster = null;
    this.pendingUnresolvedMidis.clear();
    for (const state of this.judgements.values()) {
      state.judgement = 'pending';
      state.hitTime = null;
    }
    this.judgementValues.clear();
    // Hand-filtered, not song.notes.length: correct/wrong/missed are only ever counted against
    // the current hand mode's clusters, so totalNotes must match or accuracy math involving it
    // (e.g. a future progress bar) would never add up in Left/Right-only mode.
    const totalNotes = this.getClustersForCurrentHandMode().reduce((sum, cluster) => sum + cluster.notes.length, 0);
    this.stats = { ...EMPTY_PRACTICE_STATS, totalNotes };
  }

  async connectMidiInput(): Promise<boolean> {
    const manager = getMidiInputManager();
    const started = await manager.start();
    if (started && !this.unsubscribeMidi) {
      this.unsubscribeMidi = manager.subscribe((event) => this.handleMidiEvent(event));
    }
    return started;
  }

  get isMidiSupported(): boolean {
    return getMidiInputManager().isSupported;
  }

  get connectedInputNames(): string[] {
    return getMidiInputManager().connectedInputNames;
  }

  onMistake(listener: MistakeListener): () => void {
    this.mistakeListeners.add(listener);
    return () => this.mistakeListeners.delete(listener);
  }

  getStats(): PracticeStats {
    return this.stats;
  }

  getJudgements(): ReadonlyMap<number, PracticeNoteState> {
    return this.judgements;
  }

  /** Renderer-friendly view: just the judgement enum per note, no bookkeeping fields. */
  getJudgementValues(): ReadonlyMap<number, NoteJudgement> {
    return this.judgementValues;
  }

  getAwaitingNoteIds(): ReadonlySet<number> {
    if (!this.pendingCluster) return EMPTY_SET;
    const ids = new Set<number>();
    for (const note of this.pendingCluster.notes) {
      if (this.pendingUnresolvedMidis.has(note.midi)) ids.add(note.id);
    }
    return ids;
  }

  private getClustersForCurrentHandMode(): NoteCluster[] {
    const cached = this.clustersByHandMode.get(this.settings.handMode);
    if (cached) return cached;
    if (!this.song) return [];
    const notes = filterByHand(this.song.notes, this.settings.handMode);
    const clusters = clusterNotesIntoChords(notes, ONSET_TOLERANCE_SECONDS);
    this.clustersByHandMode.set(this.settings.handMode, clusters);
    return clusters;
  }

  /** Called every animation frame while practice mode is enabled and a song is loaded. */
  tick(currentTime: number): void {
    if (!this.settings.enabled || !this.song) return;
    const engine = getPlaybackEngine();

    // A cluster is only cleared by playing its correct notes (see `handleMidiEvent`) — but the
    // transport itself doesn't know that, so a plain resume (Play button, Space) while one is
    // still unresolved would otherwise run straight past it with nothing to stop it. Once that
    // happens `pendingCluster` never clears, and the while-loop below (guarded on it being unset)
    // never runs again either — silently disabling wait-for-note grading for the rest of the
    // song. Re-enforce the pause instead of letting that slip through.
    if (this.pendingCluster && this.settings.waitForCorrectNote && engine.isPlaying()) {
      engine.pause();
      engine.seek(this.pendingCluster.time);
      this.lastCheckedTime = currentTime;
      return;
    }

    const clusters = this.getClustersForCurrentHandMode();

    // Auto-mark any clusters we scrolled past without a pending-wait (non-blocking mode, or a seek) as missed.
    while (this.nextClusterIndex < clusters.length && !this.pendingCluster) {
      const cluster = clusters[this.nextClusterIndex] as NoteCluster;
      if (cluster.time > currentTime + ONSET_TOLERANCE_SECONDS) break;

      if (this.settings.waitForCorrectNote && engine.isPlaying()) {
        this.beginWaiting(cluster);
        engine.pause();
        engine.seek(cluster.time);
        break;
      }

      if (currentTime - cluster.time > MISS_GRACE_SECONDS) {
        this.markClusterMissed(cluster);
        this.nextClusterIndex++;
      } else {
        break;
      }
    }

    this.lastCheckedTime = currentTime;
  }

  private beginWaiting(cluster: NoteCluster): void {
    this.pendingCluster = cluster;
    this.pendingUnresolvedMidis = new Set(cluster.notes.map((n) => n.midi));
  }

  private handleMidiEvent(event: MidiNoteEvent): void {
    if (!this.settings.enabled || !event.on || !this.pendingCluster) return;

    if (this.pendingUnresolvedMidis.has(event.midi)) {
      this.pendingUnresolvedMidis.delete(event.midi);
      for (const note of this.pendingCluster.notes) {
        if (note.midi === event.midi) this.recordJudgement(note, 'correct');
      }
      this.stats.correctNotes++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);

      if (this.pendingUnresolvedMidis.size === 0) {
        this.pendingCluster = null;
        this.nextClusterIndex++;
        void getPlaybackEngine().play();
      }
    } else {
      this.stats.wrongNotes++;
      this.stats.streak = 0;
      for (const listener of this.mistakeListeners) listener(event.midi);

      if (this.settings.loopOnMistake && this.pendingCluster) {
        getPlaybackEngine().seek(this.pendingCluster.time);
      }
    }

    this.recalculateAccuracy();
  }

  private markClusterMissed(cluster: NoteCluster): void {
    for (const note of cluster.notes) {
      this.recordJudgement(note, 'missed');
    }
    this.stats.missedNotes += cluster.notes.length;
    this.stats.streak = 0;
    this.recalculateAccuracy();
  }

  private recordJudgement(note: NoteEvent, judgement: PracticeNoteState['judgement']): void {
    const existing = this.judgements.get(note.id);
    if (existing) {
      existing.judgement = judgement;
      existing.hitTime = this.lastCheckedTime;
    } else {
      this.judgements.set(note.id, { noteId: note.id, judgement, hitTime: this.lastCheckedTime });
    }
    this.judgementValues.set(note.id, judgement);
  }

  private recalculateAccuracy(): void {
    const judged = this.stats.correctNotes + this.stats.wrongNotes + this.stats.missedNotes;
    this.stats.accuracy = judged > 0 ? this.stats.correctNotes / judged : 0;
  }

  dispose(): void {
    this.unsubscribeMidi?.();
    this.unsubscribeMidi = null;
    this.mistakeListeners.clear();
    getMidiInputManager().stop();
  }
}

const EMPTY_SET: ReadonlySet<number> = new Set();

function filterByHand(notes: readonly NoteEvent[], handMode: PracticeHandMode): NoteEvent[] {
  if (handMode === 'both') return [...notes];
  return notes.filter((n) => n.hand === handMode || n.hand === 'unknown');
}

let sharedPracticeEngine: PracticeEngine | null = null;

export function getPracticeEngine(): PracticeEngine {
  if (!sharedPracticeEngine) {
    sharedPracticeEngine = new PracticeEngine({
      enabled: false,
      handMode: 'both',
      waitForCorrectNote: true,
      highlightMistakes: true,
      showUpcomingNotes: true,
      ghostNotes: true,
      loopOnMistake: false,
      countdownBeats: 4,
    });
  }
  return sharedPracticeEngine;
}
