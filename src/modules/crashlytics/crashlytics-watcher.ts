/**
 * Background Crashlytics watcher: polls for new / returned crash issues without the panel being open,
 * and surfaces them as a toast + status-bar badge — the in-IDE equivalent of Firebase's "Trending
 * stability issues" email, with no manual click into the panel required.
 *
 * Decoupled from the webview (the panel's own auto-refresh only runs while it is visible). Gated by the
 * `saropaLogCapture.firebase.notifyNewIssues` setting (off by default) and re-checked each tick. New /
 * returned ids are computed from the snapshot history and gated per-id via workspace state so the same
 * issue never re-alerts; an id that vanishes leaves the gate so its return re-alerts (a regression).
 */

import * as vscode from 'vscode';
import { getFirebaseContext } from './firebase-crashlytics';
import { readIssueHistory, readArchivedIds } from './crashlytics-io';
import { selectAlerts } from './crashlytics-issue-history';
import { logCrashlytics } from './crashlytics-diagnostics';
import { t } from '../../l10n';

/** Workspace-state key for the set of issue ids already alerted (persists across restarts). */
const alertedKey = 'crashlytics.alertedIssueIds';
/** Command auto-registered by VS Code for the log viewer view; reveals the sidebar. */
const revealViewerCommand = 'saropaLogCapture.logViewer.focus';

export class CrashlyticsWatcher implements vscode.Disposable {
    private timer: ReturnType<typeof setInterval> | undefined;
    private status: vscode.StatusBarItem | undefined;
    /** Single-flight guard: a scan slower than the interval must not overlap the next tick. */
    private scanning = false;
    /** Consecutive failed scans, and the timestamp before which scans are skipped (backoff). */
    private consecutiveFailures = 0;
    private backoffUntil = 0;

    constructor(private readonly context: vscode.ExtensionContext) {}

    /** Begin watching and re-schedule whenever the firebase settings change. */
    start(): void {
        this.reschedule();
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('saropaLogCapture.firebase')) { this.reschedule(); }
            }),
        );
    }

    /** Poll interval in ms, or 0 when the feature is off (which stops the timer). */
    private intervalMs(): number {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
        if (!cfg.get<boolean>('notifyNewIssues', false)) { return 0; }
        // Floor at 60s: the manifest allows refreshInterval down to 0 (disable), so a small positive
        // value (1-59) would otherwise hammer the API with a full token+fetch+snapshot every few seconds.
        return Math.max(60, cfg.get<number>('refreshInterval', 300)) * 1000;
    }

    private reschedule(): void {
        this.stop();
        const ms = this.intervalMs();
        if (ms > 0) { this.timer = setInterval(() => { void this.scan(); }, ms); }
    }

    /** One scan: refresh (records a snapshot), diff against history, alert on genuinely new ids. */
    private async scan(): Promise<void> {
        if (this.intervalMs() === 0) { this.stop(); return; }
        // Skip while a prior scan is still running (single-flight) or while backing off after failures.
        if (this.scanning || Date.now() < this.backoffUntil) { return; }
        this.scanning = true;
        try {
            const ctx = await getFirebaseContext([]);
            const status = ctx.diagnostics?.httpStatus ?? 0;
            // Back off on rate-limit / server error instead of re-hitting at the fixed interval, which
            // would only extend a 429. Reset the streak on a clean fetch.
            if (status === 429 || status >= 500) { this.recordFailure(); return; }
            this.consecutiveFailures = 0;
            this.backoffUntil = 0;
            await this.processAlerts();
        } catch (err) {
            this.recordFailure();
            logCrashlytics('error', `Watcher scan failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            this.scanning = false;
        }
    }

    /** Bump the failure streak and push the next allowed scan out (exponential-ish, capped at 5x). */
    private recordFailure(): void {
        this.consecutiveFailures++;
        this.backoffUntil = Date.now() + this.intervalMs() * Math.min(this.consecutiveFailures, 5);
    }

    /** Diff the snapshot history against already-alerted ids and toast genuinely new, non-archived ids. */
    private async processAlerts(): Promise<void> {
        const history = await readIssueHistory();
        const already = this.context.workspaceState.get<string[]>(alertedKey, []);
        const { toAlert, nextAlerted } = selectAlerts(history, already);
        await this.context.workspaceState.update(alertedKey, nextAlerted);
        // Archived issues are "don't tell me again" — skip them from the alert count.
        const archived = new Set(await readArchivedIds());
        const visible = toAlert.filter(id => !archived.has(id));
        if (visible.length > 0) { this.notify(visible.length); }
    }

    private notify(count: number): void {
        this.showBadge(count);
        void vscode.window
            .showInformationMessage(t('msg.crashlyticsNewIssues', count), t('action.view'))
            .then(sel => { if (sel) { void vscode.commands.executeCommand(revealViewerCommand); } });
    }

    private showBadge(count: number): void {
        if (!this.status) {
            this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
            this.status.command = revealViewerCommand;
            this.context.subscriptions.push(this.status);
        }
        this.status.text = `$(bug) ${count}`;
        this.status.tooltip = t('msg.crashlyticsNewIssuesTip', count);
        this.status.show();
    }

    private stop(): void {
        if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    }

    dispose(): void { this.stop(); }
}
