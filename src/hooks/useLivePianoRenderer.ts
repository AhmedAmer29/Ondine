import { useEffect, useRef } from 'react';
import { LivePianoRenderer } from '@/renderer';
import { useCustomizationStore } from '@/state/customizationStore';
import { getLiveInputController } from '@/live/LiveInputController';

/**
 * Mounts a `LivePianoRenderer` into a container element — the Live-mode counterpart to
 * `usePianoFlowRenderer`, much smaller since there's no song/timeline/practice-engine wiring.
 * Connects the shared MIDI input manager for as long as Live mode is mounted; disconnecting on
 * unmount only ever unsubscribes (never calls `MidiInputManager.stop()`, which would tear down
 * every other consumer's connection, Practice mode's included).
 */
export function useLivePianoRenderer(): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LivePianoRenderer | null>(null);

  const settings = useCustomizationStore((s) => s.settings);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const renderer = new LivePianoRenderer(useCustomizationStore.getState().settings);
    rendererRef.current = renderer;

    renderer.mount(el).then(() => {
      if (disposed) {
        renderer.destroy();
      }
    });

    getLiveInputController().connectMidi();

    return () => {
      disposed = true;
      rendererRef.current = null;
      renderer.destroy();
      getLiveInputController().disconnectMidi();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setCustomization(settings);
  }, [settings]);

  return containerRef;
}
