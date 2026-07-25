import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, Upload } from 'lucide-react';
import { useSongStore } from '@/state/songStore';
import { useUiStore } from '@/state/uiStore';
import { pickMidiFile } from '@/utils/fileDialog';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function EmptyState(): React.ReactElement {
  const recentFiles = useSongStore((s) => s.recentFiles);
  const loadFromPath = useSongStore((s) => s.loadFromPath);
  const loadFromFile = useSongStore((s) => s.loadFromFile);
  const toggleFavorite = useSongStore((s) => s.toggleFavorite);
  const isLoading = useSongStore((s) => s.isLoading);
  const loadError = useSongStore((s) => s.loadError);
  const query = useUiStore((s) => s.librarySearchQuery);
  const setQuery = useUiStore((s) => s.setLibrarySearchQuery);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? recentFiles.filter((f) => f.name.toLowerCase().includes(q)) : recentFiles;
    return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastOpened - a.lastOpened);
  }, [recentFiles, query]);

  const handleOpen = async (): Promise<void> => {
    const { path, file } = await pickMidiFile();
    if (path) await loadFromPath(path);
    else if (file) await loadFromFile(file);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface)] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-xl flex-col items-center gap-8"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <img src="/favicon.svg" alt="" className="h-16 w-16" draggable={false} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Ondine</h1>
            <p className="mt-1 text-sm text-white/50">Drop a MIDI file anywhere, or choose one below.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleOpen()}
            disabled={isLoading}
            className="glass-panel flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Upload size={15} />
            {isLoading ? 'Loading…' : 'Open MIDI File'}
          </button>
          {loadError && <p className="text-xs text-red-400">{loadError}</p>}
        </div>

        {recentFiles.length > 0 && (
          <div className="glass-panel w-full rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
              <Search size={13} className="text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recent songs"
                className="w-full bg-transparent text-xs text-white/80 outline-none placeholder:text-white/30"
              />
            </div>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {filtered.map((entry) => (
                <div
                  key={entry.path}
                  className="group flex items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/6"
                >
                  <button type="button" className="flex min-w-0 flex-1 flex-col text-left" onClick={() => void loadFromPath(entry.path)}>
                    <span className="truncate text-xs font-medium text-white/85">{entry.name}</span>
                    <span className="text-[10px] text-white/40">{formatDuration(entry.durationSeconds)}</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Favorite"
                    onClick={() => toggleFavorite(entry.path)}
                    className="ml-1 shrink-0 rounded-md p-1.5 text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-yellow-300 data-[active=true]:opacity-100 data-[active=true]:text-yellow-300"
                    data-active={entry.favorite}
                  >
                    <Star size={13} fill={entry.favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-white/30">No matches.</p>}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
