"use strict";
/**
 * Shared type definitions for the code quality metrics integration.
 * Used by the lint reader, comment scanner, and codeQuality provider.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeForLookup = normalizeForLookup;
/** Normalize a file path for consistent map lookups (forward slashes, lowercase, strip drive/leading slash). */
function normalizeForLookup(filePath) {
    return filePath.replace(/\\/g, '/').toLowerCase().replace(/^[a-z]:\//i, '').replace(/^\//, '');
}
//# sourceMappingURL=quality-types.js.map