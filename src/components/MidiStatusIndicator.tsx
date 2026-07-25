import { Piano } from 'lucide-react';
import { usePracticeStore } from '@/state/practiceStore';

/**
 * Global MIDI connect/status control for the top bar. Deliberately reuses `usePracticeStore`'s
 * MIDI state and `connectMidi` action rather than standing up a second connection — there's only
 * ever one underlying `MidiInputManager` singleton, and Practice mode already owns the correct,
 * reactive (hot-plug-aware) wiring to it.
 */
export function MidiStatusIndicator(): React.ReactElement | null {
  const midiSupported = usePracticeStore((s) => s.midiSupported);
  const midiConnected = usePracticeStore((s) => s.midiConnected);
  const connectedInputNames = usePracticeStore((s) => s.connectedInputNames);
  const connectMidi = usePracticeStore((s) => s.connectMidi);

  if (!midiSupported) return null;

  if (!midiConnected) {
    return (
      <button
        type="button"
        onClick={() => void connectMidi()}
        title="Connect a MIDI keyboard"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/8 hover:text-white/90"
      >
        <Piano size={13} />
        <span>MIDI</span>
      </button>
    );
  }

  const hasDevice = connectedInputNames.length > 0;
  return (
    <div
      title={hasDevice ? `Connected: ${connectedInputNames.join(', ')}` : 'Waiting for a MIDI keyboard…'}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white/60"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasDevice ? 'bg-green-400' : 'bg-yellow-400'}`} />
      <span>MIDI</span>
    </div>
  );
}
