import { AnimatePresence, motion } from 'framer-motion';
import { Piano, Target, X } from 'lucide-react';
import { usePracticeStore } from '@/state/practiceStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { useSongStore } from '@/state/songStore';
import { useUiStore } from '@/state/uiStore';
import { SegmentedControl, Toggle } from '@/components/ui';
import type { PracticeHandMode } from '@/types';

const HAND_OPTIONS: { value: PracticeHandMode; label: string }[] = [
  { value: 'both', label: 'Both Hands' },
  { value: 'left', label: 'Left Only' },
  { value: 'right', label: 'Right Only' },
];

const COUNTDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '8', label: '8' },
];

function StatTile({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg bg-white/5 py-2">
      <span className="text-lg font-semibold text-white/90">{value}</span>
      <span className="text-[9px] tracking-[0.12em] text-white/40 uppercase">{label}</span>
    </div>
  );
}

export function PracticePanel(): React.ReactElement {
  const isOpen = useUiStore((s) => s.practicePanelOpen);
  const togglePanel = useUiStore((s) => s.togglePracticePanel);
  const settings = usePracticeStore((s) => s.settings);
  const stats = usePracticeStore((s) => s.stats);
  const update = usePracticeStore((s) => s.update);
  const toggleEnabled = usePracticeStore((s) => s.toggleEnabled);
  const connectMidi = usePracticeStore((s) => s.connectMidi);
  const midiSupported = usePracticeStore((s) => s.midiSupported);
  const midiConnected = usePracticeStore((s) => s.midiConnected);
  const connectedInputNames = usePracticeStore((s) => s.connectedInputNames);

  const query = useSongStore((s) => s.query);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const setLoopRegion = usePlaybackStore((s) => s.setLoopRegion);
  const loopRegion = usePlaybackStore((s) => s.loopRegion);

  const loopCurrentMeasure = (): void => {
    if (!query) return;
    const measure = query.getMeasureAtTime(currentTime);
    const start = query.getTimeAtMeasure(measure);
    const end = query.getTimeAtMeasure(measure + 1);
    setLoopRegion({ startTime: start, endTime: end, label: `Measure ${measure + 1}` });
  };

  const loopFourMeasures = (): void => {
    if (!query) return;
    const measure = query.getMeasureAtTime(currentTime);
    const start = query.getTimeAtMeasure(measure);
    const end = query.getTimeAtMeasure(measure + 4);
    setLoopRegion({ startTime: start, endTime: end, label: `Measures ${measure + 1}-${measure + 4}` });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: -360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -360, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel pointer-events-auto absolute top-3 bottom-3 left-3 z-40 flex w-80 flex-col rounded-2xl p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
              <Target size={15} /> Practice
            </h2>
            <button type="button" onClick={togglePanel} className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => void toggleEnabled()}
              className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                settings.enabled ? 'bg-blue-500/25 text-blue-200' : 'bg-white/8 text-white/70 hover:bg-white/12'
              }`}
            >
              {settings.enabled ? 'Practice Mode On' : 'Enable Practice Mode'}
            </button>

            {!midiSupported && (
              <p className="rounded-lg bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-200/80">
                Web MIDI isn't available in this browser context — connect a MIDI keyboard in the desktop app to get graded.
              </p>
            )}
            {midiSupported && !midiConnected && (
              <button
                type="button"
                onClick={() => void connectMidi()}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white/8 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/12"
              >
                <Piano size={15} /> Connect Piano
              </button>
            )}
            {midiSupported && midiConnected && (
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-[11px]">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connectedInputNames.length > 0 ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-white/60">
                  {connectedInputNames.length > 0 ? `Connected: ${connectedInputNames.join(', ')}` : 'Waiting for a MIDI keyboard…'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
              <StatTile label="Streak" value={String(stats.streak)} />
              <StatTile label="Best" value={String(stats.bestStreak)} />
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Hands</h3>
              <SegmentedControl
                options={HAND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={settings.handMode}
                onChange={(v) => update('handMode', v)}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <Toggle label="Wait for correct note" checked={settings.waitForCorrectNote} onChange={(v) => update('waitForCorrectNote', v)} />
              <Toggle label="Highlight mistakes" checked={settings.highlightMistakes} onChange={(v) => update('highlightMistakes', v)} />
              <Toggle label="Show upcoming notes" checked={settings.showUpcomingNotes} onChange={(v) => update('showUpcomingNotes', v)} />
              <Toggle label="Ghost notes" checked={settings.ghostNotes} onChange={(v) => update('ghostNotes', v)} />
              <Toggle label="Loop on mistake" checked={settings.loopOnMistake} onChange={(v) => update('loopOnMistake', v)} />
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Countdown</h3>
              <SegmentedControl
                options={COUNTDOWN_OPTIONS}
                value={String(settings.countdownBeats)}
                onChange={(v) => update('countdownBeats', Number(v) as 0 | 1 | 2 | 4 | 8)}
              />
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Looping</h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={loopCurrentMeasure}
                  className="flex-1 rounded-lg bg-white/5 py-2 text-[11px] text-white/70 transition-colors hover:bg-white/10"
                >
                  This Measure
                </button>
                <button
                  type="button"
                  onClick={loopFourMeasures}
                  className="flex-1 rounded-lg bg-white/5 py-2 text-[11px] text-white/70 transition-colors hover:bg-white/10"
                >
                  4 Measures
                </button>
              </div>
              {loopRegion && (
                <button
                  type="button"
                  onClick={() => setLoopRegion(null)}
                  className="mt-1.5 w-full rounded-lg py-1.5 text-[10px] text-white/40 hover:text-white/70"
                >
                  Clear loop ({loopRegion.label})
                </button>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
