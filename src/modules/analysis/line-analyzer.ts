/** Extract meaningful search tokens from a log line for cross-session analysis. */

import { extractSourceReference } from '../source/source-linker';

/** A token extracted from a log line, tagged with its type for grouping. */
export interface AnalysisToken {
    readonly type: 'source-file' | 'error-class' | 'http-status' | 'url-path' | 'quoted-string' | 'class-method';
    readonly value: string;
    readonly label: string;
}

const errorClassPattern = /\b([A-Z][a-zA-Z]+(?:Exception|Error|Failure|Fault|Timeout))\b/g;
const httpStatusPattern = /\b([45]\d{2})\b/g;
const urlPathPattern = /(?:^|\s)(\/[a-zA-Z][\w/.-]{2,})/g;
const quotedStringPattern = /["']([^"']{3,60})["']/g;
const classMethodPattern = /\b([A-Z][a-zA-Z\d]+\.[a-z]\w+)\b/g;
// Fallback identifier patterns: only used when none of the strong patterns
// above produced any tokens. These catch Android-style lines like
// "ActivityManager » Slow operation ... finishAttachApplicationInner ..."
// which have no Exception/HTTP/URL/quoted hook but do carry meaningful
// camelCase method names and PascalCase class names worth searching on.
// Requires ≥2 word segments to avoid matching every short capitalised word.
const camelMethodFallback = /\b([a-z][a-z0-9]+(?:[A-Z][a-zA-Z0-9]+){1,})\b/g;
const pascalClassFallback = /\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+){1,})\b/g;

/** Extract all meaningful tokens from a log line, ordered by relevance. */
export function extractAnalysisTokens(text: string): AnalysisToken[] {
    const tokens: AnalysisToken[] = [];
    const seen = new Set<string>();
    const add = (type: AnalysisToken['type'], value: string, label: string): void => {
        const key = `${type}:${value}`;
        if (!seen.has(key)) { seen.add(key); tokens.push({ type, value, label }); }
    };

    const sourceRef = extractSourceReference(text);
    if (sourceRef) {
        const filename = sourceRef.filePath.replace(/\\/g, '/').split('/').pop() ?? sourceRef.filePath;
        add('source-file', filename, `Source: ${filename}:${sourceRef.line}`);
    }

    for (const m of text.matchAll(errorClassPattern)) { add('error-class', m[1], `Error: ${m[1]}`); }
    for (const m of text.matchAll(classMethodPattern)) { add('class-method', m[1], `Method: ${m[1]}`); }
    for (const m of text.matchAll(httpStatusPattern)) { add('http-status', m[1], `HTTP ${m[1]}`); }
    for (const m of text.matchAll(urlPathPattern)) { add('url-path', m[1], `Path: ${m[1]}`); }
    for (const m of text.matchAll(quotedStringPattern)) { add('quoted-string', m[1], `"${m[1]}"`); }

    // Only run the noisy fallback identifier scan when nothing else matched.
    // WHY: the Analyze panel bails out entirely if tokens is empty, showing
    // "No analyzable tokens found in this line." for any log line that lacks
    // a classic error/http/url/quoted signature — e.g. ActivityManager slow
    // operation lines. Synthesising a token from camelCase/PascalCase names
    // keeps Analyze usable without flooding error-rich lines with noise.
    if (tokens.length === 0) {
        for (const m of text.matchAll(pascalClassFallback)) { add('class-method', m[1], `Class: ${m[1]}`); }
        for (const m of text.matchAll(camelMethodFallback)) { add('class-method', m[1], `Method: ${m[1]}`); }
    }

    return tokens;
}

/** Extract the single best token (convenience wrapper for simple search fallback). */
export function extractAnalysisToken(text: string): string | undefined {
    const tokens = extractAnalysisTokens(text);
    return tokens.length > 0 ? tokens[0].value : undefined;
}
