import { motion } from 'framer-motion';
import type { ComponentType } from 'react';

interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Optional leading icon — lets tab-style usages reuse this instead of a hand-rolled tab strip. */
  readonly icon?: ComponentType<{ size?: number }>;
}

interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div className={`flex gap-1 rounded-xl bg-white/5 p-1 ${className ?? ''}`}>
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="relative flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            {active && (
              <motion.span
                layoutId={`segmented-${options.map((o) => o.value).join('-')}`}
                className="absolute inset-0 rounded-lg bg-white/12"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className={`relative z-10 flex items-center gap-1 ${active ? 'text-white' : 'text-white/55'}`}>
              {Icon && <Icon size={12} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
