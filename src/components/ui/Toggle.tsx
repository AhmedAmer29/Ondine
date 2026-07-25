const TRACK_WIDTH = 36;
const TRACK_HEIGHT = 20;
const KNOB_SIZE = 16;
const KNOB_INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2;

interface ToggleProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function Toggle({ label, checked, onChange }: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-xs text-white/70"
    >
      <span className="font-medium tracking-wide text-white/60">{label}</span>
      <span
        className={`relative flex-shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-500' : 'bg-white/12'}`}
        style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT }}
      >
        <span
          className="absolute top-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            left: checked ? TRACK_WIDTH - KNOB_SIZE - KNOB_INSET : KNOB_INSET,
            transform: 'translateY(-50%)',
          }}
        />
      </span>
    </button>
  );
}
