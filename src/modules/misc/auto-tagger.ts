/**
 * Auto-tag rule engine for Saropa Log Capture.
 *
 * Automatically tags sessions based on content patterns, eliminating the need
 * for manual tagging. Useful for categorizing sessions by build status, error
 * types, or specific features being tested.
 *
 * Rules are defined in settings as pattern → tag mappings:
 * ```json
 * "saropaLogCapture.autoTagRules": [
 *   { "pattern": "BUILD FAILED", "tag": "build-fail" },
 *   { "pattern": "/Exception.*null/i", "tag": "npe" }
 * ]
 * ```
 *
 * Auto-tags are evaluated during capture and stored in session metadata.
 * They're displayed differently from manual tags (italic/lighter) in the
 * session history tree.
 */

/**
 * A single auto-tag rule from user settings.
 * Pattern can be a plain string (case-insensitive substring match)
 * or a regex (wrapped in /.../ with optional flags).
 */
export interface AutoTagRule {
    /** Pattern to match against log lines - string or /regex/ */
    readonly pattern: string;
    /** Tag to apply when pattern matches */
    readonly tag: string;
}

/**
 * Compiled version of an auto-tag rule for efficient matching.
 */
interface CompiledRule {
    readonly regex: RegExp;
    readonly tag: string;
}

/**
 * Manages auto-tag rules and tracks which tags have been triggered.
 *
 * Usage:
 * 1. Create instance with rules from settings
 * 2. Call processLine() for each log line during capture
 * 3. Call getTriggeredTags() at session end to get auto-tags
 */
export class AutoTagger {
    private readonly rules: readonly CompiledRule[];
    private readonly triggeredTags: Set<string> = new Set();

    /**
     * Create an AutoTagger with the given rules.
     * Invalid regex patterns are silently skipped (logged to console).
     *
     * @param rules - Auto-tag rules from user settings
     */
    constructor(rules: readonly AutoTagRule[]) {
        this.rules = compileRules(rules);
    }

    /**
     * Process a log line and check for pattern matches.
     * Call this for every line during capture.
     *
     * @param line - The log line text to check
     * @returns Array of tags that matched (may be empty)
     */
    processLine(line: string): string[] {
        const matches: string[] = [];

        for (const rule of this.rules) {
            // Skip if tag already triggered (only tag once per session)
            if (this.triggeredTags.has(rule.tag)) {
                continue;
            }

            // Reset lastIndex for global regexes
            rule.regex.lastIndex = 0;

            if (rule.regex.test(line)) {
                this.triggeredTags.add(rule.tag);
                matches.push(rule.tag);
            }
        }

        return matches;
    }

    /**
     * Get all tags that have been triggered so far.
     *
     * @returns Array of triggered tag names (no duplicates)
     */
    getTriggeredTags(): string[] {
        return Array.from(this.triggeredTags).sort();
    }

    /**
     * Check if any tags have been triggered.
     */
    hasTriggeredTags(): boolean {
        return this.triggeredTags.size > 0;
    }

    /**
     * Reset triggered tags for a new session.
     */
    reset(): void {
        this.triggeredTags.clear();
    }
}

/**
 * Compile auto-tag rules into regex patterns for efficient matching.
 *
 * @param rules - Raw rules from settings
 * @returns Compiled rules with RegExp objects
 */
function compileRules(rules: readonly AutoTagRule[]): CompiledRule[] {
    const compiled: CompiledRule[] = [];

    for (const rule of rules) {
        if (!rule.pattern || !rule.tag) {
            continue;
        }

        try {
            const regex = parsePattern(rule.pattern);
            compiled.push({ regex, tag: rule.tag.trim() });
        } catch {
            // Invalid regex - skip silently
            // In production, we'd log this to the output channel
        }
    }

    return compiled;
}

/**
 * Parse a pattern string into a RegExp.
 *
 * Supports two formats:
 * 1. Plain string: "BUILD FAILED" → case-insensitive substring match
 * 2. Regex: "/Exception.*null/i" → actual regex with flags
 *
 * @param pattern - Pattern string from settings
 * @returns Compiled RegExp
 * @throws If regex pattern is invalid
 */
function parsePattern(pattern: string): RegExp {
    // Check if pattern is a regex (wrapped in /.../)
    const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);

    if (regexMatch) {
        // It's a regex pattern - use as-is
        return new RegExp(regexMatch[1], regexMatch[2]);
    }

    // Plain string - escape special chars and do case-insensitive match
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
}

/**
 * Parse pattern for testing - exposed for unit tests.
 * @internal
 */
export function parseAutoTagPattern(pattern: string): RegExp {
    return parsePattern(pattern);
}
