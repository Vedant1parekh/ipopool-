import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Deterministic color from a string (e.g. an ipo_id), so the same seed
// always gets the same hue — used to visually group/differentiate pools
// by IPO. Fixed mid lightness/chroma reads fine as a filled swatch on
// both light and dark backgrounds, since it doesn't rely on text contrast.
export function colorFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `oklch(0.65 0.15 ${hue})`;
}
