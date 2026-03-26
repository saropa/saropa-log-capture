"use strict";
/**
 * Recurring Errors Handlers
 *
 * Handlers for recurring errors panel operations.
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
exports.handleRecurringRequest = handleRecurringRequest;
exports.handleSetErrorStatus = handleSetErrorStatus;
exports.handleInsightDataRequest = handleInsightDataRequest;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const config_1 = require("../../../modules/config/config");
const cross_session_aggregator_1 = require("../../../modules/misc/cross-session-aggregator");
const error_status_store_1 = require("../../../modules/misc/error-status-store");
const regression_hint_service_1 = require("../../../modules/regression/regression-hint-service");
const session_metadata_1 = require("../../../modules/session/session-metadata");
/** Normalize path segment for comparison with timeline session (forward slashes). */
function normSession(s) {
    return s.replace(/\\/g, '/');
}
/** Recurring errors that appear in the given session (timeline contains session path). */
function filterRecurringInSession(errors, sessionRelPath) {
    const norm = normSession(sessionRelPath);
    return errors.filter(e => e.timeline.some(t => normSession(t.session) === norm || normSession(t.session).endsWith(norm)));
}
/** Aggregate recurring errors and send to webview. */
async function handleRecurringRequest(post) {
    const insights = await (0, cross_session_aggregator_1.aggregateInsights)('all').catch(() => undefined);
    const errors = insights?.recurringErrors ?? [];
    const statuses = await (0, error_status_store_1.getErrorStatusBatch)(errors.map(e => e.hash));
    post({ type: 'recurringErrorsData', errors, statuses });
}
/** Update error status and refresh. */
async function handleSetErrorStatus(hash, status, post) {
    await (0, error_status_store_1.setErrorStatus)(hash, status);
    await handleRecurringRequest(post);
}
/** Full insight payload (recurring + hot files + environment + optional recurringInThisLog). */
async function handleInsightDataRequest(post, currentFileUri) {
    const insights = await (0, cross_session_aggregator_1.aggregateInsights)('all').catch(() => undefined);
    const errors = insights?.recurringErrors ?? [];
    const hotFiles = insights?.hotFiles ?? [];
    const platforms = insights?.platforms ?? [];
    const sdkVersions = insights?.sdkVersions ?? [];
    const debugAdapters = insights?.debugAdapters ?? [];
    const statuses = await (0, error_status_store_1.getErrorStatusBatch)(errors.map(e => e.hash));
    const commitLinks = (0, config_1.getConfig)().integrationsGit?.commitLinks ?? true;
    const regressionHints = await (0, regression_hint_service_1.getFirstSeenHintsForErrors)(errors.map(e => e.hash), {
        resolveCommitUrls: commitLinks,
        cap: 15,
    }).catch(() => ({}));
    let recurringInThisLog;
    let errorsInThisLog;
    let errorsInThisLogTotal;
    if (currentFileUri) {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (folder) {
            const logDir = (0, config_1.getLogDirectoryUri)(folder);
            const rel = path.relative(logDir.fsPath, currentFileUri.fsPath);
            const sessionRel = normSession(rel);
            if (!rel.startsWith('..') && sessionRel.length > 0) {
                recurringInThisLog = filterRecurringInSession(errors, sessionRel);
            }
        }
        try {
            const store = new session_metadata_1.SessionMetadataStore();
            const meta = await store.loadMetadata(currentFileUri);
            const fps = meta?.fingerprints ?? [];
            const top3 = [...fps]
                .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
                .slice(0, 3)
                .map(f => ({
                normalizedText: f.n ?? '',
                exampleLine: f.e ?? '',
                count: f.c ?? 0,
            }));
            if (top3.length > 0) {
                errorsInThisLog = top3;
            }
            errorsInThisLogTotal = fps.length;
        }
        catch {
            // ignore
        }
    }
    post({
        type: 'insightData',
        errors,
        statuses,
        hotFiles,
        platforms,
        sdkVersions,
        debugAdapters,
        recurringInThisLog,
        errorsInThisLog,
        errorsInThisLogTotal,
        regressionHints,
    });
}
//# sourceMappingURL=recurring-handlers.js.map