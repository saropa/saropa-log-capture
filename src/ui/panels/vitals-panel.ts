/** Persistent sidebar panel showing Google Play Vitals crash and ANR rates. */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../../modules/capture/ansi';
import { t } from '../../l10n';
import { getNonce } from '../provider/viewer-content';
import { queryVitals, clearVitalsCache, thresholds, getVitalsDiagnostic } from '../../modules/crashlytics/google-play-vitals';
import type { VitalsSnapshot } from '../../modules/crashlytics/google-play-vitals-types';
import { renderSparkline } from './vitals-sparkline';
import { getTokenStyles } from '../viewer-styles/viewer-styles-tokens';

/** WebviewViewProvider for the Google Play Vitals sidebar panel. */
export class VitalsPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    // Bug 018 hardening: this was a module-level `let`, shared by every instance of the class.
    // VS Code only ever registers one VitalsPanelProvider today, but a module-level timer is a
    // latent trap — a second instance (e.g. a future pop-out variant) would silently clear the
    // first instance's interval on dispose, or leak a second interval nothing tracks. Instance
    // field keeps the timer's lifetime tied 1:1 to the panel that owns it.
    private refreshTimer: ReturnType<typeof setInterval> | undefined;
    static readonly viewType = 'saropaLogCapture.vitalsPanel';

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        // Bug 018: the panel can be closed while the auto-refresh interval is still pending.
        // Without this handler the interval survives the webview and throws when it later
        // assigns to `webview.html` on a disposed view. Route disposal through the class's
        // own dispose() so interval-clearing logic lives in one place.
        webviewView.onDidDispose(() => this.dispose());
        this.refresh();
        this.startAutoRefresh();
    }

    async refresh(): Promise<void> {
        if (!this.view) { return; }
        this.view.webview.html = buildLoadingHtml();
        clearVitalsCache();
        const snapshot = await queryVitals().catch(() => undefined);
        if (this.view) { this.view.webview.html = buildPanelHtml(snapshot); }
    }

    /** Clears the auto-refresh interval. Called both by `onDidDispose` above (panel closed by
     *  the user) and by anything that holds a `vscode.Disposable` reference to this provider
     *  (e.g. `context.subscriptions`), so the interval is torn down however disposal happens. */
    dispose(): void {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = undefined; }
    }

    private startAutoRefresh(): void {
        if (this.refreshTimer) { return; }
        const interval = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<number>('refreshInterval', 300);
        // Bug 018: also gate each tick on `visible` — a hidden-but-not-yet-disposed panel
        // (e.g. user switched to another sidebar view) doesn't need a background network query,
        // and skipping it avoids racing a dispose that happens between ticks.
        if (interval > 0) {
            this.refreshTimer = setInterval(() => {
                if (this.view?.visible) { this.refresh(); }
            }, interval * 1000);
        }
    }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type === 'refresh') { await this.refresh(); }
        else if (msg.type === 'openPlayConsole') {
            const custom = vscode.workspace.getConfiguration('saropaLogCapture.playConsole').get<string>('appUrl', '');
            const url = custom || 'https://play.google.com/console';
            vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
        }
    }
}

