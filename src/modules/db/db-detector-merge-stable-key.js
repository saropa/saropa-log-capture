"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeDbDetectorResultsByStableKey = mergeDbDetectorResultsByStableKey;
/**
 * Same `stableKey` keeps the **last** result in iteration order.
 * Callers must concatenate results in ascending detector priority so higher priority wins.
 */
function mergeDbDetectorResultsByStableKey(results) {
    const order = [];
    const byKey = Object.create(null);
    for (const r of results) {
        if (!r?.stableKey) {
            continue;
        }
        if (byKey[r.stableKey] === undefined) {
            order.push(r.stableKey);
        }
        byKey[r.stableKey] = r;
    }
    return order.map((k) => byKey[k]);
}
//# sourceMappingURL=db-detector-merge-stable-key.js.map