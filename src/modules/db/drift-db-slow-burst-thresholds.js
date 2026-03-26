"use strict";
/**
 * Slow query burst marker thresholds (plan **DB_08**).
 *
 * Baked into the viewer embed and updated at runtime via `setViewerSlowBurstThresholds`
 * (same pattern as `drift-db-repeat-thresholds`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIEWER_SLOW_BURST_DEFAULTS = void 0;
exports.normalizeViewerSlowBurstThresholds = normalizeViewerSlowBurstThresholds;
exports.VIEWER_SLOW_BURST_DEFAULTS = {
    slowQueryMs: 50,
    burstMinCount: 5,
    burstWindowMs: 2000,
    cooldownMs: 10_000,
};
const SLOW_MS_MIN = 1;
const SLOW_MS_MAX = 120_000;
const BURST_N_MIN = 2;
const BURST_N_MAX = 100;
const WINDOW_MS_MIN = 100;
const WINDOW_MS_MAX = 120_000;
const COOLDOWN_MS_MIN = 0;
const COOLDOWN_MS_MAX = 300_000;
function clampInt(n, min, max, fallback) {
    if (typeof n !== "number" || !Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(n)));
}
function normalizeViewerSlowBurstThresholds(partial) {
    const d = exports.VIEWER_SLOW_BURST_DEFAULTS;
    return {
        slowQueryMs: clampInt(partial?.slowQueryMs, SLOW_MS_MIN, SLOW_MS_MAX, d.slowQueryMs),
        burstMinCount: clampInt(partial?.burstMinCount, BURST_N_MIN, BURST_N_MAX, d.burstMinCount),
        burstWindowMs: clampInt(partial?.burstWindowMs, WINDOW_MS_MIN, WINDOW_MS_MAX, d.burstWindowMs),
        cooldownMs: clampInt(partial?.cooldownMs, COOLDOWN_MS_MIN, COOLDOWN_MS_MAX, d.cooldownMs),
    };
}
//# sourceMappingURL=drift-db-slow-burst-thresholds.js.map