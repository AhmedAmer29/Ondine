import * as Tone from 'tone';

/** Root URL for the Salamander Grand Piano samples (Creative Commons), Tone.js's standard reference piano set. */
const SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

/** One real recorded note roughly every major third across the 88-key range; Tone.Sampler pitch-shifts to fill the gaps. */
const SAMPLE_URLS: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
};

/**
 * A real acoustic grand piano voice, sampled from the Salamander Grand Piano
 * (multi-velocity recordings of a real Yamaha C5, repitched by Tone.Sampler to
 * cover notes between samples). Every track plays through this shared timbre
 * rather than each track's declared GM instrument, so playback always sounds
 * like a piano performance, matching the visualizer's purpose. Velocity maps
 * directly to sample playback gain, and note decay comes from the recordings
 * themselves rather than a synthesized envelope, so sustain reads naturally.
 */
export class PianoVoice {
  readonly sampler: Tone.Sampler;
  readonly output: Tone.Gain;

  constructor() {
    this.sampler = new Tone.Sampler({
      urls: SAMPLE_URLS,
      baseUrl: SAMPLE_BASE_URL,
      release: 0.9,
      volume: 0,
    });

    this.output = new Tone.Gain(1);
    this.sampler.connect(this.output);
  }

  get isLoaded(): boolean {
    return this.sampler.loaded;
  }

  triggerNote(noteName: string, duration: Tone.Unit.Time, time: Tone.Unit.Time, velocity: number): void {
    if (!this.sampler.loaded) return;
    this.sampler.triggerAttackRelease(noteName, duration, time, this.normalizeVelocity(velocity));
  }

  /** Starts a note with no fixed duration — pairs with `triggerRelease` for interactive (mouse/keyboard) playing where the hold length isn't known upfront. */
  triggerAttack(noteName: string, velocity: number): void {
    if (!this.sampler.loaded) return;
    this.sampler.triggerAttack(noteName, Tone.now(), this.normalizeVelocity(velocity));
  }

  triggerRelease(noteName: string): void {
    if (!this.sampler.loaded) return;
    this.sampler.triggerRelease(noteName, Tone.now());
  }

  releaseAll(): void {
    this.sampler.releaseAll();
  }

  // A modest floor lift so soft-touch notes don't nearly disappear, without
  // flattening the natural feel of dynamics the way a stronger curve would.
  private normalizeVelocity(velocity: number): number {
    const clamped = Math.max(0.05, Math.min(1, velocity));
    return 0.3 + 0.7 * clamped;
  }

  dispose(): void {
    this.sampler.dispose();
    this.output.dispose();
  }
}

/** The shared mastering chain every PianoVoice and the metronome route through. */
export class MasterBus {
  readonly input: Tone.Gain;
  private readonly compressor: Tone.Compressor;
  private readonly reverb: Tone.Reverb;
  private readonly makeupGain: Tone.Gain<'decibels'>;
  private readonly limiter: Tone.Limiter;
  readonly volume: Tone.Volume;

  constructor() {
    this.input = new Tone.Gain(1);
    // Gentle glue compression — just enough to catch the occasional loud chord,
    // not aggressive enough to flatten the piano's natural dynamics or make the
    // makeup gain below sound pumped/squashed.
    this.compressor = new Tone.Compressor({ threshold: -14, ratio: 2.5, attack: 0.005, release: 0.25 });
    this.reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.02, wet: 0.14 });
    this.makeupGain = new Tone.Gain(2, 'decibels');
    this.volume = new Tone.Volume(0);
    this.limiter = new Tone.Limiter(-0.5);

    this.input.chain(this.compressor, this.reverb, this.makeupGain, this.volume, this.limiter, Tone.getDestination());
  }

  setMasterVolumeDb(db: number): void {
    this.volume.volume.value = db;
  }

  /** Fans the mastered signal out to an additional destination (used by video export to capture audio) without affecting normal speaker output. */
  connectToMediaStreamDestination(destination: MediaStreamAudioDestinationNode): void {
    this.limiter.connect(destination);
  }

  disconnectFromMediaStreamDestination(destination: MediaStreamAudioDestinationNode): void {
    this.limiter.disconnect(destination);
  }

  dispose(): void {
    this.input.dispose();
    this.compressor.dispose();
    this.reverb.dispose();
    this.makeupGain.dispose();
    this.volume.dispose();
    this.limiter.dispose();
  }
}
