import { usePianoFlowRenderer } from '@/hooks/usePianoFlowRenderer';

/** Hosts the PixiJS canvas. All rendering happens inside PianoFlowRenderer's own ticker — this component never re-renders per frame. */
export function Visualizer(): React.ReactElement {
  const containerRef = usePianoFlowRenderer();
  return <div ref={containerRef} className="absolute inset-0" />;
}
