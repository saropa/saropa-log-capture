"use strict";
/**
 * Persist Drift SQL fingerprint summary into session metadata at finalize (plan **DB_10**).
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
exports.scanAndPersistDriftSqlFingerprintSummary = scanAndPersistDriftSqlFingerprintSummary;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const db_session_fingerprint_diff_1 = require("../db/db-session-fingerprint-diff");
const drift_sql_fingerprint_summary_persist_1 = require("../db/drift-sql-fingerprint-summary-persist");
/** Scan log UTF-8 and write `driftSqlFingerprintSummary` v1 (bounded key count). */
async function scanAndPersistDriftSqlFingerprintSummary(logUri, metadataStore, outputChannel) {
    try {
        const raw = await vscode.workspace.fs.readFile(logUri);
        const text = Buffer.from(raw).toString("utf-8");
        const slowMs = (0, config_1.getConfig)().viewerSlowBurstThresholds.slowQueryMs;
        const scanOpts = typeof slowMs === "number" && slowMs > 0 ? { slowQueryMs: slowMs } : undefined;
        const { summary, firstLineByFingerprint } = (0, db_session_fingerprint_diff_1.scanSaropaLogDatabaseFingerprints)(text, scanOpts);
        if (summary.size === 0) {
            return;
        }
        const trimmed = (0, drift_sql_fingerprint_summary_persist_1.trimSummaryForPersistence)(summary, firstLineByFingerprint);
        const persisted = (0, drift_sql_fingerprint_summary_persist_1.summaryMapToPersistedV1)(trimmed.summary, trimmed.firstLineByFingerprint);
        await metadataStore.setDriftSqlFingerprintSummary(logUri, persisted);
        outputChannel.appendLine(`Drift SQL fingerprints: ${trimmed.summary.size} patterns (persisted)`);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        outputChannel.appendLine(`Failed to scan Drift SQL fingerprints: ${msg}`);
    }
}
//# sourceMappingURL=session-drift-sql-fingerprint-persist.js.map