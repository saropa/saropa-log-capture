/**
 * Highlight rule serializer for the log viewer webview.
 *
 * Converts HighlightRule objects into a serializable format that can be
 * sent to the webview via postMessage. RegExp objects can't be serialized,
 * so we split patterns into { source, flags } pairs.
 */

import { HighlightRule } from '../modules/highlight-rules';

/**
 * Serialized highlight rule format for sending to the webview.
 * Pattern and flags are separated since RegExp can't be serialized via postMessage.
 */
export interface SerializedHighlightRule {
    readonly pattern: string;
    readonly flags: string;
    readonly color?: string;
    readonly backgroundColor?: string;
    readonly fontWeight?: string;
    readonly fontStyle?: string;
    readonly label: string;
    readonly scope?: 'line' | 'keyword';
}

/**
 * Serialize highlight rules for transmission to the webview.
 * Converts pattern strings to { pattern, flags } format and includes style info.
 * Invalid patterns are filtered out.
 */
export function serializeHighlightRules(
    rules: readonly HighlightRule[],
): SerializedHighlightRule[] {
    const result: SerializedHighlightRule[] = [];

    for (const rule of rules) {
        if (!rule.pattern) {
            continue;
        }

        const parsed = parsePatternForSerialization(rule.pattern);
        if (!parsed) {
            continue;
        }

        // Keyword-scope rules need the global flag for replace()
        let flags = parsed.flags;
        if (rule.scope === 'keyword' && !flags.includes('g')) {
            flags += 'g';
        }

        result.push({
            pattern: parsed.source,
            flags,
            color: rule.color,
            backgroundColor: rule.backgroundColor,
            fontWeight: rule.bold ? 'bold' : undefined,
            fontStyle: rule.italic ? 'italic' : undefined,
            label: rule.label ?? rule.pattern,
            scope: rule.scope,
        });
    }

    return result;
}

/**
 * Parse a pattern string into regex source and flags.
 * Handles both /regex/flags format and plain strings.
 */
function parsePatternForSerialization(
    pattern: string,
): { source: string; flags: string } | undefined {
    // Check for regex literal format: /pattern/flags
    const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexMatch) {
        try {
            new RegExp(regexMatch[1], regexMatch[2]);
            return { source: regexMatch[1], flags: regexMatch[2] };
        } catch {
            return undefined;
        }
    }

    // Plain string: escape special chars for case-insensitive match
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { source: escaped, flags: 'i' };
}
