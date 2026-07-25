/** Parses "#rrggbb" or "#rgb" into a 0xRRGGBB number PixiJS consumes directly. */
export function hexToNumber(hex: string): number {
  let normalized = hex.trim().replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const value = parseInt(normalized, 16);
  return Number.isFinite(value) ? value : 0xffffff;
}

export function numberToHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function toRgb(color: number): Rgb {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

function fromRgb({ r, g, b }: Rgb): number {
  return (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b);
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

/** Linearly interpolates between two 0xRRGGBB colors. `t` is clamped to [0, 1]. */
export function mixColors(a: number, b: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const ca = toRgb(a);
  const cb = toRgb(b);
  return fromRgb({
    r: ca.r + (cb.r - ca.r) * clamped,
    g: ca.g + (cb.g - ca.g) * clamped,
    b: ca.b + (cb.b - ca.b) * clamped,
  });
}

/** Blends a color toward white, used to make higher-velocity notes read as brighter. */
export function lighten(color: number, amount: number): number {
  return mixColors(color, 0xffffff, amount);
}

/** Blends a color toward black. */
export function darken(color: number, amount: number): number {
  return mixColors(color, 0x000000, amount);
}

/** Maps a 0-1 velocity to a brightness multiplier used for glow/alpha intensity. */
export function velocityToBrightness(velocity: number, minBrightness = 0.55): number {
  return minBrightness + (1 - minBrightness) * Math.min(1, Math.max(0, velocity));
}
