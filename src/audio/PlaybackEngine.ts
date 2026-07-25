import * as Tone from 'tone';
import type { LoopRegion, ParsedSong, TempoMultiplier } from '@/types';
import { PianoVoice, MasterBus } from './instrument';
import { MetronomeVoice } from './metronome';
import { midiToPitchName } from '@/midi/noteUtils';

/** Ticks-per-second at 1x playback speed. Fixed so tempo scaling is a pure Transport.bpm change. */
const REFERENCE_PPQ = 480;
const REFERENCE_BPM = 60;

/** Metronome tempo before the user has touched the Customization panel's setting. */
const DEFAULT_METRONOME_BPM = 120;
const METRONOME_BEATS_PER_MEASURE = 4;

interface NoteEventValue {
  readonly time: string;
  readonly noteName: string;
  readonly durationTicks: number;
  readonly velocity: number;
}

function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * REFERENCE_PPQ));
}

/**
 * Owns all Tone.js state for one loaded song: the instrument voice, scheduled
 * note parts (one per track, for independent muting), the metronome, and
 * transport control (play/pause/seek/loop/tempo).
 *
 * This class is intentionally pull-based rather than event-driven: it does not
 * push "note on/off" callbacks out. The renderer and UI instead read
 * `getCurrentTime()` every animation frame and derive which notes are active
 * via `SongQuery.getActiveNotesAt()`. That keeps this engine correct across
 * seeks and tempo changes and avoids pre-scheduling millions of visual
 * callbacks for large MIDI files.
 */
export class PlaybackEngine {
  private readonly voice: PianoVoice;
  private readonly masterBus: MasterBus;
  private readonly metronomeVoice: MetronomeVoice;
  private readonly metronomeClock: Tone.Clock;
  private metronomeEnabled = false;
  private metronomeBeatIndex = 0;
  private metronomeBpm = DEFAULT_METRONOME_BPM;

  private trackParts = new Map<number, Tone.Part<NoteEventValue>>();
  private song: ParsedSong | null = null;
  private tempoMultiplier: TempoMultiplier = 1;
  private audioReady = false;

  constructor() {
    this.masterBus = new MasterBus();
    this.voice = new PianoVoice();
    this.voice.output.connect(this.masterBus.input);

    const transport = Tone.getTransport();
    transport.PPQ = REFERENCE_PPQ;
    transport.bpm.value = REFERENCE_BPM;

    // The metronome is its own independent clock, not a Tone.Part scheduled against the song
    // timeline — that's what lets it keep ticking with no song loaded, or while paused, instead
    // of only sounding while the transport happens to be running. Its rate is a fixed,
    // user-configured bpm (Customization panel), completely independent of the song's own tempo
    // map and the playback speed slider — a click track that sped up and slowed down with a
    // piece's authored rubato, or doubled when you set playback to 2x, defeats the point of a
    // steady practice click.
    this.metronomeVoice = new MetronomeVoice(this.masterBus.input);
    this.metronomeClock = new Tone.Clock((time) => {
      const accent = this.metronomeBeatIndex % METRONOME_BEATS_PER_MEASURE === 0;
      this.metronomeVoice.trigger(time, accent);
      this.metronomeBeatIndex++;
    }, DEFAULT_METRONOME_BPM / 60);
  }

  /** Sets the metronome's fixed tempo (Customization panel), independent of the song's tempo or the playback speed slider. */
  setMetronomeBpm(bpm: number): void {
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_METRONOME_BPM;
    this.metronomeBpm = safeBpm;
    this.metronomeClock.frequency.value = Math.max(0.1, safeBpm / 60);
  }

  getMetronomeBpm(): number {
    return this.metronomeBpm;
  }

  /** Must be called from a user gesture (e.g. the first Play click) to unlock the AudioContext. */
  async ensureAudioStarted(): Promise<void> {
    if (this.audioReady) return;
    await Tone.start();
    this.audioReady = true;
  }

  loadSong(song: ParsedSong): void {
    this.disposeSongResources();
    this.song = song;

    const transport = Tone.getTransport();

    for (const track of song.tracks) {
      const events: NoteEventValue[] = track.notes.map((note) => {
        const durationTicks = Math.max(1, secondsToTicks(note.effectiveEndTime - note.time));
        return {
          time: `${secondsToTicks(note.time)}i`,
          noteName: note.name,
          durationTicks,
          velocity: note.velocity,
        };
      });

      const part = new Tone.Part<NoteEventValue>((time, value) => {
        this.voice.triggerNote(value.noteName, `${value.durationTicks}i`, time, value.velocity);
      }, events);

      part.mute = track.muted;
      part.start(0);
      this.trackParts.set(track.index, part);
    }

    transport.stop();
    transport.ticks = 0;
    transport.loop = false;
  }

