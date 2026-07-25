import { BookOpen, Flame, Gauge, Lock, Music2, PenLine, Sparkles, Upload, Waves } from 'lucide-react';
import { useSongStore } from '@/state/songStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useLearnStore } from '@/state/learnStore';
import { pickMidiFile } from '@/utils/fileDialog';
import { countdownController } from '@/practice/countdown';

interface SkillTrack {
  readonly icon: React.ComponentType<{ size?: number }>;
  readonly title: string;
  readonly blurb: string;
}

const SKILL_TRACKS: readonly SkillTrack[] = [
  { icon: Waves, title: 'Ear Training', blurb: 'Two notes ring out — name the distance between them.' },
  { icon: BookOpen, title: 'Music Theory', blurb: 'Scales, chords, and key signatures, taught through the keys.' },
  { icon: Gauge, title: 'Sight Reading', blurb: 'Notation scrolls toward the hit line — read ahead, land the note.' },
  { icon: Sparkles, title: 'Finger Technique', blurb: 'Short drills for evenness, speed, and hand independence.' },
  { icon: PenLine, title: 'Session Review', blurb: 'Accuracy and streaks from your recent practice, at a glance.' },
];

export function LearnHub(): React.ReactElement {
  const streak = useLearnStore((s) => s.streak);
  const loadFromPath = useSongStore((s) => s.loadFromPath);
  const loadFromFile = useSongStore((s) => s.loadFromFile);

  const handlePlayAlong = async (): Promise<void> => {
    const { path, file } = await pickMidiFile();
    if (path) await loadFromPath(path);
    else if (file) await loadFromFile(file);
    else return;

    const practice = usePracticeStore.getState();
    if (!practice.settings.waitForCorrectNote) practice.update('waitForCorrectNote', true);
    if (!practice.settings.enabled) await practice.toggleEnabled();

    useLearnStore.getState().recordActivity();
    countdownController.trigger();
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[var(--color-surface)] px-6 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-white/95">Practice</h1>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 text-orange-400">
              <Flame size={13} />
              <span className="text-sm font-semibold">{streak}</span>
              <span className="text-[10px] font-medium tracking-[0.1em] text-white/40 uppercase">day streak</span>
            </div>
          )}
        </div>

        <div className="glass-panel relative overflow-hidden rounded-3xl p-6">
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
              <Music2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white/95">Practice with a song</h2>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
                Bring in any MIDI file and it'll wait at each chord until you play the right notes — work through it at your own pace, hands
                together or apart.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePlayAlong()}
              className="flex w-fit items-center gap-2 rounded-xl bg-orange-500/90 px-4 py-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-orange-400"
            >
              <Upload size={14} />
              Choose a MIDI file
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Skill tracks</h3>
          <div className="relative flex flex-col">
            <div className="absolute top-2 bottom-2 left-[15px] w-px bg-white/8" />
            {SKILL_TRACKS.map((track, i) => (
              <div key={track.title} className="relative flex cursor-not-allowed items-center gap-4 py-3 opacity-60">
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[var(--color-surface)] text-[11px] font-semibold text-white/40">
                  {i + 1}
                </span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/45">
                  <track.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-white/75">{track.title}</h4>
                  <p className="mt-0.5 truncate text-[11px] text-white/35">{track.blurb}</p>
                </div>
                <Lock size={13} className="shrink-0 text-white/25" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
