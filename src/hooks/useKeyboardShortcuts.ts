import { useEffect } from 'react';
import { usePlaybackStore } from '@/state/playbackStore';
import { useUiStore } from '@/state/uiStore';
import { useExportStore } from '@/state/exportStore';
import { toggleWindowFullscreen } from '@/utils/windowControls';
import { countdownController } from '@/practice/countdown';
import { computeSeekStepSeconds } from '@/utils/seek';

const VOLUME_STEP_DB = 3;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // A focused range slider isn't "typing" — treating it as one let global
  // shortcuts silently no-op whenever a slider had focus (e.g. after dragging
  // it), while the browser's own default action (native arrow-key stepping on
  // the focused slider) fired instead. For the transport's seek bar specifically,
  // that native step went through its onChange as an uncommitted scrub, which
  // never received the mouseup/touchend that would normally commit it — freezing
  // the displayed time until the next manual drag.
  if (target instanceof HTMLInputElement && target.type === 'range') return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/** Global playback + app shortcuts. Mount once near the app root. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      // A CSS overlay only blocks *pointer* hit-testing — keyboard events dispatch on document
      // focus regardless of what's visually on top, so an export's blocking overlay did nothing
      // to stop Space/arrows/etc. from still reaching the transport mid-recording. Cancel/Pause
      // stay reachable because those are real clicks on the Export panel, which sits above the
      // overlay — this only needs to stop the *keyboard* path.
      if (useExportStore.getState().isRunning) return;

      const playback = usePlaybackStore.getState();
      const ui = useUiStore.getState();
      // Space and the arrow keys are Play-mode transport controls (play/pause, seek, volume) —
      // pressing them while looking at Live or Learn mode shouldn't reach for a song that isn't
      // even the thing on screen.
      const isPlayMode = ui.mode === 'play';

      switch (event.key) {
        case ' ':
          if (!isPlayMode) break;
          event.preventDefault();
          countdownController.trigger();
          break;
        case 'ArrowLeft':
          if (!isPlayMode) break;
          event.preventDefault();
          if (event.shiftKey) playback.stepFrame(-1, 30);
          else playback.seek(Math.max(0, playback.currentTime - computeSeekStepSeconds(playback.tempoMultiplier)));
          break;
        case 'ArrowRight':
          if (!isPlayMode) break;
          event.preventDefault();
          if (event.shiftKey) playback.stepFrame(1, 30);
          else playback.seek(Math.min(playback.duration, playback.currentTime + computeSeekStepSeconds(playback.tempoMultiplier)));
          break;
        case 'ArrowUp':
          if (!isPlayMode) break;
          event.preventDefault();
          playback.setMasterVolumeDb(Math.min(6, playback.masterVolumeDb + VOLUME_STEP_DB));
          break;
        case 'ArrowDown':
          if (!isPlayMode) break;
          event.preventDefault();
          playback.setMasterVolumeDb(Math.max(-60, playback.masterVolumeDb - VOLUME_STEP_DB));
          break;
        case 'm':
        case 'M':
          playback.toggleMute();
          break;
        case 'r':
        case 'R':
          playback.restart();
          break;
        case 'f':
        case 'F':
          void toggleWindowFullscreen().then(ui.setFullscreen);
          break;
        case 'c':
        case 'C':
          ui.toggleCustomizationPanel();
          break;
        case 'Escape':
          if (ui.customizationPanelOpen) ui.setCustomizationPanelOpen(false);
          break;
        case 'D':
          if (event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            ui.toggleDebugOverlay();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
