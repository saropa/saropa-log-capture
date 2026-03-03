/**
 * Safe JSON parsing with fallbacks and error handling.
 * Use instead of raw JSON.parse to avoid throwing on malformed input.
 */

/**
 * Parse JSON string or Buffer with a fallback on error.
 *
 * @param raw - String or Buffer (UTF-8) to parse
 * @param fallback - Value to return when parsing fails (default: undefined)
 * @returns Parsed object or fallback
 */
export function safeParseJSON<T>(raw: string | Buffer, fallback?: T): T | undefined {
  try {
    const str = typeof raw === 'string' ? raw : raw.toString('utf-8');
    if (str.trim() === '') {
      return fallback;
    }
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Parse JSON and return fallback on any error (including non-object result).
 * Use when you require a defined result (e.g. config defaults).
 */
export function parseJSONOrDefault<T>(raw: string | Buffer, defaultVal: T): T {
  const parsed = safeParseJSON<T>(raw);
  if (parsed === undefined || parsed === null) {
    return defaultVal;
  }
  return parsed;
}
