/**
 * Exclusion pattern matching used for hiding log lines in the viewer.
 * Supports plain string (case-insensitive substring) and regex patterns
 * (delimited by / like /pattern/flags).
 */

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

/** Test whether a line of text matches any of the given exclusion rules. */
export function testExclusion(text: string, rules: readonly ExclusionRule[]): boolean {
    if (rules.length === 0) {
        return false;
    }
    const lower = text.toLowerCase();
    for (const rule of rules) {
        if (rule.regex) {
            if (rule.regex.test(text)) {
                return true;
            }
        } else if (rule.text && lower.includes(rule.text)) {
            return true;
        }
    }
    return false;
}
