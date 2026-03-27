"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDriftDebugServerFromLogScript = getDriftDebugServerFromLogScript;
/**
 * Injected before `addToData`: detects DRIFT DEBUG SERVER banners + viewer URL lines from plain log text.
 * Sets `window.driftDebugServerFromLog` and requests host health checks. Keep regex behavior aligned with
 * `src/modules/db/drift-debug-server-log-parse.ts`.
 */
function getDriftDebugServerFromLogScript() {
    return /* javascript */ `
(function() {
    var DRIFT_RING = [];
    var DRIFT_RING_MAX = 24;
    var lastDriftBannerVersion = null;
    var lastHealthRequestedUrl = null;

    function pushDriftRing(line) {
        DRIFT_RING.push(line);
        if (DRIFT_RING.length > DRIFT_RING_MAX) DRIFT_RING.shift();
    }

    function ringHasDriftBanner() {
        var i;
        for (i = 0; i < DRIFT_RING.length; i++) {
            if (/DRIFT DEBUG SERVER/i.test(DRIFT_RING[i])) return true;
        }
        return false;
    }

    function stripBoxNoise(s) {
        return s.replace(/[│┃║╔╗╚╝╠╣╦╩╬├┤┬┴┼═\\-]/g, ' ').replace(/\\s+/g, ' ').trim();
    }

    function extractDriftViewerUrl(plain) {
        var cleaned = stripBoxNoise(plain);
        var m = cleaned.match(/https?:\\/\\/(?:127\\.0\\.0\\.1|localhost):\\d+/);
        if (!m) return null;
        var u = m[0];
        if (u.charAt(u.length - 1) === '/') u = u.slice(0, -1);
        return u;
    }

    /** Exposed for clear-session reset (viewer-script-messages). */
    window.resetDriftDebugServerFromLogSession = function() {
        DRIFT_RING.length = 0;
        lastDriftBannerVersion = null;
        lastHealthRequestedUrl = null;
        if (typeof window !== 'undefined') {
            window.driftDebugServerFromLog = null;
        }
        if (typeof updateSqlQueryHistoryDriftStatus === 'function') updateSqlQueryHistoryDriftStatus();
    };

    window.applyDriftViewerHealthFromHost = function(payload) {
        var cur = typeof window !== 'undefined' ? window.driftDebugServerFromLog : null;
        if (!cur || !payload || payload.baseUrl !== cur.baseUrl) return;
        cur.health = {
            ok: !!payload.ok,
            version: typeof payload.version === 'string' ? payload.version : undefined,
            error: typeof payload.error === 'string' ? payload.error : undefined
        };
        if (typeof updateSqlQueryHistoryDriftStatus === 'function') updateSqlQueryHistoryDriftStatus();
    };

    window.ingestDriftDebugServerFromPlain = function(plain) {
        if (!plain || typeof plain !== 'string') return;
        pushDriftRing(plain);
        if (/DRIFT DEBUG SERVER/i.test(plain)) {
            var vm = plain.match(/\\bv(\\d+\\.\\d+\\.\\d+)\\b/);
            lastDriftBannerVersion = vm ? vm[1] : null;
        }
        var url = extractDriftViewerUrl(plain);
        if (!url || !ringHasDriftBanner()) return;
        var prev = typeof window !== 'undefined' ? window.driftDebugServerFromLog : null;
        if (prev && prev.baseUrl === url && prev.version === lastDriftBannerVersion) return;
        if (typeof window !== 'undefined') {
            window.driftDebugServerFromLog = {
                baseUrl: url,
                version: lastDriftBannerVersion,
                announcedAt: Date.now(),
                health: null
            };
        }
        if (lastHealthRequestedUrl !== url) {
            lastHealthRequestedUrl = url;
            if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                vscodeApi.postMessage({ type: 'checkDriftViewerHealth', baseUrl: url });
            }
        }
        if (typeof updateSqlQueryHistoryDriftStatus === 'function') updateSqlQueryHistoryDriftStatus();
    };

    window.updateSqlQueryHistoryDriftStatus = function() {};
})();
`;
}
//# sourceMappingURL=viewer-drift-debug-server-from-log-script.js.map