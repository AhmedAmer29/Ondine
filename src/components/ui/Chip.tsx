interface ChipProps {
  readonly children: React.ReactNode;
  readonly onClick?: () => void;
  readonly active?: boolean;
  readonly className?: string;
}

/** A small labeled toggle pill — neutral by default, accent-tinted when active. Shared by any one-off on/off control that isn't a full IconButton (e.g. Metronome). */
export function Chip({ children, onClick, active = false, className }: ChipProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
        active ? 'bg-[var(--color-accent-soft)] text-orange-200' : 'bg-white/5 text-white/60 hover:bg-white/10'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
