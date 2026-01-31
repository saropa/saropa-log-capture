/**
 * JSON detection and collapsible wrapping for HTML export.
 *
 * Detects valid JSON objects and arrays within log lines and wraps them
 * in collapsible HTML elements with a toggle arrow, truncated preview,
 * and expandable pretty-printed view.
 */

import { escapeHtml } from './ansi';

/**
 * Wrap detected JSON in collapsible HTML elements.
 *
 * If JSON is found, wraps it in a structure that shows:
 * - A toggle arrow (▶/▼)
 * - A truncated preview (first 60 chars)
 * - A hidden pre block with pretty-printed JSON
 *
 * @param html - HTML string that may contain JSON
 * @returns Original html if no JSON, or html with JSON wrapped in collapsible
 */
export function wrapJsonInLine(html: string): string {
    const jsonMatch = detectJsonInHtml(html);
    if (!jsonMatch) {
        return html;
    }

    const { prefix, json, suffix, pretty } = jsonMatch;
    // Show truncated preview for long JSON
    const preview = json.length > 60 ? json.slice(0, 57) + '...' : json;

    return `${prefix}<span class="json-collapsible"><span class="json-toggle">▶</span><span class="json-preview">${escapeHtml(preview)}</span><pre class="json-expanded hidden">${escapeHtml(pretty)}</pre></span>${suffix}`;
}

/**
 * Detect valid JSON within an HTML string.
 *
 * Handles the tricky case where log lines may contain JSON mixed with other
 * text, like "[INFO] {"user": "john"} logged in". We need to find just the
 * JSON part.
 *
 * Strategy: Find all potential JSON start characters ({ or [), try each
 * until we find valid JSON. This handles lines like "[DEBUG] data: {...}"
 * where the first [ is not JSON but a log prefix.
 *
 * @param html - HTML string to search for JSON
 * @returns Object with prefix, json, suffix, and pretty-printed version, or null
 */
function detectJsonInHtml(html: string): { prefix: string; json: string; suffix: string; pretty: string } | null {
    // Strip HTML tags to work with plain text
    const text = html.replace(/<[^>]*>/g, '');

    // Collect all potential JSON start positions
    const candidates: { start: number; closer: string }[] = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            candidates.push({ start: i, closer: '}' });
        } else if (text[i] === '[') {
            candidates.push({ start: i, closer: ']' });
        }
    }

    // Try each candidate until we find valid JSON
    for (const { start, closer } of candidates) {
        const end = findMatchingBracket(text, start, closer);
        if (end < 0) {
            continue;
        }

        const jsonStr = text.slice(start, end + 1);
        try {
            const parsed = JSON.parse(jsonStr);
            // Only accept objects and arrays, not primitives
            if (typeof parsed !== 'object' || parsed === null) {
                continue;
            }
            return {
                prefix: text.slice(0, start),
                json: jsonStr,
                suffix: text.slice(end + 1),
                pretty: JSON.stringify(parsed, null, 2),
            };
        } catch {
            // Not valid JSON, try next candidate
        }
    }
    return null;
}

/**
 * Find the matching closing bracket for an opening bracket.
 *
 * Handles nested brackets and properly ignores brackets inside strings.
 * For example, in {"key": "value with { brace"}, the inner { is ignored.
 *
 * @param str - The string to search
 * @param start - Position of the opening bracket
 * @param closer - The closing bracket character to find (} or ])
 * @returns Position of matching closer, or -1 if not found
 */
function findMatchingBracket(str: string, start: number, closer: string): number {
    const opener = str[start];
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\') {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) {
            continue;
        }
        if (ch === opener) {
            depth++;
        } else if (ch === closer) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}
