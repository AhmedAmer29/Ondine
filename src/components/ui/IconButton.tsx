import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface IconButtonProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly label: string;
  readonly active?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly variant?: 'ghost' | 'solid';
}

const SIZE_CLASSES: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

export function IconButton({
  children,
  onClick,
  label,
  active = false,
  size = 'md',
  variant = 'ghost',
}: IconButtonProps): React.ReactElement {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className={`flex items-center justify-center rounded-full transition-colors duration-150 ${SIZE_CLASSES[size]} ${
        variant === 'solid'
          ? 'bg-[var(--color-accent)] text-black shadow-lg shadow-black/30'
          : active
            ? 'bg-[var(--color-accent-soft)] text-orange-200'
            : 'bg-white/5 text-white/75 hover:bg-white/12 hover:text-white'
      }`}
    >
      {children}
    </motion.button>
  );
}
