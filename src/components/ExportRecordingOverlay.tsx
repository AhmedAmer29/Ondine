import { AnimatePresence, motion } from 'framer-motion';
import { Film, Pause } from 'lucide-react';
import { useExportStore } from '@/state/exportStore';

/**
 * Blocks interaction with the *entire app* — mode tabs, theme dropdown, window controls, the
 * piano, all of it — while a video/GIF/PNG-sequence export is recording. These exports render
 * the same live scene the user is looking at (or, for video, the same live audio engine), so
 * switching modes or clicking a key mid-capture would visibly/audibly corrupt the output.
 * Rendered at the app root as a `fixed inset-0` overlay (not scoped to the visualizer area) so it
 * covers the title bar too; the Export panel (z-40) stays above it so progress/pause/cancel
 * remain reachable.
 */
export function ExportRecordingOverlay(): React.ReactElement {
  const isRunning = useExportStore((s) => s.isRunning);
  const isPaused = useExportStore((s) => s.isPaused);
  const progressMessage = useExportStore((s) => s.progressMessage);
  const progressFraction = useExportStore((s) => s.progressFraction);

  return (
    <AnimatePresence>
      {isRunning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-[35] flex items-center justify-center bg-black/65 backdrop-blur-sm"
        >
          <div className="glass-panel flex w-72 flex-col items-center gap-3 rounded-2xl p-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
              {isPaused ? <Pause size={20} /> : <Film size={20} />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90">{isPaused ? 'Paused' : 'Recording in progress…'}</h2>
              <p className="mt-1 text-[11px] text-white/50">{isPaused ? 'Resume from the Export panel to continue.' : progressMessage || 'The app is locked while this exports.'}</p>
              <p className="mt-2 text-[10px] text-red-300/70">⚠ Do not close the app during export</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${Math.round(progressFraction * 100)}%` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
