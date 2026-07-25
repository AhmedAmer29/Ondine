import { AnimatePresence, motion } from 'framer-motion';
import { ListMusic, Trash2, X } from 'lucide-react';
import { useUiStore } from '@/state/uiStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useSongStore } from '@/state/songStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { Toggle } from './ui';

export function QueuePanel(): React.ReactElement {
  const isOpen = useUiStore((s) => s.queuePanelOpen);
  const toggle = useUiStore((s) => s.toggleQueuePanel);
  const queue = usePlaylistStore((s) => s.queue);
  const currentIndex = usePlaylistStore((s) => s.currentIndex);
  const autoAdvance = usePlaylistStore((s) => s.autoAdvance);
  const setAutoAdvance = usePlaylistStore((s) => s.setAutoAdvance);
  const removeFromQueue = usePlaylistStore((s) => s.removeFromQueue);
  const clearQueue = usePlaylistStore((s) => s.clearQueue);
  const loadFromPath = useSongStore((s) => s.loadFromPath);

  const playItem = (path: string): void => {
    void loadFromPath(path).then(() => void usePlaybackStore.getState().play());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel pointer-events-auto absolute right-6 bottom-24 z-40 flex max-h-96 w-72 flex-col rounded-2xl p-3"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
              <ListMusic size={13} /> Queue
            </h2>
            <button type="button" onClick={toggle} className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white">
              <X size={13} />
            </button>
          </div>

          <div className="mb-2 px-1">
            <Toggle label="Auto-advance" checked={autoAdvance} onChange={setAutoAdvance} />
          </div>

          <div className="flex-1 overflow-y-auto">
            {queue.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-white/35">Queue is empty. Add songs from Recent Files.</p>}
            {queue.map((item, index) => (
              <div
                key={item.path}
                className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] ${
                  index === currentIndex ? 'bg-blue-500/15 text-blue-200' : 'text-white/70 hover:bg-white/6'
                }`}
              >
                <button type="button" onClick={() => playItem(item.path)} className="min-w-0 flex-1 truncate text-left">
                  {item.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromQueue(item.path)}
                  className="ml-1 shrink-0 rounded p-1 text-white/30 opacity-0 hover:text-red-300 group-hover:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {queue.length > 0 && (
            <button type="button" onClick={clearQueue} className="mt-2 rounded-lg py-1.5 text-[10px] text-white/35 hover:text-white/70">
              Clear queue
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
