import type { ChangeEvent } from 'react';

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  readonly formatValue?: (value: number) => string;
  /** A short one-line explanation of what the slider actually does, shown under the label. Block variant only. */
  readonly description?: string;
  /** 'block' (default): label above, full-width track — used in side panels. 'inline': label, track, and value in a single compact row — used in the transport bar. Both share the same track/thumb styling. */
  readonly variant?: 'block' | 'inline';
  readonly className?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  formatValue,
  description,
  variant = 'block',
  className,
}: SliderProps): React.ReactElement {
  const percent = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : value.toFixed(2);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(Number(event.target.value));
  };

  const track = (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      className={`h-1.5 cursor-pointer appearance-none rounded-full outline-none ${variant === 'inline' ? 'w-16' : 'w-full'}`}
      style={{ background: `linear-gradient(to right, var(--color-accent) ${percent}%, rgba(255,255,255,0.14) ${percent}%)` }}
    />
  );

  if (variant === 'inline') {
    return (
      <label className={`flex items-center gap-1.5 text-[11px] text-white/50 ${className ?? ''}`}>
        <span className="font-mono">{label}</span>
        {track}
        <span className="w-9 shrink-0 font-mono text-white/70">{display}</span>
      </label>
    );
  }

  return (
    <label className={`flex flex-col gap-1.5 text-xs text-white/70 ${className ?? ''}`}>
      <span className="flex items-center justify-between">
        <span className="font-medium tracking-wide text-white/60">{label}</span>
        <span className="font-mono text-[11px] text-white/85">{display}</span>
      </span>
      {description && <span className="-mt-1 text-[10.5px] leading-snug text-white/35">{description}</span>}
      {track}
    </label>
  );
}