function buildLoadingHtml(): string {
    return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>${t('vitals.loading')}</p></body></html>`;
}

function buildPanelHtml(snapshot: VitalsSnapshot | undefined): string {
    const nonce = getNonce();
    if (!snapshot) {
        // Show the actual failure reason (e.g. missing scope, with its fix) rather than a silent N/A.
        const diag = getVitalsDiagnostic();
        const reason = diag
            ? `<p style="font-size:12px"><strong>${t('vitals.whyLabel')}</strong> ${escapeHtml(diag.message)}</p>`
            : `<p style="font-size:11px;opacity:0.8">${t('vitals.requires')}</p>`;
        return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)">
<p>${t('vitals.notAvailable')}</p>
${reason}
</body></html>`;
    }
    const refreshNote = `(${formatElapsedLabel(snapshot.queriedAt)})`;
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getTokenStyles()}${getStyles()}</style></head><body>
<div role="main" aria-label="${t('vitals.title')}">
<div class="vt-toolbar"><span class="vt-title">${t('vitals.title')} ${refreshNote}</span><button class="vt-refresh" onclick="postMsg('refresh')" aria-label="${t('vitals.refreshAria')}">${t('vitals.refreshBtn')}</button></div>
<div class="vt-pkg">${escapeHtml(snapshot.packageName)}</div>
<div class="vt-hero">${renderCrashFreeUsers(snapshot.userCrashRate)}${renderCrashFree(snapshot.crashRate, snapshot.crashRateSeries)}</div>
${renderMetric(t('vitals.crashRate'), snapshot.crashRate, thresholds.crashRate, snapshot.crashRateSeries)}
${renderMetric(t('vitals.anrRate'), snapshot.anrRate, thresholds.anrRate, snapshot.anrRateSeries)}
<div class="vt-footer" onclick="postMsg('openPlayConsole')">${t('vitals.openPlayConsole')}</div>
</div>
<script nonce="${nonce}">const v=acquireVsCodeApi();function postMsg(t){v.postMessage({type:t})}</script>
</body></html>`;
}

/**
 * Headline "crash-free sessions" figure — the single number a team checks daily, mirroring the
 * Firebase console. Derived as 100 − crashRate (session-denominated). Labeled "sessions" on purpose:
 * Firebase's separate crash-free *users* metric uses a distinct-user denominator we do not query here
 * (that is a separate add), so this must not be presented as crash-free users. The period delta is
 * computed from the daily series (first day → latest); a RISING crash-free % is good (green ↑).
 */
function renderCrashFree(crashRate: number | undefined, series?: readonly number[]): string {
    if (crashRate === undefined) { return ''; }
    const free = 100 - crashRate;
    let delta = '';
    if (series && series.length >= 2) {
        // crash-free delta = drop in crash rate over the window (start rate − latest rate).
        const change = series[0] - series[series.length - 1];
        if (Math.abs(change) >= 0.005) {
            const up = change >= 0;
            delta = `<span class="vt-cf-delta ${up ? 'vt-cf-up' : 'vt-cf-down'}">${up ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%</span>`;
        }
    }
    return `<div class="vt-crashfree"><span class="vt-cf-label">${t('vitals.crashFreeSessions')}</span>`
        + `<span class="vt-cf-value">${free.toFixed(2)}%</span>${delta}</div>`;
}

/**
 * Crash-free USERS = 100 − userPerceivedCrashRate (distinct-user denominator). Distinct from crash-free
 * sessions above; this is the metric Firebase headlines as "Crash-free users". Hidden when the API
 * didn't return the user-perceived rate.
 */
function renderCrashFreeUsers(userCrashRate: number | undefined): string {
    if (userCrashRate === undefined) { return ''; }
    const free = 100 - userCrashRate;
    return `<div class="vt-crashfree"><span class="vt-cf-label">${t('vitals.crashFreeUsers')}</span>`
        + `<span class="vt-cf-value">${free.toFixed(2)}%</span></div>`;
}

function renderMetric(label: string, rate: number | undefined, threshold: number, series?: readonly number[]): string {
    if (rate === undefined) { return `<div class="vt-metric"><span class="vt-label">${label}</span><span class="vt-na">${t('vitals.na')}</span></div>`; }
    const pct = rate.toFixed(2) + '%';
    const bad = rate > threshold;
    const cls = bad ? ' vt-bad' : ' vt-good';
    const icon = bad ? '\u26a0' : '\u2713';
    return `<div class="vt-metric${cls}"><span class="vt-label">${label}</span><span class="vt-value">${icon} ${pct}</span><span class="vt-threshold">${t('vitals.threshold', String(threshold))}</span>${renderSparkline(series)}</div>`;
}

function getStyles(): string {
    return `body{padding:var(--space-1) var(--space-2);font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--text)}
.vt-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)}
.vt-title{font-weight:600;font-size:1.1em}
.vt-refresh{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:2px var(--space-2);cursor:pointer;border-radius:var(--radius-sm)}
.vt-pkg{font-size:var(--text-caption);opacity:0.7;margin-bottom:10px;font-family:var(--vscode-editor-font-family,monospace)}
.vt-refresh:hover{background:var(--vscode-button-hoverBackground,var(--vscode-button-background))}
/* Hero crash-free figures, side by side; collapses to one column when narrow / single-metric. */
.vt-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-bottom:10px}
.vt-crashfree{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:10px var(--space-3);display:flex;flex-direction:column;gap:2px}
.vt-cf-label{font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;opacity:0.72}
.vt-cf-value{font-size:1.9em;font-weight:700;line-height:1.1;color:var(--status-good)}
.vt-cf-delta{font-size:var(--text-caption);font-weight:600}
.vt-cf-up{color:var(--status-good)}
.vt-cf-down{color:var(--status-bad)}
/* Rate cards share the card chrome with a severity-colored left accent. */
.vt-metric{background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--border);border-radius:var(--radius);padding:var(--space-2) 10px;margin-bottom:6px;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.vt-good{border-left-color:var(--status-good)}
.vt-bad{border-left-color:var(--status-bad)}
.vt-label{font-weight:600;flex:1}.vt-value{font-size:1.2em;font-weight:700}
.vt-threshold{font-size:10px;opacity:0.6;width:100%}
.vt-good .vt-value{color:var(--status-good)}
.vt-bad .vt-value{color:var(--status-bad)}
.vt-na{opacity:0.5;font-style:italic}
.vt-spark{width:100%;height:18px;margin-top:var(--space-1);opacity:0.85}
.vt-good .vt-spark{color:var(--status-good)}
.vt-bad .vt-spark{color:var(--status-bad)}
.vt-footer{margin-top:var(--space-2);text-align:center;cursor:pointer;color:var(--link);font-size:var(--text-body)}`;
}
