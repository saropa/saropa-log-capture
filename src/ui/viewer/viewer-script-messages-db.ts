/**
 * Database-related message handlers for the log viewer webview.
 * Handles repeat thresholds, slow burst thresholds, DB signals, detector toggles, and baseline summaries.
 * Extracted from viewer-script-messages.ts to keep the file under the line limit.
 */

export function getViewerScriptDbMessageHandler(): string {
    return /* javascript */ `
function handleDbMessages(msg) {
    switch (msg.type) {
        case 'setViewerRepeatThresholds':
            if (typeof dbRepeatThresholds !== 'undefined' && msg.thresholds && typeof msg.thresholds === 'object') {
                var th = msg.thresholds;
                var clampRepeatN = function(n) {
                    var x = typeof n === 'number' ? n : parseInt(n, 10);
                    if (!isFinite(x)) return 2;
                    return Math.max(2, Math.min(50, Math.floor(x)));
                };
                dbRepeatThresholds.global = clampRepeatN(th.globalMinCount);
                dbRepeatThresholds.read = clampRepeatN(th.readMinCount);
                dbRepeatThresholds.transaction = clampRepeatN(th.transactionMinCount);
                dbRepeatThresholds.dml = clampRepeatN(th.dmlMinCount);
            }
            return true;
        case 'setViewerSlowBurstThresholds':
            if (typeof viewerSlowBurstThresholds !== 'undefined' && msg.thresholds && typeof msg.thresholds === 'object') {
                var sb = msg.thresholds;
                var clampSb = function(n, lo, hi, fb) {
                    var x = typeof n === 'number' ? n : parseInt(n, 10);
                    if (!isFinite(x)) return fb;
                    return Math.max(lo, Math.min(hi, Math.floor(x)));
                };
                viewerSlowBurstThresholds.slowQueryMs = clampSb(sb.slowQueryMs, 1, 120000, viewerSlowBurstThresholds.slowQueryMs);
                viewerSlowBurstThresholds.burstMinCount = clampSb(sb.burstMinCount, 2, 100, viewerSlowBurstThresholds.burstMinCount);
                viewerSlowBurstThresholds.burstWindowMs = clampSb(sb.burstWindowMs, 100, 120000, viewerSlowBurstThresholds.burstWindowMs);
                viewerSlowBurstThresholds.cooldownMs = clampSb(sb.cooldownMs, 0, 300000, viewerSlowBurstThresholds.cooldownMs);
            }
            return true;
        case 'setViewerDbSignalsEnabled':
            viewerDbSignalsEnabled = msg.enabled !== false;
            return true;
        case 'setStaticSqlFromFingerprintEnabled':
            staticSqlFromFingerprintEnabled = msg.enabled !== false;
            return true;
        case 'setViewerDbDetectorToggles':
            viewerDbDetectorNPlusOneEnabled = msg.nPlusOneEnabled !== false;
            viewerDbDetectorSlowBurstEnabled = msg.slowBurstEnabled !== false;
            viewerDbDetectorBaselineHintsEnabled = msg.baselineHintsEnabled !== false;
            if (typeof baselineVolumeHintEmitted !== 'undefined') baselineVolumeHintEmitted = Object.create(null);
            return true;
        case 'setDbBaselineFingerprintSummary':
            if (typeof setDbBaselineFingerprintSummaryFromHost === 'function') {
                setDbBaselineFingerprintSummaryFromHost(msg.fingerprints || null);
            }
            if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
            return true;
        default:
            return false;
    }
}
`;
}
