import { useMemo } from 'react';
import { useUiStore } from '@/state/uiStore';
import { useDebugStore } from '@/state/debugStore';
import { useSongStore } from '@/state/songStore';
import { getGpuInfo } from '@/utils/gpuInfo';

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-white/85">{value}</span>
    </div>
  );
}

export function DebugOverlay(): React.ReactElement | null {
  const visible = useUiStore((s) => s.debugOverlayVisible);
  const { fps, frameTimeMs, visibleNoteCount } = useDebugStore();
  const song = useSongStore((s) => s.song);
  const gpu = useMemo(() => (visible ? getGpuInfo() : null), [visible]);

  if (!visible) return null;

  return (
    <div className="glass-panel pointer-events-none absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-3 py-2 font-mono text-[10px]">
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        <Row label="FPS" value={String(fps)} />
        <Row label="Frame" value={`${frameTimeMs.toFixed(2)}ms`} />
        <Row label="Sounding keys" value={String(visibleNoteCount)} />
        <Row label="Notes" value={String(song?.notes.length ?? 0)} />
        <Row label="Tracks" value={String(song?.tracks.length ?? 0)} />
        <Row label="GPU" value={gpu?.renderer.slice(0, 28) ?? '—'} />
      </div>
    </div>
  );
}
