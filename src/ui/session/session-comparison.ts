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

import * as vscode from 'vscode';
import { compareLogSessionsWithDbFingerprints, DiffResult } from '../../modules/misc/diff-engine';
import {
    findFirstPhysicalLineForDriftFingerprintInLog,
    type SessionDbFingerprintCompareResult,
} from '../../modules/db/db-session-fingerprint-diff';
import type { DbFingerprintSummaryEntry } from '../../modules/db/db-detector-types';
import { SessionMetadataStore } from '../../modules/session/session-metadata';
import { fingerprintSummaryMapToBaselineRecord } from '../../modules/db/drift-sql-fingerprint-summary-persist';
import type { ViewerBroadcaster } from '../provider/viewer-broadcaster';
import { DRIFT_ADVISOR_EXTENSION_ID, DRIFT_ADVISOR_OPEN_COMMAND } from '../provider/drift-advisor-integration';
import { buildSessionComparisonHtml, generateWebviewNonce } from './session-comparison-html';

/** Manages the comparison webview panel. */
export class SessionComparisonPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private diffResult: DiffResult | undefined;
    private dbFingerprints: SessionDbFingerprintCompareResult | undefined;
    private uriA: vscode.Uri | undefined;
    private uriB: vscode.Uri | undefined;
    private summaryMapA = new Map<string, DbFingerprintSummaryEntry>();
    private summaryMapB = new Map<string, DbFingerprintSummaryEntry>();
    private readonly metadataStore = new SessionMetadataStore();
    private syncScrolling = true;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly broadcaster?: ViewerBroadcaster,
    ) {}

    /**
     * Open or focus the comparison panel with two sessions.
     */
    async compare(uriA: vscode.Uri, uriB: vscode.Uri): Promise<void> {
        const { diff, dbFingerprints, summaryMapA, summaryMapB } = await compareLogSessionsWithDbFingerprints(
            uriA,
            uriB,
        );
        this.diffResult = diff;
        this.dbFingerprints = dbFingerprints;
        this.uriA = uriA;
        this.uriB = uriB;
        this.summaryMapA = new Map(summaryMapA);
        this.summaryMapB = new Map(summaryMapB);

        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'saropaLogCapture.comparison',
                'Saropa Log Comparison',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [this.extensionUri],
                },
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.disposables);

            this.panel.webview.onDidReceiveMessage(
                (msg) => this.handleMessage(msg),
                null,
                this.disposables,
            );
        }

        this.updateContent();
    }

    dispose(): void {
        this.panel?.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private handleMessage(msg: { type: string; [key: string]: unknown }): void {
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
            void vscode.commands.executeCommand(DRIFT_ADVISOR_OPEN_COMMAND).then(undefined, () => {});
            return;
        }
        if (msg.type === 'useDbBaselineA') {
            this.broadcaster?.setDbBaselineFingerprintSummary(
                fingerprintSummaryMapToBaselineRecord(this.summaryMapA),
            );
            return;
        }
        if (msg.type === 'useDbBaselineB') {
            this.broadcaster?.setDbBaselineFingerprintSummary(
                fingerprintSummaryMapToBaselineRecord(this.summaryMapB),
            );
            return;
        }
        if (msg.type === 'clearDbBaseline') {
            this.broadcaster?.setDbBaselineFingerprintSummary(null);
        }
    }

    private async revealDriftFingerprintLine(side: unknown, fingerprint: unknown): Promise<void> {
        const uri = side === 'b' ? this.uriB : this.uriA;
        const fp = typeof fingerprint === 'string' ? fingerprint : '';
        if (!uri || !fp) {
            return;
        }
        let line: number | undefined;
        const meta = await this.metadataStore.loadMetadata(uri);
        const occ = meta.driftSqlFingerprintSummary?.firstOccurrenceLineByFingerprint;
        if (occ && typeof occ[fp] === 'number') {
            line = occ[fp];
        }
        if (line === undefined) {
            const raw = await vscode.workspace.fs.readFile(uri);
            line = findFirstPhysicalLineForDriftFingerprintInLog(Buffer.from(raw).toString('utf-8'), fp);
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

    private updateContent(): void {
        if (!this.panel || !this.diffResult || !this.dbFingerprints) {
            return;
        }

        const { sessionA, sessionB, commonCount } = this.diffResult;
        const nameA = this.getFilename(sessionA.uri);
        const nameB = this.getFilename(sessionB.uri);

        this.panel.title = `Compare: ${nameA} ↔ ${nameB}`;
        const driftInstalled = !!vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID);
        this.panel.webview.html = buildSessionComparisonHtml({
            nonce: generateWebviewNonce(),
            nameA,
            nameB,
            commonCount,
            syncScrolling: this.syncScrolling,
            driftInstalled,
            showDbToolbar: !!this.broadcaster && this.dbFingerprints.hasDriftSql,
            db: this.dbFingerprints,
            sessionA: { uniqueCount: sessionA.uniqueCount, lines: sessionA.lines },
            sessionB: { uniqueCount: sessionB.uniqueCount, lines: sessionB.lines },
        });
    }

    private getFilename(uri: vscode.Uri): string {
        return uri.fsPath.split(/[\\/]/).pop() ?? 'session';
    }
}

/** Singleton instance for the comparison panel. */
let comparisonPanel: SessionComparisonPanel | undefined;

/**
 * Get or create the comparison panel.
 */
export function getComparisonPanel(extensionUri: vscode.Uri, broadcaster?: ViewerBroadcaster): SessionComparisonPanel {
    comparisonPanel ??= new SessionComparisonPanel(extensionUri, broadcaster);
    return comparisonPanel;
}

/**
 * Dispose the comparison panel singleton.
 */
export function disposeComparisonPanel(): void {
    comparisonPanel?.dispose();
    comparisonPanel = undefined;
}
