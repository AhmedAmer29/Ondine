import { AnimatePresence, motion } from 'framer-motion';
import { FileMusic } from 'lucide-react';

interface DropOverlayProps {
  readonly visible: boolean;
}

export function DropOverlay({ visible }: DropOverlayProps): React.ReactElement {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="m-8 flex flex-1 flex-col items-center justify-center gap-3 self-stretch rounded-3xl border-2 border-dashed border-blue-400/50 bg-blue-500/5"
          >
            <FileMusic size={40} className="text-blue-300" />
            <p className="text-sm font-medium text-white/85">Drop your MIDI file to load it</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
