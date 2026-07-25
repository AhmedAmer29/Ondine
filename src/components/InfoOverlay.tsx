import { AnimatePresence, motion } from 'framer-motion';
import { useLiveSongInfo } from '@/hooks/useLiveSongInfo';
import { useUiStore } from '@/state/uiStore';
import { useSongStore } from '@/state/songStore';

function Pill({ label, value }: { readonly label: string; readonly value: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3">
      <span className="text-[9px] font-medium tracking-[0.14em] text-white/40 uppercase">{label}</span>
      <span className="font-mono text-sm text-white/90 text-shadow-note">{value}</span>
    </div>
  );
}

export function InfoOverlay(): React.ReactElement | null {
  const song = useSongStore((s) => s.song);
  const controlsVisible = useUiStore((s) => s.controlsVisible);
  const info = useLiveSongInfo();

  if (!song) return null;

  return (
    <AnimatePresence>
      {controlsVisible && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel pointer-events-none absolute top-14 left-1/2 z-20 flex -translate-x-1/2 items-center divide-x divide-white/10 rounded-2xl px-1 py-2.5"
        >
          <Pill label="Chord" value={info.chord?.name ?? '—'} />
          <Pill label="Key" value={info.keySignature ? `${info.keySignature.tonic} ${info.keySignature.mode}` : '—'} />
          <Pill label="BPM" value={String(info.bpm)} />
          <Pill label="Measure" value={String(info.measure)} />
          <Pill label="Beat" value={`${info.beat} / ${info.timeSignature.numerator}`} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
