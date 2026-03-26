"use strict";
/**
 * Config validation helpers for defensive loading of workspace settings.
 * Ensures arrays are string arrays, numbers are clamped, and enums are valid.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SESSION_FILENAME_LENGTH = exports.MAX_SAFE_LINE = void 0;
exports.clamp = clamp;
exports.ensureNonNegative = ensureNonNegative;
exports.ensureStringArray = ensureStringArray;
exports.ensureEnum = ensureEnum;
exports.ensureBoolean = ensureBoolean;
exports.ensureNonEmptyString = ensureNonEmptyString;
/** Clamp a number to [min, max]. If value is NaN or not a number, return defaultVal. */
function clamp(value, min, max, defaultVal) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return defaultVal;
    }
    return Math.max(min, Math.min(max, value));
}
/** Ensure value is a number >= 0; otherwise return defaultVal. */
function ensureNonNegative(value, defaultVal) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return defaultVal;
    }
    return value;
}
/** Ensure value is an array of strings; invalid elements are filtered out. */
function ensureStringArray(value, fallback) {
    if (!Array.isArray(value)) {
        return fallback;
    }
    return value.filter((item) => typeof item === 'string');
}
/** Pick value from allowed set; otherwise return defaultVal. */
function ensureEnum(value, allowed, defaultVal) {
    if (typeof value !== 'string') {
        return defaultVal;
    }
    return allowed.includes(value) ? value : defaultVal;
}
/** Ensure value is a boolean; otherwise return defaultVal. */
function ensureBoolean(value, defaultVal) {
    if (typeof value === 'boolean') {
        return value;
    }
    return defaultVal;
}
/** Ensure value is a non-empty string; otherwise return defaultVal. */
function ensureNonEmptyString(value, defaultVal) {
    if (typeof value !== 'string') {
        return defaultVal;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : defaultVal;
}
/** Max safe line number for viewer/navigation (avoid huge numbers). */
exports.MAX_SAFE_LINE = 10_000_000;
/** Max session filename length to avoid path overflow. */
exports.MAX_SESSION_FILENAME_LENGTH = 1024;
//# sourceMappingURL=config-validation.js.map