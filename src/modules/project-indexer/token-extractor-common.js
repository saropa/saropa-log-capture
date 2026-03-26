"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TOKENS_PER_FILE = void 0;
exports.collectTokens = collectTokens;
exports.addNormalizedToken = addNormalizedToken;
exports.stripCommentPreservingQuotes = stripCommentPreservingQuotes;
exports.normalizeQuotedValue = normalizeQuotedValue;
const STOP_WORDS = new Set([
    'the', 'and', 'is', 'for', 'with', 'this', 'that', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'from', 'into', 'about', 'when',
    'which', 'what', 'who', 'how', 'where', 'than', 'because', 'after', 'before', 'during', 'while',
]);
const MIN_TOKEN_LEN = 3;
exports.MAX_TOKENS_PER_FILE = 500;
/** Normalize and filter a single token. */
function normalizeToken(t) {
    const s = t.toLowerCase().replace(/^\W+|\W+$/g, '');
    if (s.length < MIN_TOKEN_LEN || STOP_WORDS.has(s)) {
        return undefined;
    }
    return s;
}
/** Collect tokens from text (whitespace/punctuation split), dedupe, cap. */
function collectTokens(text, into, cap) {
    const parts = text.split(/[\s\p{P}]+/u);
    for (const p of parts) {
        if (into.size >= cap) {
            return;
        }
        const t = normalizeToken(p);
        if (t) {
            into.add(t);
        }
    }
}
function addNormalizedToken(token, into, cap) {
    if (into.size >= cap) {
        return;
    }
    const normalized = normalizeToken(token);
    if (normalized) {
        into.add(normalized);
    }
}
function stripCommentPreservingQuotes(line) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '\'' && !inDouble) {
            inSingle = !inSingle;
            continue;
        }
        if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            continue;
        }
        if (ch === '#' && !inSingle && !inDouble) {
            return line.slice(0, i);
        }
    }
    return line;
}
function normalizeQuotedValue(raw) {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
//# sourceMappingURL=token-extractor-common.js.map