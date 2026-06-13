/**
 * Guard for user-supplied regular expressions run against log text.
 *
 * Keyword-watch and exclusion patterns are authored by the user and `.test()`ed against EVERY captured
 * line in real time. A greedy/backtracking-prone pattern (e.g. `(\w+\s?)+`) combined with a very long
 * line (a minified bundle, a giant JSON dump) can backtrack long enough to freeze the extension host.
 * The JS runtime has no regex timeout, so the cheap, robust mitigation is to bound the INPUT length:
 * polynomial backtracking time scales with input size, so capping the line keeps a bad pattern from
 * hanging on a pathologically long line. (This does not defeat a deliberately exponential pattern —
 * but that is the user's own config harming only their own session; the realistic hang is a long line.)
 */

/** Max characters fed to a user-supplied regex per line. Matches past this on one line aren't found. */
export const MAX_USER_REGEX_INPUT = 20_000;

/** Clamp a line to a length safe to feed a user-authored regex (see {@link MAX_USER_REGEX_INPUT}). */
export function boundForUserRegex(text: string): string {
    return text.length > MAX_USER_REGEX_INPUT ? text.slice(0, MAX_USER_REGEX_INPUT) : text;
}
