import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Download, FileMusic, FolderOpen, Pause, Play, X } from 'lucide-react';
import { useUiStore } from '@/state/uiStore';
import { useExportStore } from '@/state/exportStore';
import { useSongStore } from '@/state/songStore';
import { usePlaybackStore } from '@/state/playbackStore';
import { SegmentedControl, Slider, Toggle } from '@/components/ui';
import { EXPORT_RESOLUTIONS, resolveExportDimensions, type ExportAspect, type ExportFormat } from '@/types';
import { isTauriRuntime } from '@/utils/windowControls';
import { getExportsRootPath, openExportsRootFolder, revealExport } from '@/utils/saveFile';
import { saveMidiFile } from '@/export/writeMidiFile';
import { saveSheetMusicPdf } from '@/export/writeSheetMusicPdf';

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'png-sequence', label: 'PNG Sequence' },
  { value: 'gif', label: 'GIF' },
  { value: 'mp4', label: 'Video' },
];

const ASPECT_OPTIONS: { value: ExportAspect; label: string }[] = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
];

const FPS_OPTIONS: { readonly value: string; readonly label: string }[] = [
  { value: '24', label: '24' },
  { value: '30', label: '30' },
  { value: '60', label: '60' },
  { value: '120', label: '120' },
];

/** Shown in place of the settings form right after an export finishes — the previous run's settings stay untouched underneath until "Export something new" clears this. */
function CompletedView({ outputPath, isDirectory, onStartNew }: { readonly outputPath: string; readonly isDirectory: boolean; readonly onStartNew: () => void }) {
  const runtimeReady = isTauriRuntime();
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async (): Promise<void> => {
    setError(null);
    try {
      await revealExport(outputPath, isDirectory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the folder.');
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
        <CheckCircle2 size={24} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white/90">Export complete</h3>
        {runtimeReady && <p className="mt-1 break-all text-[11px] text-white/40">{outputPath}</p>}
        {!runtimeReady && <p className="mt-1 text-[11px] text-white/40">Check your browser's downloads.</p>}
      </div>
      {error && <p className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{error}</p>}
      <div className="flex w-full flex-col gap-2">
        {runtimeReady && (
          <button
            type="button"
            onClick={() => void handleOpen()}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/8 py-2.5 text-[12px] font-medium text-white/85 transition-colors hover:bg-white/12"
          >
            <FolderOpen size={14} />
            Open folder
          </button>
        )}
        <button
          type="button"
          onClick={onStartNew}
          className="rounded-xl bg-[var(--color-accent)] py-2.5 text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
        >
          Export something new
        </button>
      </div>
    </div>
  );
}

export function ExportPanel(): React.ReactElement {
  const isOpen = useUiStore((s) => s.exportPanelOpen);
  const toggleOpen = useUiStore((s) => s.toggleExportPanel);
  const song = useSongStore((s) => s.song);
  const duration = usePlaybackStore((s) => s.duration);

  const settings = useExportStore((s) => s.settings);
  const update = useExportStore((s) => s.update);
  const start = useExportStore((s) => s.start);
  const cancel = useExportStore((s) => s.cancel);
  const finish = useExportStore((s) => s.finish);
  const pause = useExportStore((s) => s.pause);
  const resume = useExportStore((s) => s.resume);
  const isRunning = useExportStore((s) => s.isRunning);
  const isPaused = useExportStore((s) => s.isPaused);
  const isFinishing = useExportStore((s) => s.isFinishing);
  const progressMessage = useExportStore((s) => s.progressMessage);
  const progressFraction = useExportStore((s) => s.progressFraction);
  const errorMessage = useExportStore((s) => s.errorMessage);
  const lastCompleted = useExportStore((s) => s.lastCompleted);
  const dismissCompleted = useExportStore((s) => s.dismissCompleted);

  const runtimeReady = isTauriRuntime();
  const endTime = settings.endTime > settings.startTime ? settings.endTime : duration;
  const exportNamePlaceholder = song?.name ?? 'export';

  const [isSavingMidi, setIsSavingMidi] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [exportsRootPath, setExportsRootPath] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    if (!runtimeReady) return;
    void getExportsRootPath().then(setExportsRootPath);
  }, [runtimeReady]);

  const handleOpenExportsFolder = async (): Promise<void> => {
    setFolderError(null);
    try {
      await openExportsRootFolder();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not open the exports folder.');
    }
  };

  const handleExportMidi = async (): Promise<void> => {
    if (!song) return;
    setDocumentError(null);
    setIsSavingMidi(true);
    try {
      await saveMidiFile(song);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Failed to export MIDI file.');
    } finally {
      setIsSavingMidi(false);
    }
  };

  const handleExportPdf = async (): Promise<void> => {
    if (!song) return;
    setDocumentError(null);
    setIsSavingPdf(true);
    try {
      await saveSheetMusicPdf(song);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Failed to export sheet music.');
    } finally {
      setIsSavingPdf(false);
    }
  };

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
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
              <Download size={15} /> Export
            </h2>
            <button type="button" onClick={toggleOpen} className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white">
              <X size={15} />
            </button>
          </div>

          {lastCompleted ? (
            <CompletedView outputPath={lastCompleted.outputPath} isDirectory={lastCompleted.isDirectory} onStartNew={dismissCompleted} />
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-2">
                <h3 className="text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Document</h3>
                <button
                  type="button"
                  disabled={!song || isSavingMidi}
                  onClick={() => void handleExportMidi()}
                  className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-left text-[12px] font-medium text-white/85 transition-colors hover:bg-white/8 disabled:opacity-40"
                >
                  <Download size={14} className="shrink-0 text-white/60" />
                  {isSavingMidi ? 'Saving…' : 'Export MIDI (.mid)'}
                </button>
                <button
                  type="button"
                  disabled={!song || isSavingPdf}
                  onClick={() => void handleExportPdf()}
                  className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-left text-[12px] font-medium text-white/85 transition-colors hover:bg-white/8 disabled:opacity-40"
                >
                  <FileMusic size={14} className="shrink-0 text-white/60" />
                  {isSavingPdf ? 'Rendering…' : 'Export Sheet Music (.pdf)'}
                </button>
                {documentError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{documentError}</p>}
              </div>

              {runtimeReady && (
                <div className="mb-4 rounded-xl bg-white/5 p-3">
                  <h3 className="text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Saved to</h3>
                  <p className="mt-1 mb-2.5 break-all font-mono text-[10.5px] text-white/45">{exportsRootPath ?? 'App Data/exports'}</p>
                  <button
                    type="button"
                    onClick={() => void handleOpenExportsFolder()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/15"
                  >
                    <FolderOpen size={15} />
                    Open exports folder
                  </button>
                  {folderError && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{folderError}</p>}
                </div>
              )}

              {!runtimeReady && settings.format === 'png-sequence' && (
                <p className="mb-3 rounded-lg bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-200/80">
                  PNG sequence export writes many files to a folder, so it's desktop-only — GIF and video export work here in the browser too.
                </p>
              )}

              <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                <div>
                  <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Export name</h3>
                  <input
                    type="text"
                    value={settings.exportName}
                    onChange={(e) => update('exportName', e.target.value)}
                    placeholder={exportNamePlaceholder}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-white/85 outline-none placeholder:text-white/30 focus:border-white/25"
                  />
                  {runtimeReady && (
                    <p className="mt-1.5 text-[10px] text-white/35">
                      Saves automatically to <span className="font-mono text-white/45">App Data/exports/{settings.format}/</span> — a repeat name gets "
                      (2)", " (3)", etc.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Format</h3>
                  <SegmentedControl options={FORMAT_OPTIONS} value={settings.format} onChange={(v) => update('format', v)} />
                </div>

                <div>
                  <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Aspect</h3>
                  <SegmentedControl options={ASPECT_OPTIONS} value={settings.aspect} onChange={(v) => update('aspect', v)} />
                </div>

                <div>
                  <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Resolution</h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {EXPORT_RESOLUTIONS.map((res) => (
                      <button
                        key={res.label}
                        type="button"
                        onClick={() => update('resolution', res)}
                        className={`rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                          settings.resolution.label === res.label ? 'bg-white/12 text-white' : 'bg-white/5 text-white/55 hover:bg-white/10'
                        }`}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Frame Rate</h3>
                  <SegmentedControl options={FPS_OPTIONS} value={String(settings.fps)} onChange={(v) => update('fps', Number(v) as 24 | 30 | 60 | 120)} />
                </div>

                {settings.format === 'mp4' && (
                  <Slider
                    label="Bitrate"
                    value={settings.bitrateMbps}
                    min={4}
                    max={100}
                    step={1}
                    formatValue={(v) => `${v} Mbps`}
                    onChange={(v) => update('bitrateMbps', v)}
                  />
                )}

                {settings.format === 'png-sequence' && (
                  <Toggle label="Transparent background" checked={settings.transparentBackground} onChange={(v) => update('transparentBackground', v)} />
                )}

                <div>
                  <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">Range</h3>
                  <div className="flex items-center gap-2 text-[11px] text-white/60">
                    <span>Start</span>
                    <input
                      type="number"
                      min={0}
                      max={duration}
                      value={settings.startTime.toFixed(1)}
                      onChange={(e) => update('startTime', Number(e.target.value))}
                      className="w-16 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-white/80"
                    />
                    <span>End</span>
                    <input
                      type="number"
                      min={0}
                      max={duration}
                      value={endTime.toFixed(1)}
                      onChange={(e) => update('endTime', Number(e.target.value))}
                      className="w-16 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-white/80"
                    />
                  </div>
                </div>

                {errorMessage && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{errorMessage}</p>}

                {isRunning ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${Math.round(progressFraction * 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-white/50">{progressMessage}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => (isPaused ? resume() : pause())}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/8 py-2 text-[11px] text-white/70 hover:bg-white/12"
                      >
                        {isPaused ? <Play size={12} /> : <Pause size={12} />}
                        {isPaused ? 'Resume' : 'Pause'}
                      </button>
                      <button type="button" onClick={cancel} className="flex-1 rounded-lg bg-white/8 py-2 text-[11px] text-white/70 hover:bg-white/12">
                        Cancel
                      </button>
                      {settings.format === 'mp4' && (
                        <button
                          type="button"
                          onClick={finish}
                          disabled={isFinishing}
                          className="flex-1 rounded-lg bg-white/8 py-2 text-[11px] text-white/70 hover:bg-white/12 disabled:opacity-40"
                        >
                          {isFinishing ? 'Finishing…' : 'Finish'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!song || (settings.format === 'png-sequence' && !runtimeReady)}
                    onClick={() => void start()}
                    className="rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Export {resolveExportDimensions(settings.resolution, settings.aspect).width}×
                    {resolveExportDimensions(settings.resolution, settings.aspect).height}
                  </button>
                )}
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
