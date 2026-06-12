/**
 * Crashlytics Handlers
 *
 * Handlers for Crashlytics panel operations including data fetching,
 * issue actions, and authentication.
 */

import * as vscode from 'vscode';
import { t } from '../../../l10n';
import {
    getFirebaseContext, getIssueFilterIndex,
    clearIssueListCache, gcloudInstallUrl, getGcloudInstallCommand, findBestGoogleServicesJson,
    type FirebaseContext,
} from '../../../modules/crashlytics/firebase-crashlytics';
import { serializeContext } from './crashlytics-serializers';
import { readArchivedIds, setIssueArchived } from '../../../modules/crashlytics/crashlytics-io';
import { getOutputChannel, playReportingScopeFix } from '../../../modules/crashlytics/crashlytics-diagnostics';
import { runConnectionCheck, formatConnectionReport } from '../../../modules/crashlytics/crashlytics-connection-check';

export type PostFn = (msg: unknown) => void;

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let terminalListener: vscode.Disposable | undefined;

/**
 * Fetch Crashlytics context and send to webview. Never throws.
 *
 * `forceRefresh` clears the caches first (the Refresh button / "Check Again"). Opening the panel
 * passes false so it reuses the in-memory issue cache (5 min) and gcloud token (30 min) — otherwise
 * every reopen re-spawned gcloud and re-hit the API, which is the "long delay on second open" bug.
 */
export async function handleCrashlyticsRequest(post: PostFn, forceRefresh = false): Promise<void> {
    try {
        if (forceRefresh) { clearIssueListCache(); }
        const raw = await getFirebaseContext([]);
        const ctx: FirebaseContext = raw ?? { available: false, setupHint: 'Query failed', issues: [] };
        const gcloudInstallCommand = getGcloudInstallCommand();
        let workspaceGoogleServicesPath: string | undefined;
        if (ctx.setupStep === 'config') {
            const uri = await findBestGoogleServicesJson();
            if (uri) {
                const ws = vscode.workspace.workspaceFolders?.[0];
                workspaceGoogleServicesPath = ws ? vscode.workspace.asRelativePath(uri) : uri.fsPath;
            }
        }
        const archivedIds = await readArchivedIds();
        post({ type: 'crashlyticsData', context: serializeContext(ctx, { gcloudInstallCommand, workspaceGoogleServicesPath, archivedIds }) });
    } catch {
        const fallbackChecklist = { gcloud: 'missing' as const, token: 'pending' as const, config: 'pending' as const };
        post({ type: 'crashlyticsData', context: serializeContext({ available: false, setupHint: 'Unexpected error', setupChecklist: fallbackChecklist, issues: [] }) });
    }
}

/**
 * Archive or unarchive an issue locally (the Play API is read-only, so this is a local view filter,
 * not an upstream resolution). Confirms with a toast naming the issue, then refreshes the panel so the
 * row hides/returns. Never throws.
 */
export async function handleCrashlyticsArchive(id: string, title: string, archived: boolean, post: PostFn): Promise<void> {
    if (!id) { return; }
    await setIssueArchived(id, archived);
    const name = title || id;
    const msg = archived ? t('msg.crashlyticsArchived', name) : t('msg.crashlyticsUnarchived', name);
    void vscode.window.showInformationMessage(msg);
    await handleCrashlyticsRequest(post);
}

/**
 * Run the step-by-step connection check and report results everywhere the user might look:
 * a per-step report posted to the panel, the full text in the output channel, and a summary toast.
 * On success, refreshes the panel so issues replace the setup wizard. Never throws.
 */
