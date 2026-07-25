import { useMemo, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Target,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlaybackStore } from '@/state/playbackStore';
import { useUiStore } from '@/state/uiStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useCameraStore } from '@/state/cameraStore';
import { useFullscreen } from '@/hooks/useFullscreen';
import { MAX_TEMPO_MULTIPLIER, MIN_TEMPO_MULTIPLIER } from '@/types';
import { computeSeekStepSeconds } from '@/utils/seek';
import { Chip, IconButton, Slider } from './ui';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function Divider(): React.ReactElement {
  return <div className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />;
}

interface TransportBarProps {
  readonly onPlayClick: () => void;
}

export function TransportBar({ onPlayClick }: TransportBarProps): React.ReactElement {
  const status = usePlaybackStore((s) => s.status);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const tempoMultiplier = usePlaybackStore((s) => s.tempoMultiplier);
  const isMuted = usePlaybackStore((s) => s.isMuted);
  const masterVolumeDb = usePlaybackStore((s) => s.masterVolumeDb);
  const loopRegion = usePlaybackStore((s) => s.loopRegion);
  const metronomeEnabled = usePlaybackStore((s) => s.metronomeEnabled);

  const restart = usePlaybackStore((s) => s.restart);
  const seek = usePlaybackStore((s) => s.seek);
  const setTempoMultiplier = usePlaybackStore((s) => s.setTempoMultiplier);
  const setMasterVolumeDb = usePlaybackStore((s) => s.setMasterVolumeDb);
  const toggleMute = usePlaybackStore((s) => s.toggleMute);
  const toggleMetronome = usePlaybackStore((s) => s.toggleMetronome);
  const setLoopRegion = usePlaybackStore((s) => s.setLoopRegion);

  const highwayZoom = useCameraStore((s) => s.highwayZoom);
  const setHighwayZoom = useCameraStore((s) => s.setHighwayZoom);

  const mode = useUiStore((s) => s.mode);
  const controlsVisible = useUiStore((s) => s.controlsVisible);
  const transportCollapsed = useUiStore((s) => s.transportCollapsed);
  const toggleTransportCollapsed = useUiStore((s) => s.toggleTransportCollapsed);
  const toggleCustomizationPanel = useUiStore((s) => s.toggleCustomizationPanel);
  const togglePracticePanel = useUiStore((s) => s.togglePracticePanel);
  const toggleExportPanel = useUiStore((s) => s.toggleExportPanel);
  const practiceEnabled = usePracticeStore((s) => s.settings.enabled);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [isScrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const displayedTime = isScrubbing ? scrubValue : currentTime;
  const progressPercent = duration > 0 ? (displayedTime / duration) * 100 : 0;

  const volumeIcon = useMemo(() => {
    if (isMuted || masterVolumeDb <= -60) return <VolumeX size={17} />;
    if (masterVolumeDb < -20) return <Volume1 size={17} />;
    return <Volume2 size={17} />;
  }, [isMuted, masterVolumeDb]);

  const handleSeekChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setScrubbing(true);
    setScrubValue(Number(event.target.value));
  };
  const commitSeek = (event: { currentTarget: HTMLInputElement }): void => {
    seek(scrubValue);
    setScrubbing(false);
    // Don't leave the slider focused after a drag: a focused range input intercepts arrow-key
    // presses as its own native stepping instead of the app's seek shortcuts.
    event.currentTarget.blur();
  };

  const toggleLoopWholeSong = (): void => {
    if (loopRegion) setLoopRegion(null);
    else setLoopRegion({ startTime: 0, endTime: duration, label: 'Whole song' });
  };

  const seekStepSeconds = computeSeekStepSeconds(tempoMultiplier);
  const skipBack = (): void => seek(Math.max(0, currentTime - seekStepSeconds));
  const skipForward = (): void => seek(Math.min(duration, currentTime + seekStepSeconds));

  return (
    <AnimatePresence>
      {controlsVisible && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center">
          <AnimatePresence mode="wait">
            {transportCollapsed ? (
              <motion.button
                key="handle"
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                onClick={toggleTransportCollapsed}
                aria-label="Show controls"
                className="glass-panel pointer-events-auto flex h-7 w-16 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
              >
                <ChevronUp size={16} />
              </motion.button>
            ) : (
              <motion.div
                key="bar"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="glass-panel pointer-events-auto relative w-[min(96vw,1080px)] rounded-2xl px-5 pt-4 pb-3"
              >
                <button
                  type="button"
                  onClick={toggleTransportCollapsed}
                  aria-label="Hide controls"
                  className="absolute -top-3 left-1/2 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-[#12141f] text-white/40 shadow-md transition-colors hover:text-white"
                >
                  <ChevronDown size={14} />
                </button>

                <div className="mb-3 flex items-center gap-3">
                  <span className="w-10 shrink-0 font-mono text-[11px] text-white/50">{formatTime(displayedTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.01, duration)}
                    step={0.01}
                    value={displayedTime}
                    onChange={handleSeekChange}
                    onMouseUp={commitSeek}
                    onTouchEnd={commitSeek}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none"
                    style={{
                      background: `linear-gradient(to right, var(--color-accent) ${progressPercent}%, rgba(255,255,255,0.14) ${progressPercent}%)`,
                    }}
                  />
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] text-white/50">{formatTime(duration)}</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
                  <IconButton label="Restart" size="sm" onClick={restart}>
                    <RotateCcw size={15} />
                  </IconButton>
                  <IconButton label={`Back ${seekStepSeconds.toFixed(2).replace(/\.?0+$/, '')}s`} size="sm" onClick={skipBack}>
                    <SkipBack size={15} />
                  </IconButton>
                  <IconButton label={status === 'playing' ? 'Pause' : 'Play'} size="lg" variant="solid" onClick={onPlayClick}>
                    {status === 'playing' ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
                  </IconButton>
                  <IconButton label={`Forward ${seekStepSeconds.toFixed(2).replace(/\.?0+$/, '')}s`} size="sm" onClick={skipForward}>
                    <SkipForward size={15} />
                  </IconButton>
                  <IconButton label="Loop whole song" size="sm" active={Boolean(loopRegion)} onClick={toggleLoopWholeSong}>
                    <Repeat size={15} />
                  </IconButton>

                  <Divider />

                  <Slider
                    variant="inline"
                    label="Speed"
                    value={tempoMultiplier}
                    min={MIN_TEMPO_MULTIPLIER}
                    max={MAX_TEMPO_MULTIPLIER}
                    step={0.05}
                    onChange={setTempoMultiplier}
                    formatValue={(v) => `${v.toFixed(2)}×`}
                  />

                  <Slider variant="inline" label="Zoom" value={highwayZoom} min={0.4} max={2} step={0.05} onChange={setHighwayZoom} formatValue={(v) => `${v.toFixed(2)}×`} />

                  <Chip active={metronomeEnabled} onClick={toggleMetronome}>
                    Metronome
                  </Chip>

                  <div className="flex items-center gap-2 px-0.5">
                    <IconButton label={isMuted ? 'Unmute' : 'Mute'} size="sm" onClick={toggleMute}>
                      {volumeIcon}
                    </IconButton>
                    <Slider
                      variant="inline"
                      label="Vol"
                      value={isMuted ? -60 : masterVolumeDb}
                      min={-60}
                      max={6}
                      step={1}
                      onChange={setMasterVolumeDb}
                      formatValue={(v) => `${v}dB`}
                    />
                  </div>

                  <Divider />

                  {mode === 'learn' && (
                    <IconButton label="Practice" size="sm" active={practiceEnabled} onClick={togglePracticePanel}>
                      <Target size={15} />
                    </IconButton>
                  )}
                  <IconButton label="Customize" size="sm" onClick={toggleCustomizationPanel}>
                    <SlidersHorizontal size={15} />
                  </IconButton>
                  <IconButton label="Export" size="sm" onClick={toggleExportPanel}>
                    <Download size={15} />
                  </IconButton>

                  <IconButton label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} size="sm" onClick={toggleFullscreen}>
                    {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                  </IconButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
