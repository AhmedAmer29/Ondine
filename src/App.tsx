import { useEffect } from 'react';
import {
  CountdownOverlay,
  DebugOverlay,
  DropOverlay,
  EmptyState,
  ExportRecordingOverlay,
  InfoOverlay,
  LearnHub,
  LiveVisualizer,
  QueuePanel,
  TitleBar,
  TransportBar,
  Visualizer,
} from '@/components';
import { CustomizationPanel, ExportPanel, PracticePanel } from '@/panels';
import { useSongStore } from '@/state/songStore';
import { useCustomizationStore } from '@/state/customizationStore';
import { useUiStore } from '@/state/uiStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { usePlaybackClock } from '@/hooks/usePlaybackClock';
import { useAutoHideControls } from '@/hooks/useAutoHideControls';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMidiDragAndDrop } from '@/hooks/useMidiDragAndDrop';
import { useCountdown } from '@/hooks/useCountdown';
import { usePlaylistAutoAdvance } from '@/hooks/usePlaylistAutoAdvance';
import { useModeTransitions } from '@/hooks/useModeTransitions';
import { getMidiInputManager } from '@/practice/midiInput';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';

function App(): React.ReactElement {
  const mode = useUiStore((s) => s.mode);
  const song = useSongStore((s) => s.song);
  const fontFamily = useCustomizationStore((s) => s.settings.fontFamily);
  const panelTransparency = useCustomizationStore((s) => s.settings.panelTransparency);
  const metronomeBpm = useCustomizationStore((s) => s.settings.metronomeBpm);
  const { isDraggingOver } = useMidiDragAndDrop();
  const { isCounting, countValue, triggerPlay } = useCountdown();

  usePlaybackClock();
  useAutoHideControls();
  useKeyboardShortcuts();
  usePlaylistAutoAdvance();
  useModeTransitions();

  // Ask for the Web MIDI permission once, right at launch, instead of leaving it to surprise
  // whichever feature (Practice, Live) first happens to touch a MIDI keyboard. WebView2 (like any
  // Chromium-based browser) remembers a grant per-origin, so this is a one-time prompt across the
  // app's lifetime — there's no Tauri/wry API in this version to suppress the prompt outright, so
  // getting it out of the way at boot is the closest available fix.
  useEffect(() => {
    void getMidiInputManager().start();
  }, []);

  useEffect(() => {
    document.body.style.fontFamily = fontFamily;
  }, [fontFamily]);

  useEffect(() => {
    document.documentElement.style.setProperty('--panel-alpha', String(panelTransparency));
  }, [panelTransparency]);

  useEffect(() => {
    if (Number.isFinite(metronomeBpm) && metronomeBpm > 0) {
      getPlaybackEngine().setMetronomeBpm(metronomeBpm);
    }
  }, [metronomeBpm]);

  // Live mode is a separate audio context (free play, not song playback) — silence the song
  // on the way out so it doesn't keep audibly playing in the background while looking at Live.
  // Play <-> Learn intentionally does NOT pause here: that transition is orchestrated by
  // useModeTransitions, which pauses only as part of re-arming practice mode's count-in.
  useEffect(() => {
    if (mode === 'live') usePlaybackStore.getState().pause();
  }, [mode]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--color-surface)]">
      <TitleBar />

      <div className="relative flex-1">
        {(mode === 'play' || mode === 'learn') && (
          <>
            <Visualizer />
            {!song && (mode === 'play' ? <EmptyState /> : <LearnHub />)}
            {song && (
              <>
                <InfoOverlay />
                <TransportBar onPlayClick={triggerPlay} />
                <CountdownOverlay visible={isCounting} count={countValue} />
              </>
            )}
            <CustomizationPanel />
            <ExportPanel />
            {mode === 'learn' && <PracticePanel />}
            <QueuePanel />
            <DebugOverlay />
            <DropOverlay visible={isDraggingOver} />
          </>
        )}
        {mode === 'live' && <LiveVisualizer />}
      </div>

      {/* Rendered at the root (not inside the mode-conditional content above) and `fixed` so it
          covers the title bar's mode tabs/theme dropdown too — an export shouldn't be interruptible
          by switching away from it. */}
      <ExportRecordingOverlay />
    </div>
  );
}

export default App;
