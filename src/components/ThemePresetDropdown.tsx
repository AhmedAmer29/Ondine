import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, Palette } from 'lucide-react';
import { useCustomizationStore } from '@/state/customizationStore';
import { COLOR_PRESETS, type ColorPreset, type ColorPresetName, type CustomizationSettings } from '@/types';

const PRESET_NAMES = Object.keys(COLOR_PRESETS) as ColorPresetName[];

function matchesPreset(settings: CustomizationSettings, preset: ColorPreset): boolean {
  return (
    settings.backgroundStyle === preset.backgroundStyle &&
    settings.keyboardColor === preset.keyboardColor &&
    settings.backgroundGradient.from === preset.backgroundGradient.from &&
    settings.backgroundGradient.to === preset.backgroundGradient.to &&
    settings.rightHandGradient.from === preset.rightHandGradient.from &&
    settings.rightHandGradient.to === preset.rightHandGradient.to &&
    settings.leftHandGradient.from === preset.leftHandGradient.from &&
    settings.leftHandGradient.to === preset.leftHandGradient.to
  );
}

function findActivePresetName(settings: CustomizationSettings): ColorPresetName | null {
  return PRESET_NAMES.find((name) => matchesPreset(settings, COLOR_PRESETS[name])) ?? null;
}

/** A small color swatch previewing a preset's two hand-color gradients side by side. */
function PresetSwatch({ name }: { readonly name: ColorPresetName }): React.ReactElement {
  const preset = COLOR_PRESETS[name];
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
      <span className="h-full w-1/2" style={{ background: preset.rightHandGradient.to }} />
      <span className="h-full w-1/2" style={{ background: preset.leftHandGradient.to }} />
    </span>
  );
}

export function ThemePresetDropdown(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const settings = useCustomizationStore((s) => s.settings);
  const updateMany = useCustomizationStore((s) => s.updateMany);
  const activeName = findActivePresetName(settings);

  // The popup is portaled to <body> (see below) rather than nested inside the .glass-bar title
  // bar: `backdrop-filter` on that bar creates a new CSS stacking context, which silently trapped
  // this popup's z-index *within* the title bar's own layer — visually and click-wise behind the
  // Pixi canvas, which paints later in the page's overall stacking order. A portal sidesteps that
  // ancestor entirely, so position is computed from the trigger button's real screen rect instead
  // of relying on CSS `absolute` positioning within a parent that no longer reaches far enough.
  const openDropdown = (): void => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const applyPreset = (name: ColorPresetName): void => {
    updateMany(COLOR_PRESETS[name]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/8 hover:text-white/90"
      >
        <Palette size={13} />
        <span className="tracking-wide uppercase">{activeName ?? 'Custom'}</span>
      </button>
      {open &&
        createPortal(
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="glass-panel pointer-events-auto fixed z-50 w-40 rounded-xl p-1.5"
            style={{ top: coords.top, right: coords.right }}
          >
            {PRESET_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => applyPreset(name)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/75 transition-colors hover:bg-white/8"
              >
                <PresetSwatch name={name} />
                <span className="flex-1">{name}</span>
                {name === activeName && <Check size={12} className="text-white/50" />}
              </button>
            ))}
          </motion.div>,
          document.body,
        )}
    </div>
  );
}
