import { useState } from 'react';
import { AudioWaveform, Download, LayoutGrid, Trash2 } from 'lucide-react';
import { useLiveRecordingStore } from '@/state/liveRecordingStore';
import { useSongStore } from '@/state/songStore';
import { useUiStore } from '@/state/uiStore';
import { synthesizeSongFromRecording } from '@/live/synthesizeSongFromRecording';
import { saveMidiFile } from '@/export/writeMidiFile';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Shown right after stopping a Live-mode recording — matches the "session recorded" card from the reference app. */
export function LiveRecordingModal(): React.ReactElement | null {
  const lastRecording = useLiveRecordingStore((s) => s.lastRecording);
  const clearLastRecording = useLiveRecordingStore((s) => s.clearLastRecording);
  const loadFromParsedSong = useSongStore((s) => s.loadFromParsedSong);
  const setMode = useUiStore((s) => s.setMode);
  const [isSaving, setIsSaving] = useState(false);

  if (!lastRecording || lastRecording.length === 0) return null;

  const duration = lastRecording.reduce((max, note) => Math.max(max, note.endTime), 0);

  const handleOpenInFileMode = (): void => {
    const song = synthesizeSongFromRecording(lastRecording);
    loadFromParsedSong(song);
    clearLastRecording();
    setMode('play');
  };

  const handleDownloadMidi = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const song = synthesizeSongFromRecording(lastRecording);
      const saved = await saveMidiFile(song);
      if (saved) clearLastRecording();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/55">
      <div className="glass-panel flex w-80 flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
            <AudioWaveform size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/90">Session recorded</h2>
            <p className="text-[11px] text-white/40">
              {formatDuration(duration)} · {lastRecording.length} note{lastRecording.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenInFileMode}
          className="flex items-start gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-left transition-colors hover:bg-orange-500/15"
        >
          <LayoutGrid size={16} className="mt-0.5 shrink-0 text-orange-400" />
          <span>
            <span className="block text-[13px] font-medium text-white/90">Open in file mode</span>
            <span className="block text-[11px] text-white/50">Visualize it as a rolling piano roll — ready to export as MP4.</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => void handleDownloadMidi()}
          disabled={isSaving}
          className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/8 disabled:opacity-50"
        >
          <Download size={16} className="mt-0.5 shrink-0 text-white/60" />
          <span>
            <span className="block text-[13px] font-medium text-white/85">{isSaving ? 'Saving…' : 'Download MIDI'}</span>
            <span className="block text-[11px] text-white/40">Send a .mid file straight to your DAW.</span>
          </span>
        </button>

        <button type="button" onClick={clearLastRecording} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-left transition-colors hover:bg-white/8">
          <Trash2 size={16} className="mt-0.5 shrink-0 text-white/50" />
          <span>
            <span className="block text-[13px] font-medium text-white/80">Discard</span>
            <span className="block text-[11px] text-white/40">Throw it away and keep jamming.</span>
          </span>
        </button>
      </div>
    </div>
  );
}
