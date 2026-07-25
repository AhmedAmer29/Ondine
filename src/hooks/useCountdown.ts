import { useSyncExternalStore } from 'react';
import { countdownController } from '@/practice/countdown';

/** Reactive view over the singleton countdown controller, plus the trigger every Play control should call. */
export function useCountdown(): { isCounting: boolean; countValue: number; triggerPlay: () => void } {
  const snapshot = useSyncExternalStore(countdownController.subscribe, countdownController.getSnapshot);
  return {
    isCounting: snapshot.isCounting,
    countValue: snapshot.count,
    triggerPlay: () => countdownController.trigger(),
  };
}
