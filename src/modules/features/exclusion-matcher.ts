/**
 * Exclusion pattern matching used for hiding log lines in the viewer.
 * Supports plain string (case-insensitive substring) and regex patterns
 * (delimited by / like /pattern/flags).
 */

import { boundForUserRegex } from '../misc/regex-safety';

/** A resolved exclusion rule ready for matching. */
export interface ExclusionRule {
    readonly source: string;
    readonly regex?: RegExp;
    readonly text?: string;
}

/** Parse a pattern string into an ExclusionRule, or undefined if invalid. */
export function parseExclusionPattern(pattern: string): ExclusionRule | undefined {
    if (!pattern || pattern.trim() === '') {
        return undefined;
    }
    const trimmed = pattern.trim();
    if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
        const last = trimmed.lastIndexOf('/');
        const body = trimmed.substring(1, last);
        const flags = trimmed.substring(last + 1);
        try {
            return { source: trimmed, regex: new RegExp(body, flags) };
        } catch {
            return undefined;
        }
    }
    return { source: trimmed, text: trimmed.toLowerCase() };
}

/**
 * Find the first exclusion rule that matches the text, or undefined if none do.
 * Returns the rule (not just a bool) so callers can name the matching pattern in
 * diagnostics — e.g. telling a user which exclusion hid a "missing" Debug Console line.
 */
export function findExclusionMatch(
    text: string,
    rules: readonly ExclusionRule[],
): ExclusionRule | undefined {
    if (rules.length === 0) {
        return undefined;
    }
    const lower = text.toLowerCase();
    // Bound the line once for regex rules — a greedy user pattern on a very long line could hang.
    const bounded = boundForUserRegex(text);
    for (const rule of rules) {
        if (rule.regex) {
            rule.regex.lastIndex = 0;
            if (rule.regex.test(bounded)) {
                return rule;
            }
        } else if (rule.text && lower.includes(rule.text)) {
            return rule;
        }
    }
    return undefined;
}

/** Test whether a line of text matches any of the given exclusion rules. */
export function testExclusion(text: string, rules: readonly ExclusionRule[]): boolean {
    return findExclusionMatch(text, rules) !== undefined;
}
