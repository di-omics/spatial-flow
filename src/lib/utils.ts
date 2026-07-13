import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Deterministic 32-bit hash for seeding procedural visuals / colors from a string.
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small seedable PRNG (mulberry32). Same seed -> same sequence.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable, pleasant HSL color derived from any string (used to color-by-patient).
export function colorFromString(str: string, s = 62, l = 52): string {
  const hue = hashString(str) % 360;
  return `hsl(${hue} ${s}% ${l}%)`;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function classForVerdict(verdict: string): string {
  switch (verdict) {
    case "PASS":
      return "text-pass";
    case "FLAG":
      return "text-flag";
    case "FAIL":
      return "text-fail";
    default:
      return "text-muted-foreground";
  }
}
