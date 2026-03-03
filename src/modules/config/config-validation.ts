/**
 * Config validation helpers for defensive loading of workspace settings.
 * Ensures arrays are string arrays, numbers are clamped, and enums are valid.
 */

/** Clamp a number to [min, max]. If value is NaN or not a number, return defaultVal. */
export function clamp(value: unknown, min: number, max: number, defaultVal: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultVal;
  }
  return Math.max(min, Math.min(max, value));
}

/** Ensure value is a number >= 0; otherwise return defaultVal. */
export function ensureNonNegative(value: unknown, defaultVal: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return defaultVal;
  }
  return value;
}

/** Ensure value is an array of strings; invalid elements are filtered out. */
export function ensureStringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter((item): item is string => typeof item === 'string');
}

/** Pick value from allowed set; otherwise return defaultVal. */
export function ensureEnum<T extends string>(value: unknown, allowed: readonly T[], defaultVal: T): T {
  if (typeof value !== 'string') {
    return defaultVal;
  }
  return allowed.includes(value as T) ? (value as T) : defaultVal;
}

/** Ensure value is a boolean; otherwise return defaultVal. */
export function ensureBoolean(value: unknown, defaultVal: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return defaultVal;
}

/** Ensure value is a non-empty string; otherwise return defaultVal. */
export function ensureNonEmptyString(value: unknown, defaultVal: string): string {
  if (typeof value !== 'string') {
    return defaultVal;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : defaultVal;
}

/** Max safe line number for viewer/navigation (avoid huge numbers). */
export const MAX_SAFE_LINE = 10_000_000;

/** Max session filename length to avoid path overflow. */
export const MAX_SESSION_FILENAME_LENGTH = 1024;