  async play(): Promise<void> {
    await this.ensureAudioStarted();
    Tone.getTransport().start();
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  stopAndRewind(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.ticks = 0;
    this.voice.releaseAll();
  }

  seek(seconds: number): void {
    const transport = Tone.getTransport();
    transport.ticks = secondsToTicks(seconds);
    this.voice.releaseAll();
  }

  getCurrentTime(): number {
    return Tone.getTransport().ticks / REFERENCE_PPQ;
  }

  getDuration(): number {
    return this.song?.durationSeconds ?? 0;
  }

  isPlaying(): boolean {
    return Tone.getTransport().state === 'started';
  }

  setTempoMultiplier(multiplier: TempoMultiplier): void {
    this.tempoMultiplier = multiplier;
    Tone.getTransport().bpm.rampTo(REFERENCE_BPM * multiplier, 0.05);
  }

  getTempoMultiplier(): TempoMultiplier {
    return this.tempoMultiplier;
  }

  setLoop(region: LoopRegion | null): void {
    const transport = Tone.getTransport();
    if (!region) {
      transport.loop = false;
      return;
    }
    transport.loopStart = `${secondsToTicks(region.startTime)}i`;
    transport.loopEnd = `${secondsToTicks(region.endTime)}i`;
    transport.loop = true;
  }

  setTrackMuted(trackIndex: number, muted: boolean): void {
    const part = this.trackParts.get(trackIndex);
    if (part) part.mute = muted;
  }

  setMasterVolumeDb(db: number): void {
    this.masterBus.setMasterVolumeDb(db);
  }

  /** Used by video export to additionally route audio into a MediaStream for recording, without touching normal speaker output. */
  connectToMediaStreamDestination(destination: MediaStreamAudioDestinationNode): void {
    this.masterBus.connectToMediaStreamDestination(destination);
  }

  disconnectFromMediaStreamDestination(destination: MediaStreamAudioDestinationNode): void {
    this.masterBus.disconnectFromMediaStreamDestination(destination);
  }

  setMetronomeEnabled(enabled: boolean): void {
    if (this.metronomeEnabled === enabled) return;
    this.metronomeEnabled = enabled;
    if (enabled) {
      this.metronomeBeatIndex = 0;
      void this.ensureAudioStarted().then(() => {
        if (this.metronomeEnabled) this.metronomeClock.start();
      });
    } else {
      this.metronomeClock.stop();
    }
  }

  /** Starts a note immediately, outside song scheduling — for clicking a key or playing it from the PC keyboard. Pairs with `previewNoteOff`. */
  previewNoteOn(midi: number, velocity = 0.85): void {
    // Unlocks the AudioContext on the very first interaction, same as the Play button —
    // a key click is itself a user gesture, so this is safe to do synchronously here.
    void this.ensureAudioStarted().then(() => this.voice.triggerAttack(midiToPitchName(midi).name, velocity));
  }

  previewNoteOff(midi: number): void {
    this.voice.triggerRelease(midiToPitchName(midi).name);
  }

  /** Steps playback by a fixed offset while paused, e.g. for frame/measure stepping. */
  stepBy(deltaSeconds: number): void {
    if (this.isPlaying()) this.pause();
    const duration = this.getDuration();
    const next = Math.min(duration, Math.max(0, this.getCurrentTime() + deltaSeconds));
    this.seek(next);
  }

  private disposeSongResources(): void {
    for (const part of this.trackParts.values()) part.dispose();
    this.trackParts.clear();
    this.voice.releaseAll();
  }

  dispose(): void {
    this.disposeSongResources();
    this.metronomeClock.dispose();
    this.metronomeVoice.dispose();
    this.voice.dispose();
    this.masterBus.dispose();
  }
}

let sharedEngine: PlaybackEngine | null = null;

/** The app uses a single shared engine instance so audio nodes persist across component remounts. */
export function getPlaybackEngine(): PlaybackEngine {
  if (!sharedEngine) sharedEngine = new PlaybackEngine();
  return sharedEngine;
}
