import { useCallback, useEffect } from 'react';
import { useUiStore } from '@/state/uiStore';
import { isWindowFullscreen, toggleWindowFullscreen } from '@/utils/windowControls';

export function useFullscreen(): { isFullscreen: boolean; toggleFullscreen: () => void } {
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const setFullscreen = useUiStore((s) => s.setFullscreen);

  useEffect(() => {
    isWindowFullscreen().then(setFullscreen).catch(() => undefined);
  }, [setFullscreen]);

  const toggleFullscreen = useCallback(() => {
    toggleWindowFullscreen()
      .then(setFullscreen)
      .catch(() => undefined);
  }, [setFullscreen]);

  return { isFullscreen, toggleFullscreen };
}
