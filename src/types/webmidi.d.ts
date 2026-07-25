// Minimal ambient typings for the Web MIDI API, which TypeScript's bundled DOM lib
// does not include. Scoped to exactly what PianoFlow's MidiInputManager uses.

interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array | null;
  readonly timeStamp: number;
}

interface MIDIPort extends EventTarget {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly state: 'connected' | 'disconnected';
  readonly connection: 'open' | 'closed' | 'pending';
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MIDIOutput extends MIDIPort {
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

interface MIDIAccess extends EventTarget {
  readonly inputs: ReadonlyMap<string, MIDIInput>;
  readonly outputs: ReadonlyMap<string, MIDIOutput>;
  onstatechange: ((event: Event) => void) | null;
}

interface MIDIOptions {
  sysex?: boolean;
  software?: boolean;
}

interface Navigator {
  requestMIDIAccess?(options?: MIDIOptions): Promise<MIDIAccess>;
}
