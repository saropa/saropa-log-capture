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
import { readIssueHistory } from './crashlytics-io';
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
        return cfg.get<number>('refreshInterval', 300) * 1000;
    }

    private reschedule(): void {
        this.stop();
        const ms = this.intervalMs();
        if (ms > 0) { this.timer = setInterval(() => { void this.scan(); }, ms); }
    }

    /** One scan: refresh (records a snapshot), diff against history, alert on genuinely new ids. */
    private async scan(): Promise<void> {
        if (this.intervalMs() === 0) { this.stop(); return; }
        try {
            await getFirebaseContext([]);
            const history = await readIssueHistory();
            const already = this.context.workspaceState.get<string[]>(alertedKey, []);
            const { toAlert, nextAlerted } = selectAlerts(history, already);
            await this.context.workspaceState.update(alertedKey, nextAlerted);
            if (toAlert.length > 0) { this.notify(toAlert.length); }
        } catch (err) {
            logCrashlytics('error', `Watcher scan failed: ${err instanceof Error ? err.message : String(err)}`);
        }
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
