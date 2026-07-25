import { useUiStore, type AppMode } from '@/state/uiStore';
import { SegmentedControl } from './ui';

const MODE_OPTIONS: { readonly value: AppMode; readonly label: string }[] = [
  { value: 'play', label: 'Play' },
  { value: 'live', label: 'Live' },
  { value: 'learn', label: 'Learn' },
];

export function ModeTabs(): React.ReactElement {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);

  return <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} className="w-44 shrink-0" />;
}
