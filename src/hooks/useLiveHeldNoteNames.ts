import { useEffect, useState } from 'react';
import { getLiveInputController } from '@/live/LiveInputController';
import { midiToPitchName } from '@/midi/noteUtils';

function namesFromMidis(midis: ReadonlySet<number>): string[] {
  return Array.from(midis)
    .sort((a, b) => a - b)
    .map((midi) => midiToPitchName(midi).name);
}

/** Live-updating list of note names currently held across any Live-mode input source (mouse or MIDI), for display in the status pill. */
export function useLiveHeldNoteNames(): string[] {
  const [names, setNames] = useState<string[]>(() => namesFromMidis(getLiveInputController().getHeldMidis()));

  useEffect(() => {
    const controller = getLiveInputController();
    setNames(namesFromMidis(controller.getHeldMidis()));
    return controller.subscribe(() => {
      setNames(namesFromMidis(controller.getHeldMidis()));
    });
  }, []);

  return names;
}
