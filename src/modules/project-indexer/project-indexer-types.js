"use strict";
/**
 * Types for the project indexer (doc/report index entries, manifest, source index).
 * Extracted to keep project-indexer.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenCountOfEntry = tokenCountOfEntry;
function tokenCountOfEntry(f) {
    if ('tokens' in f) {
        return f.tokens?.length ?? 0;
    }
    const r = f;
    return (r.correlationTokens?.length ?? 0) + (r.fingerprints?.length ?? 0);
}
//# sourceMappingURL=project-indexer-types.js.map