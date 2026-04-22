"use strict";
/**
 * Recurring Signal Handlers
 *
 * Handlers for recurring signals panel operations.
 * All signal kinds (error, warning, perf, SQL, etc.) go through the unified RecurringSignalEntry type.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSetErrorStatus = handleSetErrorStatus;
exports.handleSignalDataRequest = handleSignalDataRequest;
exports.handleOpenSessionForSignalType = handleOpenSessionForSignalType;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const config_1 = require("../../../modules/config/config");
const cross_session_aggregator_1 = require("../../../modules/misc/cross-session-aggregator");
const recurring_signal_builder_1 = require("../../../modules/misc/recurring-signal-builder");
const error_status_store_1 = require("../../../modules/misc/error-status-store");
const session_metadata_1 = require("../../../modules/session/session-metadata");
const metadata_loader_1 = require("../../../modules/session/metadata-loader");
const signal_summary_types_1 = require("../../../modules/root-cause-hints/signal-summary-types");
const signal_lint_enricher_1 = require("../../../modules/diagnostics/signal-lint-enricher");
const signal_da_enricher_1 = require("../../../modules/diagnostics/signal-da-enricher");
/** Update error/warning triage status and refresh the signal panel.
 *  Needs currentFileUri so the refresh includes "Signals in this log" data. */
async function handleSetErrorStatus(hash, status, post, currentFileUri) {
    await (0, error_status_store_1.setErrorStatus)(hash, status);
    // Re-send full signal data so the unified list re-renders with updated triage states
    await handleSignalDataRequest(post, currentFileUri);
}
/** Full signal payload (unified signals + hot files + environment). */
async function handleSignalDataRequest(post, currentFileUri) {
    const aggregated = await (0, cross_session_aggregator_1.aggregateSignals)('all').catch(() => undefined);
    const allSignals = aggregated?.allSignals ?? [];
    const errorFingerprints = allSignals.filter(s => s.kind === 'error' || s.kind === 'warning').map(s => s.fingerprint);
    const statuses = await (0, error_status_store_1.getErrorStatusBatch)(errorFingerprints);
    let signalsInThisLog;
    let sessionCorrelationTags = [];
    if (currentFileUri) {
        try {
            const store = new session_metadata_1.SessionMetadataStore();
            const meta = await store.loadMetadata(currentFileUri);
            sessionCorrelationTags = meta?.correlationTags ?? [];
            const sessionFilename = path.basename(currentFileUri.fsPath);
            const thisSessionSignals = (0, recurring_signal_builder_1.buildAllRecurringSignals)([{ filename: sessionFilename, meta }]);
            if (thisSessionSignals.length > 0) {
                signalsInThisLog = thisSessionSignals;
            }
        }
        catch {
            // ignore — metadata may not exist yet for new sessions
        }
    }
    post({
        type: 'signalData',
        statuses,
        hotFiles: aggregated?.hotFiles ?? [],
        platforms: aggregated?.platforms ?? [],
        sdkVersions: aggregated?.sdkVersions ?? [],
        debugAdapters: aggregated?.debugAdapters ?? [],
        // Enrich signals with lint diagnostics + DA table metadata
        allSignals: await (0, signal_da_enricher_1.enrichSignalsWithDaContext)(await (0, signal_lint_enricher_1.enrichSignalsWithLintContext)([...allSignals], sessionCorrelationTags)),
        signalsInThisLog: await (0, signal_da_enricher_1.enrichSignalsWithDaContext)(await (0, signal_lint_enricher_1.enrichSignalsWithLintContext)([...(signalsInThisLog ?? [])], sessionCorrelationTags)),
        coOccurrences: aggregated?.coOccurrences ?? [],
    });
}
/**
 * Find the most recent session that has the given signal type and return its URI string.
 * Returns undefined if no matching session found.
 */
async function handleOpenSessionForSignalType(signalType) {
    const metas = await (0, metadata_loader_1.loadFilteredMetas)('all');
    const matching = metas
        .filter(m => {
        const s = m.meta.signalSummary;
        if (!s || !(0, signal_summary_types_1.isPersistedSignalSummaryV1)(s)) {
            return false;
        }
        // Check if this session has a non-zero count for the requested signal type
        const count = s.counts[signalType];
        return typeof count === 'number' && count > 0;
    })
        .sort((a, b) => (0, metadata_loader_1.parseSessionDate)(b.filename) - (0, metadata_loader_1.parseSessionDate)(a.filename));
    if (matching.length === 0) {
        return undefined;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    return vscode.Uri.joinPath(logDir, matching[0].filename).toString();
}
//# sourceMappingURL=recurring-handlers.js.map