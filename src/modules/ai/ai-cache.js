"use strict";
/**
 * In-memory cache for AI explanations to avoid repeated API calls for the same error context.
 * Key: hash of normalized error line + surrounding lines + stack trace snippet.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedExplanation = getCachedExplanation;
exports.setCachedExplanation = setCachedExplanation;
const MAX_CACHE_ENTRIES = 100;
function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}
/** Build a stable string from context for hashing (normalize whitespace, limit size). */
function contextSignature(context) {
    const err = context.errorLine.replace(/\s+/g, ' ').trim().slice(0, 500);
    const sur = context.surroundingLines.join('\n').replace(/\s+/g, ' ').slice(0, 2000);
    const stack = (context.stackTrace ?? '').slice(0, 1000);
    return `${err}\n${sur}\n${stack}`;
}
function hashContext(context) {
    return fnv1a(contextSignature(context)).toString(16);
}
const cache = new Map();
const keyOrder = [];
function evictIfNeeded() {
    while (keyOrder.length >= MAX_CACHE_ENTRIES && keyOrder.length > 0) {
        const oldest = keyOrder.shift();
        if (oldest !== undefined) {
            cache.delete(oldest);
        }
    }
}
function getCachedExplanation(context) {
    const key = hashContext(context);
    const entry = cache.get(key);
    if (!entry) {
        return undefined;
    }
    return { ...entry, cached: true };
}
function setCachedExplanation(context, result) {
    const key = hashContext(context);
    if (cache.has(key)) {
        keyOrder.splice(keyOrder.indexOf(key), 1);
    }
    evictIfNeeded();
    keyOrder.push(key);
    cache.set(key, { ...result, cached: false });
}
//# sourceMappingURL=ai-cache.js.map