import { useEffect, useRef } from 'react';
import { PianoFlowRenderer } from '@/renderer';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';
import { getPracticeEngine } from '@/practice/PracticeEngine';
import { useSongStore } from '@/state/songStore';
import { useCustomizationStore } from '@/state/customizationStore';
import { useCameraStore } from '@/state/cameraStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useDebugStore } from '@/state/debugStore';

const STATS_REFRESH_INTERVAL_MS = 250;

/**
 * Mounts a `PianoFlowRenderer` into a container element and keeps it in sync
 * with the Zustand stores. Store subscriptions here only fire when a relevant
 * slice actually changes (a new song, a settings tweak, the highway zoom) —
 * the 60-144fps playback position is read directly from the audio engine
 * inside the renderer's own ticker, never through React state.
 *
 * This hook also drives the practice engine's per-frame judging loop, since
 * it needs to push results (which notes are awaited, which were missed) into
 * the same renderer instance every frame.
 */
export function usePianoFlowRenderer(): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PianoFlowRenderer | null>(null);

  const song = useSongStore((s) => s.song);
  const settings = useCustomizationStore((s) => s.settings);
  const highwayZoom = useCameraStore((s) => s.highwayZoom);
  const practiceSettings = usePracticeStore((s) => s.settings);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const renderer = new PianoFlowRenderer(useCustomizationStore.getState().settings, useCameraStore.getState());
    rendererRef.current = renderer;

    renderer.mount(el).then(() => {
      if (disposed) {
        renderer.destroy();
        return;
      }
      renderer.setTimeProvider(() => getPlaybackEngine().getCurrentTime());
      const currentSong = useSongStore.getState().song;
      if (currentSong) renderer.setSong(currentSong);
    });

    return () => {
      disposed = true;
      rendererRef.current = null;
      renderer.destroy();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setSong(song);
    void getPracticeEngine().setSong(song);
  }, [song]);

  useEffect(() => {
    rendererRef.current?.setCustomization(settings);
  }, [settings]);

  useEffect(() => {
    rendererRef.current?.setCameraState({ highwayZoom });
  }, [highwayZoom]);

  useEffect(() => {
    const engine = getPracticeEngine();
    engine.setSettings(practiceSettings);
    rendererRef.current?.setPracticeHandMode(practiceSettings.enabled ? practiceSettings.handMode : 'both');
  }, [practiceSettings]);

  useEffect(() => {
    const unsubscribe = getPracticeEngine().onMistake((midi) => {
      rendererRef.current?.flashKeyMistake(midi);
      usePracticeStore.getState().flashMistake(midi);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let frameId: number;
    let lastStatsRefresh = 0;

    const loop = (timestamp: number): void => {
      const renderer = rendererRef.current;
      const practiceEngine = getPracticeEngine();
      if (renderer && usePracticeStore.getState().settings.enabled) {
        practiceEngine.tick(getPlaybackEngine().getCurrentTime());
        renderer.setPracticeAwaitingNotes(practiceEngine.getAwaitingNoteIds());
        renderer.setPracticeJudgements(practiceEngine.getJudgementValues());
      }

      if (renderer && timestamp - lastStatsRefresh > STATS_REFRESH_INTERVAL_MS) {
        lastStatsRefresh = timestamp;
        if (usePracticeStore.getState().settings.enabled) usePracticeStore.getState().refreshStats();
        useDebugStore.getState().setStats(renderer.getStats());
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return containerRef;
}
