"use strict";
/**
 * Session Comparison Panel (host / extension process)
 *
 * Owns a singleton `WebviewPanel` that compares two saved Saropa log files. The heavy lifting for
 * line diff and Drift SQL fingerprint extraction lives in `compareLogSessionsWithDbFingerprints`
 * (`diff-engine.ts`); this module wires results into HTML via `buildSessionComparisonHtml` and
 * handles `postMessage` from the webview (sync scroll, jump-to-line, baseline push to live viewers).
 *
 * **Security:** Log line text and filenames pass through `escapeHtml` in the HTML builder; CSP uses
 * a per-refresh nonce for script and style. Webview messages are untrusted—`revealDriftFingerprintLine`
 * validates `side` and `fingerprint` types before opening documents.
 *
 * **Concurrency:** Multiple rapid clicks on “Jump” can overlap `revealDriftFingerprintLine`; each call
 * uses the current `uriA`/`uriB` snapshot and is safe (last-opened editor wins). Baseline buttons only
 * forward maps already held in memory (no async race with compare() unless user compares while clicks
 * are in flight—in that case maps match the last completed `compare()`).
 *
 * **UI/UX:** No progress UI here; `compare()` awaits file reads in the extension host (same as before
 * the DB section). Large logs can take a moment—VS Code shows the usual busy state while the promise
 * resolves. Jump uses `preview: true` and centers the target line.
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
exports.SessionComparisonPanel = void 0;
exports.getComparisonPanel = getComparisonPanel;
exports.disposeComparisonPanel = disposeComparisonPanel;
const vscode = __importStar(require("vscode"));
const diff_engine_1 = require("../../modules/misc/diff-engine");
const db_session_fingerprint_diff_1 = require("../../modules/db/db-session-fingerprint-diff");
const session_metadata_1 = require("../../modules/session/session-metadata");
const drift_sql_fingerprint_summary_persist_1 = require("../../modules/db/drift-sql-fingerprint-summary-persist");
const drift_advisor_integration_1 = require("../provider/drift-advisor-integration");
const session_comparison_html_1 = require("./session-comparison-html");
/** Manages the comparison webview panel. */
class SessionComparisonPanel {
    extensionUri;
    broadcaster;
    panel;
    diffResult;
    dbFingerprints;
    uriA;
    uriB;
    summaryMapA = new Map();
    summaryMapB = new Map();
    dbCompareDetectorResults = [];
    metadataStore = new session_metadata_1.SessionMetadataStore();
    syncScrolling = true;
    disposables = [];
    constructor(extensionUri, broadcaster) {
        this.extensionUri = extensionUri;
        this.broadcaster = broadcaster;
    }
    /**
     * Open or focus the comparison panel with two sessions.
     */
    async compare(uriA, uriB) {
        const { diff, dbFingerprints, summaryMapA, summaryMapB, dbCompareDetectorResults } = await (0, diff_engine_1.compareLogSessionsWithDbFingerprints)(uriA, uriB);
        this.diffResult = diff;
        this.dbFingerprints = dbFingerprints;
        this.uriA = uriA;
        this.uriB = uriB;
        this.summaryMapA = new Map(summaryMapA);
        this.summaryMapB = new Map(summaryMapB);
        this.dbCompareDetectorResults = dbCompareDetectorResults;
        this.pushRootCauseHintsSessionDiffToViewers();
        if (this.panel) {
            this.panel.reveal();
        }
        else {
            this.panel = vscode.window.createWebviewPanel('saropaLogCapture.comparison', 'Saropa Log Comparison', vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri],
            });
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.disposables);
            this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg), null, this.disposables);
        }
        this.updateContent();
    }
    dispose() {
        this.panel?.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
    /** DB_14: push compare-derived regression fingerprints; partial message preserves Drift Advisor slice in the viewer. */
    pushRootCauseHintsSessionDiffToViewers() {
        if (!this.broadcaster) {
            return;
        }
        const fps = (0, db_session_fingerprint_diff_1.regressionFingerprintsForRootCauseHints)(this.summaryMapA, this.summaryMapB);
        this.broadcaster.postToWebview({
            type: "setRootCauseHintHostFields",
            sessionDiffSummary: fps.length > 0 ? { regressionFingerprints: fps } : null,
        });
    }
    handleMessage(msg) {
        if (msg.type === 'toggleSync') {
            this.syncScrolling = !this.syncScrolling;
            this.panel?.webview.postMessage({
                type: 'syncState',
                enabled: this.syncScrolling,
            });
            return;
        }
        if (msg.type === 'openLogAtDriftFingerprint') {
            void this.revealDriftFingerprintLine(msg.side, msg.fingerprint);
            return;
        }
        if (msg.type === 'openDriftAdvisorPanel') {
            void vscode.commands.executeCommand(drift_advisor_integration_1.DRIFT_ADVISOR_OPEN_COMMAND).then(undefined, () => { });
            return;
        }
        if (msg.type === 'useDbBaselineA') {
            this.broadcaster?.setDbBaselineFingerprintSummary((0, drift_sql_fingerprint_summary_persist_1.fingerprintSummaryMapToBaselineRecord)(this.summaryMapA));
            return;
        }
        if (msg.type === 'useDbBaselineB') {
            this.broadcaster?.setDbBaselineFingerprintSummary((0, drift_sql_fingerprint_summary_persist_1.fingerprintSummaryMapToBaselineRecord)(this.summaryMapB));
            return;
        }
        if (msg.type === 'clearDbBaseline') {
            this.broadcaster?.setDbBaselineFingerprintSummary(null);
        }
    }
    async revealDriftFingerprintLine(side, fingerprint) {
        const uri = side === 'b' ? this.uriB : this.uriA;
        const fp = typeof fingerprint === 'string' ? fingerprint : '';
        if (!uri || !fp) {
            return;
        }
        let line;
        const meta = await this.metadataStore.loadMetadata(uri);
        const occ = meta.driftSqlFingerprintSummary?.firstOccurrenceLineByFingerprint;
        if (occ && typeof occ[fp] === 'number') {
            line = occ[fp];
        }
        if (line === undefined) {
            const raw = await vscode.workspace.fs.readFile(uri);
            line = (0, db_session_fingerprint_diff_1.findFirstPhysicalLineForDriftFingerprintInLog)(Buffer.from(raw).toString('utf-8'), fp);
        }
        if (line === undefined) {
            void vscode.window.showWarningMessage('Could not find that SQL fingerprint in this log file.');
            return;
        }
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: true });
        const pos = new vscode.Position(line, 0);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(pos, pos);
    }
    updateContent() {
        if (!this.panel || !this.diffResult || !this.dbFingerprints) {
            return;
        }
        const { sessionA, sessionB, commonCount } = this.diffResult;
        const nameA = this.getFilename(sessionA.uri);
        const nameB = this.getFilename(sessionB.uri);
        this.panel.title = `Compare: ${nameA} ↔ ${nameB}`;
        const driftInstalled = !!vscode.extensions.getExtension(drift_advisor_integration_1.DRIFT_ADVISOR_EXTENSION_ID);
        this.panel.webview.html = (0, session_comparison_html_1.buildSessionComparisonHtml)({
            nonce: (0, session_comparison_html_1.generateWebviewNonce)(),
            nameA,
            nameB,
            commonCount,
            syncScrolling: this.syncScrolling,
            driftInstalled,
            showDbToolbar: !!this.broadcaster && this.dbFingerprints.hasDriftSql,
            db: this.dbFingerprints,
            dbCompareDetectorResults: this.dbCompareDetectorResults,
            sessionA: { uniqueCount: sessionA.uniqueCount, lines: sessionA.lines },
            sessionB: { uniqueCount: sessionB.uniqueCount, lines: sessionB.lines },
        });
    }
    getFilename(uri) {
        return uri.fsPath.split(/[\\/]/).pop() ?? 'session';
    }
}
exports.SessionComparisonPanel = SessionComparisonPanel;
/** Singleton instance for the comparison panel. */
let comparisonPanel;
/**
 * Get or create the comparison panel.
 */
function getComparisonPanel(extensionUri, broadcaster) {
    comparisonPanel ??= new SessionComparisonPanel(extensionUri, broadcaster);
    return comparisonPanel;
}
/**
 * Dispose the comparison panel singleton.
 */
function disposeComparisonPanel() {
    comparisonPanel?.dispose();
    comparisonPanel = undefined;
}
//# sourceMappingURL=session-comparison.js.map