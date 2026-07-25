import { usePracticeStore } from '@/state/practiceStore';
import { useLiveHeldNoteNames } from '@/hooks/useLiveHeldNoteNames';

/** Top-center status pill for Live mode: MIDI connection state + a Connect button, plus whatever notes are currently sounding from any input source. */
export function LiveStatusPill(): React.ReactElement {
  const midiSupported = usePracticeStore((s) => s.midiSupported);
  const midiConnected = usePracticeStore((s) => s.midiConnected);
  const connectedInputNames = usePracticeStore((s) => s.connectedInputNames);
  const connectMidi = usePracticeStore((s) => s.connectMidi);
  const heldNotes = useLiveHeldNoteNames();

  const hasDevice = connectedInputNames.length > 0;
  const statusLabel = !midiSupported
    ? 'MIDI unavailable — click the keys to play'
    : !midiConnected
      ? 'MIDI keyboard not connected'
      : hasDevice
        ? `Connected: ${connectedInputNames.join(', ')}`
        : 'Waiting for a MIDI keyboard…';
  const dotColor = hasDevice ? 'bg-green-400' : midiConnected ? 'bg-yellow-400' : 'bg-white/25';

  return (
    <div className="glass-panel pointer-events-auto absolute top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      <span className="text-[11px] font-medium text-white/70">{statusLabel}</span>
      {midiSupported && !midiConnected && (
        <button
          type="button"
          onClick={() => void connectMidi()}
          className="rounded-lg bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/15"
        >
          Connect
        </button>
      )}
      {heldNotes.length > 0 && (
        <>
          <span className="h-4 w-px bg-white/10" />
          <span className="font-mono text-[12px] font-semibold text-[var(--color-accent)]">{heldNotes.join('-')}</span>
        </>
      )}
    </div>
  );
}
