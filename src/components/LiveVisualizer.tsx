import { useEffect } from 'react';
import { Circle, Square, Timer } from 'lucide-react';
import { useLivePianoRenderer } from '@/hooks/useLivePianoRenderer';
import { useLiveRecordingStore } from '@/state/liveRecordingStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { Chip } from './ui';
import { LiveRecordingModal } from './LiveRecordingModal';
import { LiveStatusPill } from './LiveStatusPill';

function LiveMetronomeControl(): React.ReactElement {
  const metronomeEnabled = usePlaybackStore((s) => s.metronomeEnabled);
  const toggleMetronome = usePlaybackStore((s) => s.toggleMetronome);

  return (
    <div className="glass-panel pointer-events-auto absolute top-4 left-4 z-30 flex items-center rounded-2xl p-1.5">
      <Chip active={metronomeEnabled} onClick={toggleMetronome} className="flex items-center gap-1.5">
        <Timer size={12} />
        Metronome
      </Chip>
    </div>
  );
}

function RecordControl(): React.ReactElement {
  const isRecording = useLiveRecordingStore((s) => s.isRecording);
  const startRecording = useLiveRecordingStore((s) => s.startRecording);
  const stopRecording = useLiveRecordingStore((s) => s.stopRecording);

  return (
    <div className="glass-panel pointer-events-auto absolute top-4 right-4 z-30 flex items-center rounded-2xl p-1.5">
      <button
        type="button"
        onClick={() => (isRecording ? stopRecording() : startRecording())}
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-colors ${
          isRecording ? 'bg-red-500/20 text-red-200' : 'bg-white/8 text-white/80 hover:bg-white/15'
        }`}
      >
        {isRecording ? <Square size={10} className="fill-red-300 text-red-300" /> : <Circle size={10} className="fill-red-500 text-red-500" />}
        {isRecording ? 'Stop' : 'Record'}
      </button>
    </div>
  );
}

export function LiveVisualizer(): React.ReactElement {
  const containerRef = useLivePianoRenderer();

  // Leaving Live mode mid-recording shouldn't leave the controller silently "still recording" —
  // stop it (discarding this take, since the modal that would offer to keep it is unmounting too).
  useEffect(() => {
    return () => {
      if (useLiveRecordingStore.getState().isRecording) useLiveRecordingStore.getState().stopRecording();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <LiveStatusPill />
      <LiveMetronomeControl />
      <RecordControl />
      <LiveRecordingModal />
    </div>
  );
}
