/**
 * Pure (no-vscode) fingerprinting utilities extracted from error-fingerprint.ts.
 * Used by build-hypotheses.ts which must remain testable without the vscode module.
 */

/** Normalize a single line for fingerprinting — strips timestamps, UUIDs, hex, paths, numbers. */
export function normalizeLine(text: string): string {
  let s = text.replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI
  s = s.replace(/^\[[\d:.,T\-Z ]+\]\s*/, '');
  s = s.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '<TS>');
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>');
  s = s.replace(/\b0x[0-9a-fA-F]{4,}\b/g, '<HEX>');
  s = s.replace(/\b\d{2,}\b/g, '<N>');
  s = s.replace(/(?:[a-zA-Z]:)?[\\/](?:[\w.\-]+[\\/])+/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** FNV-1a 32-bit hash, returned as 8-char hex. */
export function hashFingerprint(normalized: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const anrRe = /ANR|Application Not Responding|Input dispatching timed out/i;
const oomRe = /OutOfMemoryError|heap exhaustion|\bOOM\b|Cannot allocate/i;
const nativeRe = /SIGSEGV|SIGABRT|SIGBUS|libflutter\.so|native crash/i;
const fatalRe = /\bFATAL\b|unhandled exception|uncaught/i;

export type CrashCategory = 'fatal' | 'anr' | 'oom' | 'native' | 'non-fatal';

/** Classify an error line into a crash category by pattern matching. */
export function classifyCategory(text: string): CrashCategory {
  if (anrRe.test(text)) { return 'anr'; }
  if (oomRe.test(text)) { return 'oom'; }
  if (nativeRe.test(text)) { return 'native'; }
  if (fatalRe.test(text)) { return 'fatal'; }
  return 'non-fatal';
}
