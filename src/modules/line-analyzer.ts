/** Extract meaningful search tokens from a log line for cross-session analysis. */

import { extractSourceReference } from './source-linker';

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

    return tokens;
}

/** Extract the single best token (convenience wrapper for simple search fallback). */
export function extractAnalysisToken(text: string): string | undefined {
    const tokens = extractAnalysisTokens(text);
    return tokens.length > 0 ? tokens[0].value : undefined;
}
