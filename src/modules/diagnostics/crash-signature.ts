/**
 * Stable crash-family signatures — Log Capture's half of the crash-to-rule feed (R3).
 *
 * The suite split: Log Capture owns the *signature* (a stable id naming the crash
 * family it observed at runtime); Saropa Lints owns the *mapping* (signature → the
 * static rule that would have prevented it, plus the "enable rule X" prompt). This
 * file is therefore a published contract — a signature id, once emitted, must never be
 * renamed, or Lints' mapping silently breaks. Add new ids; do not repurpose old ones.
 *
 * Signatures are matched from the human-readable crash text the signal already carries
 * (label + detail), not from the source AST — Log Capture never reads code (that is
 * Lints' boundary). Each id targets a Dart/Flutter crash family with a known
 * preventing rule on the Lints side.
 */

/**
 * The crash families Log Capture can recognize from runtime text. Stable ids — the
 * cross-tool contract. Kept as a const tuple so the union type below stays in sync.
 */
export const CRASH_SIGNATURE_IDS = [
  // `Bad state: No element` — `.first`/`.last`/`.single` on an empty iterable.
  // Lints prevents via prefer-`firstOrNull`/length-guard rules.
  'state-error-no-element',
  // `RangeError (index): Invalid value` — `list[i]` past the end / negative.
  'range-error-index',
  // `Null check operator used on a null value` — the `!` bang operator on null.
  'null-check-operator',
  // `LateInitializationError` — a `late` field read before assignment.
  'late-init',
  // `Concurrent modification during iteration` — mutating a collection inside its own loop.
  'concurrent-modification',
  // `type 'X' is not a subtype of type 'Y'` — a failed cast / wrong runtime type.
  'type-error-cast',
  // `FormatException` — parsing malformed input (int.parse, jsonDecode, DateTime.parse).
  'format-exception',
  // `NoSuchMethodError` — a method/getter called on null or a wrong type.
  'no-such-method',
  // `Failed assertion` — an `assert(...)` tripped in debug.
  'assertion-failed',
  // `Stack Overflow` — unbounded recursion.
  'stack-overflow',
  // `OutOfMemoryError` / heap exhaustion.
  'out-of-memory',
  // `Application Not Responding` — main-thread block past the ANR threshold.
  'anr',
] as const;

/** One of the stable crash-family ids. */
export type CrashSignatureId = (typeof CRASH_SIGNATURE_IDS)[number];

/**
 * `ruleId` prefix that marks a diagnostic as a crash-family signal. Lints keys its
 * mapping off this prefix, so a non-crash diagnostic must never use it.
 */
export const CRASH_SIGNATURE_RULE_PREFIX = 'crash:';

/** The full `ruleId` a crash diagnostic carries, e.g. `crash:range-error-index`. */
export function crashSignatureRuleId(id: CrashSignatureId): string {
  return `${CRASH_SIGNATURE_RULE_PREFIX}${id}`;
}

/**
 * Ordered pattern table. Order matters only where two patterns could both match the
 * same text — the more specific family is listed first so it wins.
 */
const PATTERNS: readonly { readonly id: CrashSignatureId; readonly re: RegExp }[] = [
  { id: 'state-error-no-element', re: /Bad state:\s*No element|StateError\b.*No element|No element/i },
  { id: 'range-error-index', re: /RangeError\s*\(index\)|RangeError.*Invalid value|index (?:out of range|is (?:negative|not in range))/i },
  { id: 'null-check-operator', re: /Null check operator used on a null value/i },
  { id: 'late-init', re: /LateInitializationError|Field '.*' has (?:not been|already been) initialized/i },
  { id: 'concurrent-modification', re: /Concurrent modification during iteration/i },
  { id: 'type-error-cast', re: /type '.*' is not a subtype of type '.*'|_TypeError|_CastError/i },
  { id: 'format-exception', re: /FormatException/i },
  { id: 'no-such-method', re: /NoSuchMethodError|The (?:method|getter|setter) '.*' was called on null/i },
  { id: 'assertion-failed', re: /Failed assertion|'package:.*': Failed assertion/i },
  { id: 'stack-overflow', re: /Stack Overflow|StackOverflowError/i },
  { id: 'out-of-memory', re: /OutOfMemoryError|heap exhaustion|\bOOM\b|Cannot allocate/i },
  { id: 'anr', re: /\bANR\b|Application Not Responding|Input dispatching timed out/i },
];

/**
 * Returns the stable crash-family signature for a block of runtime crash text, or
 * `undefined` when none of the known families match. The caller passes whatever text
 * the signal carries (label, detail, example line) — the first matching family wins.
 */
export function deriveCrashSignature(text: string | undefined): CrashSignatureId | undefined {
  if (!text) {
    return undefined;
  }
  for (const { id, re } of PATTERNS) {
    if (re.test(text)) {
      return id;
    }
  }
  return undefined;
}