export async function handleCrashlyticsValidate(post: PostFn): Promise<void> {
    try {
        const report = await runConnectionCheck();
        const channel = getOutputChannel();
        channel.appendLine('');
        channel.appendLine(formatConnectionReport(report));
        post({ type: 'crashlyticsConnectionReport', report });
        if (report.ok) {
            void vscode.window.showInformationMessage(t('msg.crashlyticsConnected'));
            await handleCrashlyticsRequest(post);
            return;
        }
        const firstFail = report.steps.find(s => s.status === 'fail');
        const summary = firstFail ? `${firstFail.label}: ${firstFail.detail}` : t('msg.crashlyticsNotConnected');
        void vscode.window.showWarningMessage(summary, t('action.showDetails')).then(sel => { if (sel) { channel.show(); } });
    } catch {
        post({ type: 'crashlyticsConnectionReport', report: { steps: [], ok: false, checkedAt: Date.now() } });
    }
}

/** Lazy: fetch per-issue device/OS maps for the sidebar filters and push to the webview. Never throws. */
export async function handleCrashlyticsFilterIndex(post: PostFn): Promise<void> {
    try {
        const index = await getIssueFilterIndex();
        if (index) { post({ type: 'crashlyticsFilterIndex', index }); }
    } catch {
        // Filters degrade to no-op dropdowns if the index can't be fetched.
    }
}

/**
 * Open a terminal and run gcloud auth, requesting the Play reporting scope alongside cloud-platform;
 * auto-refresh on terminal close. Without the playdeveloperreporting scope the errors API returns 403
 * ACCESS_TOKEN_SCOPE_INSUFFICIENT (bug_008 W4), so we always sign in with it.
 */
export function handleGcloudAuth(post: PostFn): void {
    const terminal = vscode.window.createTerminal({ name: 'Google Cloud Auth' });
    terminal.show();
    terminal.sendText(playReportingScopeFix);
    terminalListener?.dispose();
    terminalListener = vscode.window.onDidCloseTerminal(closed => {
        if (closed !== terminal) { return; }
        terminalListener?.dispose();
        terminalListener = undefined;
        handleCrashlyticsRequest(post);
    });
}

/** Show file picker for google-services.json and copy to workspace root. Never throws. */
export async function handleBrowseGoogleServices(post: PostFn): Promise<void> {
    try {
        const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'JSON': ['json'] },
            openLabel: 'Select google-services.json',
        });
        if (!files || files.length === 0) { return; }
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) { return; }
        const dest = vscode.Uri.joinPath(ws.uri, 'google-services.json');
        await vscode.workspace.fs.copy(files[0], dest, { overwrite: true });
        await handleCrashlyticsRequest(post);
    } catch {
        // Silently ignore so we never crash the app
    }
}

/** Open google-services.json in the workspace (prefers android/app/). Shows progress while resolving. Never throws. */
export async function handleOpenGoogleServicesJson(): Promise<void> {
    try {
        const uri = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Opening google-services.json…' },
            () => findBestGoogleServicesJson(),
        );
        if (uri) {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
        } else {
            await vscode.window.showInformationMessage(t('msg.noGoogleServicesJson'));
        }
    } catch {
        await vscode.window.showInformationMessage(t('msg.noGoogleServicesJson'));
    }
}

/** Open the gcloud install URL. */
export function handleOpenGcloudInstall(): void {
    vscode.env.openExternal(vscode.Uri.parse(gcloudInstallUrl)).then(undefined, () => {});
}

/** Show the Saropa Log Capture output channel (where Crashlytics logs and errors are written). */
export function handleCrashlyticsShowOutput(): void {
    getOutputChannel().show();
}

/** Start periodic Crashlytics auto-refresh. */
export function startCrashlyticsAutoRefresh(post: PostFn): void {
    stopCrashlyticsAutoRefresh();
    const interval = vscode.workspace
        .getConfiguration('saropaLogCapture.firebase')
        .get<number>('refreshInterval', 300);
    if (interval > 0) {
        refreshTimer = setInterval(() => { handleCrashlyticsRequest(post); }, interval * 1000);
    }
}

/** Stop periodic Crashlytics auto-refresh. */
export function stopCrashlyticsAutoRefresh(): void {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined; }
}

/** Dispose terminal listener and stop auto-refresh. */
export function disposeCrashlyticsHandlers(): void {
    stopCrashlyticsAutoRefresh();
    terminalListener?.dispose();
    terminalListener = undefined;
}
