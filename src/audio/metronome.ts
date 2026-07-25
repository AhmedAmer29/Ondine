import * as Tone from 'tone';

/** A bright, metallic tick — a mechanical clock's escapement, not a drum click. Downbeats ring a touch higher and louder. */
export class MetronomeVoice {
  private readonly synth: Tone.MetalSynth;

  constructor(destination: Tone.ToneAudioNode) {
    this.synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.045, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 18,
      resonance: 3400,
      octaves: 0.9,
      volume: -20,
    });
    this.synth.connect(destination);
  }

  trigger(time: Tone.Unit.Time, accent: boolean): void {
    this.synth.triggerAttackRelease(accent ? 'A5' : 'F5', '32n', time, accent ? 1 : 0.65);
  }

  dispose(): void {
    this.synth.dispose();
  }
}
