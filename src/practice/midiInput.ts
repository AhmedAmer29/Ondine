export interface MidiNoteEvent {
  readonly midi: number;
  readonly velocity: number;
  readonly on: boolean;
  readonly timestamp: number;
}

export type MidiNoteListener = (event: MidiNoteEvent) => void;

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * Thin wrapper around the Web MIDI API for reading a connected MIDI keyboard.
 * Used by PracticeEngine to judge the notes the user actually plays. Requires
 * browser/user permission; devices that connect after `start()` are picked
 * up automatically via the `statechange` event.
 */
export class MidiInputManager {
  private access: MIDIAccess | null = null;
  private readonly listeners = new Set<MidiNoteListener>();
  private readonly boundHandlers = new Map<string, (event: MIDIMessageEvent) => void>();
  private readonly deviceChangeListeners = new Set<() => void>();

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  get connectedInputNames(): string[] {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values()).map((input) => input.name ?? input.id);
  }

  async start(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) return false;
    if (this.access) return true;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      return false;
    }
    this.attachToAllInputs();
    this.access.onstatechange = () => {
      this.attachToAllInputs();
      this.notifyDeviceChange();
    };
    this.notifyDeviceChange();
    return true;
  }

  /** Fires whenever the connected-input list changes — initial connect, hot-plug, or unplug. */
  onDeviceChange(listener: () => void): () => void {
    this.deviceChangeListeners.add(listener);
    return () => this.deviceChangeListeners.delete(listener);
  }

  private notifyDeviceChange(): void {
    for (const listener of this.deviceChangeListeners) listener();
  }

  private attachToAllInputs(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      if (this.boundHandlers.has(input.id)) continue;
      const handler = (event: MIDIMessageEvent): void => this.handleMessage(event);
      input.onmidimessage = handler;
      this.boundHandlers.set(input.id, handler);
    }
  }

  private handleMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 3) return;
    const status = data[0] as number;
    const command = status & 0xf0;
    const midi = data[1] as number;
    const velocityRaw = data[2] as number;

    if (command === NOTE_ON && velocityRaw > 0) {
      this.emit({ midi, velocity: velocityRaw / 127, on: true, timestamp: event.timeStamp });
    } else if (command === NOTE_OFF || (command === NOTE_ON && velocityRaw === 0)) {
      this.emit({ midi, velocity: 0, on: false, timestamp: event.timeStamp });
    }
  }

  private emit(event: MidiNoteEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: MidiNoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): void {
    if (this.access) {
      for (const input of this.access.inputs.values()) input.onmidimessage = null;
    }
    this.boundHandlers.clear();
    this.listeners.clear();
    this.deviceChangeListeners.clear();
  }
}

let sharedInput: MidiInputManager | null = null;

export function getMidiInputManager(): MidiInputManager {
  if (!sharedInput) sharedInput = new MidiInputManager();
  return sharedInput;
}
