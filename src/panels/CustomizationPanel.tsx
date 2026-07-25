import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import { useUiStore } from '@/state/uiStore';
import { useCustomizationStore } from '@/state/customizationStore';
import { useSongStore } from '@/state/songStore';
import { SegmentedControl, Slider, Toggle } from '@/components/ui';
import type { BackgroundStyle } from '@/types';

type Tab = 'appearance' | 'tracks';

const TABS: { readonly value: Tab; readonly label: string }[] = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'tracks', label: 'Tracks' },
];

const BACKGROUND_STYLE_OPTIONS: { readonly value: BackgroundStyle; readonly label: string }[] = [
  { value: 'matte', label: 'Matte' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'nebula', label: 'Nebula' },
  { value: 'midnight', label: 'Midnight' },
];

function ColorField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between text-xs text-white/70">
      <span className="font-medium tracking-wide text-white/60">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-white/50">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded-md border border-white/10 bg-transparent"
        />
      </span>
    </label>
  );
}

function SectionTitle({ children, description }: { readonly children: React.ReactNode; readonly description?: string }) {
  return (
    <div className="mt-5 mb-2 first:mt-0">
      <h3 className="text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">{children}</h3>
      {description && <p className="mt-0.5 text-[10.5px] leading-snug text-white/30">{description}</p>}
    </div>
  );
}

function AppearanceTab(): React.ReactElement {
  const settings = useCustomizationStore((s) => s.settings);
  const update = useCustomizationStore((s) => s.update);
  const resetToDefaults = useCustomizationStore((s) => s.resetToDefaults);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle description="Panel look and how rounded the falling notes are.">Depth</SectionTitle>
      <Slider
        label="Panel transparency"
        description="How see-through the floating UI panels (this one, the transport bar) are."
        value={settings.panelTransparency}
        min={0.15}
        max={1}
        onChange={(v) => update('panelTransparency', v)}
      />
      <Slider
        label="Note corner radius"
        description="How rounded the falling note blocks are."
        value={settings.cornerRadius}
        min={0}
        max={28}
        step={1}
        formatValue={(v) => `${v}px`}
        onChange={(v) => update('cornerRadius', v)}
      />

      <SectionTitle description="A fixed click track — independent of the song's tempo or the playback speed slider.">Metronome</SectionTitle>
      <Slider
        label="Tempo"
        value={settings.metronomeBpm}
        min={30}
        max={240}
        step={1}
        formatValue={(v) => `${v} BPM`}
        onChange={(v) => update('metronomeBpm', v)}
      />

      <SectionTitle description="What's rendered behind the piano.">Background</SectionTitle>
      <SegmentedControl options={BACKGROUND_STYLE_OPTIONS} value={settings.backgroundStyle} onChange={(v) => update('backgroundStyle', v)} />
      <ColorField label="Top" value={settings.backgroundGradient.from} onChange={(v) => update('backgroundGradient', { ...settings.backgroundGradient, from: v })} />
      <ColorField label="Bottom" value={settings.backgroundGradient.to} onChange={(v) => update('backgroundGradient', { ...settings.backgroundGradient, to: v })} />
      <Slider
        label="Particle amount"
        description="How many floating dust particles drift in the background (always on)."
        value={settings.particleAmount}
        min={0.25}
        max={1}
        onChange={(v) => update('particleAmount', v)}
      />
      <Toggle label="Light rays" checked={settings.showLightRays} onChange={(v) => update('showLightRays', v)} />
      <Toggle label="Vignette" checked={settings.showVignette} onChange={(v) => update('showVignette', v)} />

      <SectionTitle description="Colors for the falling notes and the keyboard.">Notes &amp; Hands</SectionTitle>
      <ColorField label="Right hand — start" value={settings.rightHandGradient.from} onChange={(v) => update('rightHandGradient', { ...settings.rightHandGradient, from: v })} />
      <ColorField label="Right hand — end" value={settings.rightHandGradient.to} onChange={(v) => update('rightHandGradient', { ...settings.rightHandGradient, to: v })} />
      <ColorField label="Left hand — start" value={settings.leftHandGradient.from} onChange={(v) => update('leftHandGradient', { ...settings.leftHandGradient, from: v })} />
      <ColorField label="Left hand — end" value={settings.leftHandGradient.to} onChange={(v) => update('leftHandGradient', { ...settings.leftHandGradient, to: v })} />
      <ColorField label="Keyboard" value={settings.keyboardColor} onChange={(v) => update('keyboardColor', v)} />
      <Toggle label="Note name labels" checked={settings.showNoteLabels} onChange={(v) => update('showNoteLabels', v)} />
      <Slider
        label="Note width"
        description="How wide the falling notes are relative to their key."
        value={settings.noteWidthScale}
        min={0.5}
        max={1.5}
        onChange={(v) => update('noteWidthScale', v)}
      />

      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        className="mt-5 flex w-full items-center justify-between text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase transition-colors hover:text-white/55"
      >
        <span>Advanced</span>
        <ChevronDown size={13} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
      </button>
      {advancedOpen && (
        <div className="flex flex-col gap-3 pt-1">
          <Slider
            label="Animation speed"
            description="Playback speed of the app's own UI animations — not song tempo."
            value={settings.animationSpeed}
            min={0.5}
            max={2}
            onChange={(v) => update('animationSpeed', v)}
          />
          <Toggle label="FPS counter" checked={settings.showFpsCounter} onChange={(v) => update('showFpsCounter', v)} />
        </div>
      )}

      <button
        type="button"
        onClick={resetToDefaults}
        className="mt-4 rounded-lg border border-white/10 py-2 text-[11px] text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
      >
        Reset to defaults
      </button>
    </div>
  );
}

function TracksTab(): React.ReactElement {
  const song = useSongStore((s) => s.song);
  const setTrackMuted = useSongStore((s) => s.setTrackMuted);
  const setTrackColor = useSongStore((s) => s.setTrackColor);
  const setTrackHandHint = useSongStore((s) => s.setTrackHandHint);

  if (!song) return <p className="text-xs text-white/40">Load a song to see its tracks.</p>;

  return (
    <div className="flex flex-col gap-2">
      {song.tracks.map((track) => (
        <div key={track.index} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
          <input
            type="color"
            value={track.color}
            onChange={(e) => setTrackColor(track.index, e.target.value)}
            className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-white/10 bg-transparent"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white/85">{track.name}</p>
            <p className="text-[10px] text-white/40">
              {track.notes.length} notes · {track.instrument.name}
            </p>
          </div>
          <select
            value={track.handHint}
            onChange={(e) => setTrackHandHint(track.index, e.target.value as typeof track.handHint)}
            className="rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-white/70"
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="both">Both</option>
            <option value="unknown">Auto</option>
          </select>
          <button
            type="button"
            onClick={() => setTrackMuted(track.index, !track.muted)}
            className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
              track.muted ? 'bg-red-500/25 text-red-200' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {track.muted ? 'Muted' : 'Mute'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function CustomizationPanel(): React.ReactElement {
  const isOpen = useUiStore((s) => s.customizationPanelOpen);
  const close = useUiStore((s) => s.setCustomizationPanelOpen);
  const [tab, setTab] = useState<Tab>('appearance');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel pointer-events-auto absolute top-3 right-3 bottom-3 z-40 flex w-80 flex-col rounded-2xl p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Customize</h2>
            <button type="button" onClick={() => close(false)} className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <SegmentedControl options={TABS} value={tab} onChange={setTab} className="mb-4" />

          <div className="flex-1 overflow-y-auto pr-1">
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'tracks' && <TracksTab />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
