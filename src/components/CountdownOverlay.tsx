import { AnimatePresence, motion } from 'framer-motion';

interface CountdownOverlayProps {
  readonly visible: boolean;
  readonly count: number;
}

export function CountdownOverlay({ visible, count }: CountdownOverlayProps): React.ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={count}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-32 w-32 items-center justify-center rounded-full text-6xl font-semibold text-white"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.35), rgba(59,130,246,0.05) 70%)',
              textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          >
            {count}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
