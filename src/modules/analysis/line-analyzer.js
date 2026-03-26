"use strict";
/** Extract meaningful search tokens from a log line for cross-session analysis. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAnalysisTokens = extractAnalysisTokens;
exports.extractAnalysisToken = extractAnalysisToken;
const source_linker_1 = require("../source/source-linker");
const errorClassPattern = /\b([A-Z][a-zA-Z]+(?:Exception|Error|Failure|Fault|Timeout))\b/g;
const httpStatusPattern = /\b([45]\d{2})\b/g;
const urlPathPattern = /(?:^|\s)(\/[a-zA-Z][\w/.-]{2,})/g;
const quotedStringPattern = /["']([^"']{3,60})["']/g;
const classMethodPattern = /\b([A-Z][a-zA-Z\d]+\.[a-z]\w+)\b/g;
/** Extract all meaningful tokens from a log line, ordered by relevance. */
function extractAnalysisTokens(text) {
    const tokens = [];
    const seen = new Set();
    const add = (type, value, label) => {
        const key = `${type}:${value}`;
        if (!seen.has(key)) {
            seen.add(key);
            tokens.push({ type, value, label });
        }
    };
    const sourceRef = (0, source_linker_1.extractSourceReference)(text);
    if (sourceRef) {
        const filename = sourceRef.filePath.replace(/\\/g, '/').split('/').pop() ?? sourceRef.filePath;
        add('source-file', filename, `Source: ${filename}:${sourceRef.line}`);
    }
    for (const m of text.matchAll(errorClassPattern)) {
        add('error-class', m[1], `Error: ${m[1]}`);
    }
    for (const m of text.matchAll(classMethodPattern)) {
        add('class-method', m[1], `Method: ${m[1]}`);
    }
    for (const m of text.matchAll(httpStatusPattern)) {
        add('http-status', m[1], `HTTP ${m[1]}`);
    }
    for (const m of text.matchAll(urlPathPattern)) {
        add('url-path', m[1], `Path: ${m[1]}`);
    }
    for (const m of text.matchAll(quotedStringPattern)) {
        add('quoted-string', m[1], `"${m[1]}"`);
    }
    return tokens;
}
/** Extract the single best token (convenience wrapper for simple search fallback). */
function extractAnalysisToken(text) {
    const tokens = extractAnalysisTokens(text);
    return tokens.length > 0 ? tokens[0].value : undefined;
}
//# sourceMappingURL=line-analyzer.js.map