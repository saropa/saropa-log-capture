"use strict";
/**
 * Safe JSON parsing with fallbacks and error handling.
 * Use instead of raw JSON.parse to avoid throwing on malformed input.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseJSON = safeParseJSON;
exports.parseJSONOrDefault = parseJSONOrDefault;
/**
 * Parse JSON string or Buffer with a fallback on error.
 *
 * @param raw - String or Buffer (UTF-8) to parse
 * @param fallback - Value to return when parsing fails (default: undefined)
 * @returns Parsed object or fallback
 */
function safeParseJSON(raw, fallback) {
    try {
        const str = typeof raw === 'string' ? raw : raw.toString('utf-8');
        if (str.trim() === '') {
            return fallback;
        }
        return JSON.parse(str);
    }
    catch {
        return fallback;
    }
}
/**
 * Parse JSON and return fallback on any error (including non-object result).
 * Use when you require a defined result (e.g. config defaults).
 */
function parseJSONOrDefault(raw, defaultVal) {
    const parsed = safeParseJSON(raw);
    if (parsed === undefined || parsed === null) {
        return defaultVal;
    }
    return parsed;
}
//# sourceMappingURL=safe-json.js.map