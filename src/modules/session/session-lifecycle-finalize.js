"use strict";
/**
 * Session finalization — stops a log session, saves metadata, and runs scans.
 * Split from session-lifecycle.ts for file-length compliance.
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
exports.buildSessionStats = buildSessionStats;
exports.finalizeSession = finalizeSession;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("node:path"));
const config_1 = require("../config/config");
const correlation_scanner_1 = require("../analysis/correlation-scanner");
const error_fingerprint_1 = require("../analysis/error-fingerprint");
const perf_fingerprint_1 = require("../misc/perf-fingerprint");
const anr_risk_scorer_1 = require("../analysis/anr-risk-scorer");
const app_version_1 = require("../misc/app-version");
const device_detector_1 = require("../misc/device-detector");
const session_severity_counts_1 = require("../../ui/session/session-severity-counts");
const session_summary_1 = require("./session-summary");
const integrations_1 = require("../integrations");
const external_log_tailer_1 = require("../integrations/external-log-tailer");
const unified_session_log_writer_1 = require("./unified-session-log-writer");
const session_drift_sql_fingerprint_persist_1 = require("./session-drift-sql-fingerprint-persist");
/** Build session statistics for the summary notification. */
function buildSessionStats(params) {
    const { logSession, sessionStartTime, categoryCounts, watcher, floodSuppressedTotal } = params;
    const watchCounts = {};
    for (const [key, value] of watcher.getCounts()) {
        watchCounts[key] = value;
    }
    return {
        lineCount: logSession.lineCount,
        bytesWritten: logSession.bytesWritten,
        durationMs: Date.now() - sessionStartTime,
        partCount: logSession.partNumber + 1,
        categoryCounts: { ...categoryCounts },
        watchHitCounts: watchCounts,
        floodSuppressedCount: floodSuppressedTotal,
        exclusionsApplied: 0,
    };
}
/** Stop a log session, save metadata, and show the summary notification. */
async function finalizeSession(params, stats) {
    const { logSession, outputChannel, autoTagger, metadataStore, sessionStartTime } = params;
    const sessionEndTime = Date.now();
    const config = (0, config_1.getConfig)();
    try {
        await logSession.stop();
        outputChannel.appendLine(`Session stopped: ${logSession.fileUri.fsPath}`);
    }
    catch (err) {
        outputChannel.appendLine(`Error stopping log session: ${err}`);
    }
    // Integration end-phase: providers write meta + sidecars; then we run scans and save metadata.
    const integrationRegistry = (0, integrations_1.getDefaultIntegrationRegistry)();
    const integrationContext = (0, integrations_1.createIntegrationContext)(logSession.sessionContext, config, outputChannel);
    const baseFileName = path.basename(logSession.fileUri.fsPath).replace(/\.log$/i, '') ||
        'session';
    const endContext = (0, integrations_1.createIntegrationEndContext)({
        base: integrationContext,
        logUri: logSession.fileUri,
        baseFileName,
        sessionStartTime,
        sessionEndTime,
        debugProcessId: params.debugProcessId,
    });
    await integrationRegistry.runOnSessionEnd(endContext, metadataStore);
    // Always dispose external log watchers (provider stops when adapter enabled; if disabled mid-session, this still closes handles).
    (0, external_log_tailer_1.stopExternalLogTailers)();
    await (0, unified_session_log_writer_1.writeUnifiedSessionLogIfEnabled)(logSession.fileUri, baseFileName, config, outputChannel);
    // Save auto-tags if any watch patterns triggered during the session.
    if (autoTagger?.hasTriggeredTags()) {
        const autoTags = autoTagger.getTriggeredTags();
        metadataStore.setAutoTags(logSession.fileUri, autoTags).catch((err) => {
            outputChannel.appendLine(`Failed to save auto-tags: ${err}`);
        });
        outputChannel.appendLine(`Auto-tags applied: ${autoTags.join(', ')}`);
    }
    // Scans (correlation tags, error fingerprints, perf fingerprints) run in parallel; onReportsIndexReady after all settle.
    const pCorr = (0, correlation_scanner_1.scanForCorrelationTags)(logSession.fileUri).then(async (corrTags) => {
        if (corrTags.length > 0) {
            await metadataStore.setCorrelationTags(logSession.fileUri, corrTags);
            outputChannel.appendLine(`Correlation tags: ${corrTags.join(', ')}`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan correlation tags: ${err}`);
    });
    const pFp = (0, error_fingerprint_1.scanForFingerprints)(logSession.fileUri).then(async (fps) => {
        if (fps.length > 0) {
            await metadataStore.setFingerprints(logSession.fileUri, fps);
            outputChannel.appendLine(`Error fingerprints: ${fps.length} patterns`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan fingerprints: ${err}`);
    });
    const pPerf = (0, perf_fingerprint_1.scanForPerfFingerprints)(logSession.fileUri).then(async (pfs) => {
        if (pfs.length > 0) {
            await metadataStore.setPerfFingerprints(logSession.fileUri, pfs);
            outputChannel.appendLine(`Perf fingerprints: ${pfs.length} operations`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan perf fingerprints: ${err}`);
    });
    const pDriftSql = (0, session_drift_sql_fingerprint_persist_1.scanAndPersistDriftSqlFingerprintSummary)(logSession.fileUri, metadataStore, outputChannel);
    Promise.allSettled([pCorr, pFp, pPerf, pDriftSql]).then(() => {
        params.onReportsIndexReady?.(logSession.fileUri);
    }).catch(() => { });
    scanAnrRiskForSession(logSession.fileUri, metadataStore, outputChannel);
    (0, app_version_1.detectAppVersion)().then(async (version) => {
        if (version) {
            await metadataStore.setAppVersion(logSession.fileUri, version);
            outputChannel.appendLine(`App version: ${version}`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to detect app version: ${err}`);
    });
    storeSessionDeviceInfo(logSession.fileUri, params.debugAdapterType, metadataStore, outputChannel);
    // Refresh recurring errors sidebar after metadata scans complete.
    setTimeout(() => vscode.commands.executeCommand('saropaLogCapture.refreshRecurringErrors'), 3000);
    const filename = logSession.fileUri.fsPath.split(/[\\/]/).pop() ?? '';
    (0, session_summary_1.showSummaryNotification)((0, session_summary_1.withLogUri)((0, session_summary_1.generateSummary)(filename, stats), logSession.fileUri));
    if (config.autoOpen) {
        await vscode.window.showTextDocument(logSession.fileUri);
    }
}
/** Async: scan log file for ANR risk patterns and store results in metadata. */
function scanAnrRiskForSession(fileUri, store, out) {
    Promise.resolve(vscode.workspace.fs.readFile(fileUri)).then(async (raw) => {
        const body = (0, session_severity_counts_1.extractBody)(Buffer.from(raw).toString('utf-8'));
        const risk = (0, anr_risk_scorer_1.scanAnrRisk)(body);
        if (risk.score === 0) {
            return;
        }
        const sev = (0, session_severity_counts_1.countSeverities)(body);
        const meta = await store.loadMetadata(fileUri);
        meta.anrCount = sev.anrs;
        meta.anrRiskLevel = risk.level;
        await store.saveMetadata(fileUri, meta);
        out.appendLine(`ANR risk: ${risk.level} (score ${risk.score}) — ${risk.signals.join(', ')}`);
    }).catch((err) => {
        out.appendLine(`Failed to scan ANR risk: ${err}`);
    });
}
/** Store debug adapter type and detect target device from log file content. */
function storeSessionDeviceInfo(fileUri, adapterType, store, out) {
    store.loadMetadata(fileUri).then(async (meta) => {
        meta.debugAdapterType = adapterType;
        const target = await (0, device_detector_1.detectTargetDevice)(fileUri).catch(() => undefined);
        if (target) {
            meta.debugTarget = target;
        }
        await store.saveMetadata(fileUri, meta);
        if (target) {
            out.appendLine(`Debug target: ${target}`);
        }
    }).catch((err) => {
        out.appendLine(`Failed to store device info: ${err}`);
    });
}
//# sourceMappingURL=session-lifecycle-finalize.js.map