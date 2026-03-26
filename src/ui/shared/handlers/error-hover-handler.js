"use strict";
/**
 * Extension-side handler for error hover popup data requests.
 *
 * Computes fingerprint, looks up cross-session history and triage status,
 * then posts enriched data back to the webview for the hover popup.
 * Optionally includes regression hint (first-seen commit or blame for file:line).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleErrorHoverRequest = handleErrorHoverRequest;
const error_fingerprint_1 = require("../../../modules/analysis/error-fingerprint");
const cross_session_aggregator_1 = require("../../../modules/misc/cross-session-aggregator");
const error_status_store_1 = require("../../../modules/misc/error-status-store");
const regression_hint_service_1 = require("../../../modules/regression/regression-hint-service");
const source_linker_1 = require("../../../modules/source/source-linker");
const source_resolver_1 = require("../../../modules/source/source-resolver");
const config_1 = require("../../../modules/config/config");
/**
 * Handle a hover data request from the webview.
 * Computes fingerprint, fetches cross-session data, and posts back.
 */
async function handleErrorHoverRequest(text, lineIndex, post) {
    const normalized = (0, error_fingerprint_1.normalizeLine)(text);
    if (normalized.length < 5) {
        post({ type: 'errorHoverData', lineIndex, empty: true });
        return;
    }
    const hash = (0, error_fingerprint_1.hashFingerprint)(normalized);
    const crashCategory = (0, error_fingerprint_1.classifyCategory)(text);
    // Parallel: cross-session lookup + triage status
    const [insights, statuses] = await Promise.all([
        (0, cross_session_aggregator_1.aggregateInsights)('all').catch(() => undefined),
        (0, error_status_store_1.getErrorStatusBatch)([hash]).catch(() => ({})),
    ]);
    const match = insights?.recurringErrors.find(e => e.hash === hash);
    const triageStatus = statuses[hash] ?? 'open';
    const resolveUrls = (0, config_1.getConfig)().integrationsGit?.commitLinks ?? true;
    const sourceRef = (0, source_linker_1.extractSourceReference)(text);
    const fileUri = sourceRef ? (0, source_resolver_1.resolveSourceUri)(sourceRef.filePath) : undefined;
    const hints = await (0, regression_hint_service_1.getRegressionHintsForError)(hash, {
        fileUri,
        line: sourceRef?.line,
        resolveCommitUrls: resolveUrls,
    }).catch(() => ({}));
    let regressionHint;
    if (hints.firstSeen) {
        regressionHint = {
            hash: hints.firstSeen.hash,
            commitUrl: hints.firstSeen.commitUrl,
            label: 'first-seen',
        };
    }
    else if (hints.blame) {
        regressionHint = {
            hash: hints.blame.hash,
            commitUrl: hints.blame.commitUrl,
            label: 'blame',
        };
    }
    const data = {
        lineIndex,
        hash,
        normalizedText: normalized,
        crashCategory,
        triageStatus,
        sessionCount: match?.sessionCount ?? 0,
        totalOccurrences: match?.totalOccurrences ?? 0,
        firstSeen: match?.firstSeen,
        lastSeen: match?.lastSeen,
        regressionHint,
    };
    post({ type: 'errorHoverData', ...data });
}
//# sourceMappingURL=error-hover-handler.js.map