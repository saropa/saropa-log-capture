/**
 * Builds the in-viewer Crashlytics issue detail (header + stack + breakdown) and a Markdown copy of
 * the whole issue. Replaces the dropped editor-tab dashboard: the sidebar list stays, and clicking a
 * row renders the detail in the viewer's main area (see viewer-crashlytics-panel.ts).
 */

import { t } from '../../../l10n';
import { escapeHtml } from '../../../modules/capture/ansi';
import * as vscode from 'vscode';
import { getCrashEvents, getProcessStates } from '../../../modules/crashlytics/firebase-crashlytics';
import { getRepoSlug } from '../../../modules/git/github-context';
import { getFrameContexts, resolveFile, topAppFrameRef } from '../../../modules/crashlytics/crash-frame-context';
import { getProjectInsights } from '../../../modules/git/project-links';
import { crashSignatureToken } from '../../../modules/crashlytics/crash-signature';
import { issueShortId } from '../../../modules/crashlytics/play-reporting-mappers';
import { findCorrelatedLogLines } from '../../../modules/crashlytics/crash-log-correlation';
import { renderProjectInsights, renderLogCorrelation } from '../../analysis/analysis-project-insights';
import { renderCrashDetail, renderDeviceDistribution, renderProcessStates } from '../../analysis/analysis-crash-detail';
import type { CrashlyticsEventDetail } from '../../../modules/crashlytics/crashlytics-types';
import type { PostFn } from './crashlytics-handlers';

/** Issue fields passed from the clicked sidebar row (avoids a second lookup for the header/markdown). */
interface IssueMeta {
    readonly title?: string;
    readonly subtitle?: string;
    readonly events?: string;
    readonly users?: string;
    readonly fatal?: boolean;
    readonly fv?: string;
    readonly lv?: string;
    readonly kind?: string;
    readonly state?: string;
}

/** Coerce the untyped meta object posted by the webview into IssueMeta. */
function toMeta(raw: Record<string, unknown>): IssueMeta {
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    return { title: str(raw.title), subtitle: str(raw.subtitle), events: str(raw.events), users: str(raw.users), fatal: raw.fatal === true, fv: str(raw.fv), lv: str(raw.lv), kind: str(raw.kind), state: str(raw.state) };
}

function versionRange(meta: IssueMeta): string {
    if (meta.fv && meta.lv && meta.fv !== meta.lv) { return `${meta.fv} → ${meta.lv}`; }
    return meta.lv || meta.fv || '';
}

/** Distinctive words from the issue title for a GitHub issue search (e.g. the exception class name). */
function issueErrorTokens(meta: IssueMeta): string[] {
    const words = (meta.title ?? '').split(/[^A-Za-z0-9_.]+/).filter(w => w.length > 3);
    return [...new Set(words)].slice(0, 3);
}

/** Severity label + CSS class for the stat card, derived from the issue kind (ANR) or fatal flag. */
function severity(meta: IssueMeta): { label: string; cls: string } {
    if (meta.kind === 'anr') { return { label: t('viewer.crashlytics.sev.anr'), cls: 'cd-sev-anr' }; }
    if (meta.kind === 'nonfatal' || !meta.fatal) { return { label: t('viewer.crashlytics.sev.nonfatal'), cls: 'cd-sev-nf' }; }
    return { label: t('viewer.crashlytics.sev.crash'), cls: 'cd-sev-crash' };
}

function statCard(value: string, label: string, valueCls = ''): string {
    return `<div class="cd-stat"><span class="cd-stat-val ${valueCls}">${value}</span><span class="cd-stat-label">${label}</span></div>`;
}

/** Dashboard stat cards at the top of the detail (#4): severity, events, users, state, versions. */
function renderStatsStrip(meta: IssueMeta): string {
    const sev = severity(meta);
    const cards = [statCard(sev.label, t('viewer.crashlytics.stat.severity'), sev.cls)];
    if (meta.events) { cards.push(statCard(escapeHtml(meta.events), t('viewer.crashlytics.stat.events'))); }
    if (meta.users) { cards.push(statCard(escapeHtml(meta.users), t('viewer.crashlytics.stat.users'))); }
    if (meta.state && meta.state !== 'UNKNOWN') { cards.push(statCard(escapeHtml(meta.state), t('viewer.crashlytics.stat.state'))); }
    const ver = versionRange(meta);
    if (ver) { cards.push(statCard(escapeHtml(ver), t('viewer.crashlytics.stat.versions'))); }
    return `<div class="cd-stats">${cards.join('')}</div>`;
}

/**
 * Per-issue Firebase console deep link. The webview passes the project issues-list URL
 * (`…/crashlytics/app/android:{pkg}/issues`); appending the issue's hex short id deep-links to the
 * exact issue. Verified 2026-06-12: our Play Reporting issue ids are 32-char hex (e.g.
 * `7e7936dad4cdb0a53859be193b898e81`), the same namespace as the Firebase console issue id in
 * `…/issues/{hex}`. Falls back to the list URL when either piece is missing (never a broken link).
 */
function issueConsoleUrl(listUrl: string, issueId: string): string {
    if (!listUrl) { return ''; }
    const shortId = issueShortId(issueId);
    return shortId ? `${listUrl}/${shortId}` : listUrl;
}

function header(meta: IssueMeta, consoleUrl: string): string {
    // Firebase console deep link (#3): only the icon goes inside the title span so the row stays
    // compact; consoleUrl is the per-issue URL from issueConsoleUrl() (single source for the host:
    // firebase-crashlytics.ts builds the app/ base, issueConsoleUrl appends the issue hex).
    const consoleLink = consoleUrl
        ? ` <a class="cd-console-link" data-url="${escapeHtml(consoleUrl)}" title="${t('viewer.crashlytics.detail.viewOnline')}">↗</a>`
        : '';
    return `<div class="cd-header"><span class="cd-title">${escapeHtml(meta.title ?? 'Issue')}${consoleLink}</span>`
        + `<button class="cd-newissue">${t('viewer.crashlytics.detail.newIssue')}</button>`
        + `<button class="cd-copy">${t('viewer.crashlytics.detail.copyMd')}</button>`
        + `<button class="cd-back">${t('viewer.crashlytics.detail.back')}</button></div>`;
}

/** Whole issue as Markdown for the Copy button: facts, device, and the crash stack. */
function buildMarkdown(meta: IssueMeta, event?: CrashlyticsEventDetail): string {
    const lines = [`# ${meta.title ?? 'Crashlytics issue'}`, ''];
    if (meta.subtitle) { lines.push(`_${meta.subtitle}_`, ''); }
    const facts: string[] = [];
    if (meta.events) { facts.push(`Events: ${meta.events}`); }
    if (meta.users) { facts.push(`Users: ${meta.users}`); }
    facts.push(meta.fatal ? 'Fatal' : 'Non-fatal');
    const ver = versionRange(meta);
    if (ver) { facts.push(`Versions: ${ver}`); }
    lines.push(facts.join(' · '), '');
    const device = [event?.deviceModel, event?.osVersion].filter(Boolean).join(' / ');
    if (device) { lines.push(`Device: ${device}`, ''); }
    if (event?.crashThread && event.crashThread.frames.length > 0) {
        lines.push('## Stack', '```');
        for (const frame of event.crashThread.frames.slice(0, 80)) { lines.push(frame.text); }
        lines.push('```');
    }
    return lines.join('\n');
}

/** Open a clicked stack frame's source at its line in the editor (UX #1, jump to code). Never throws. */
export async function openCrashFrame(file: string, line: number): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!file || !ws) { return; }
    const uri = await resolveFile(file, ws.uri);
    if (!uri) { return; }
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn: vscode.ViewColumn.One });
    } catch {
        // Best-effort: a stale/renamed path just doesn't open.
    }
}

/**
 * Compute and stream the "In your project" panel (recent commits + changelog-since + annotations) for
 * the crash site. Streamed after the stack so the detail renders fast and this fills in. Never throws.
 */
async function streamProjectInsights(issueId: string, event: CrashlyticsEventDetail, meta: IssueMeta, post: PostFn): Promise<void> {
    const top = topAppFrameRef(event);
    const insights = await getProjectInsights({
        file: top?.file,
        line: top?.line,
        version: meta.lv || meta.fv,
        errorTokens: issueErrorTokens(meta),
    });
    if (!insights) { return; }
    const html = renderProjectInsights(insights);
    if (html) { post({ type: 'crashlyticsProjectInsights', issueId, html }); }
}

/**
 * Search the user's captured log sessions for the crash's signature and stream a "Seen in your logs"
 * panel that deep-links to the matching line. The extension's core competency. Never throws.
 */
async function streamLogCorrelation(issueId: string, meta: IssueMeta, post: PostFn): Promise<void> {
    const token = crashSignatureToken(meta.title ?? '');
    if (!token) { return; }
    const matches = await findCorrelatedLogLines(token);
    if (matches.length === 0) { return; }
    post({ type: 'crashlyticsLogCorrelation', issueId, html: renderLogCorrelation(matches, token) });
}

/**
 * Fetch the issue's foreground/background split (a true aggregate from the Play metric set) and stream
 * the "Device states" panel into the detail. Streamed so the stack renders first. Never throws.
 */
async function streamDeviceStates(issueId: string, post: PostFn): Promise<void> {
    const states = await getProcessStates(issueId);
    const html = renderProcessStates(states);
    if (html) { post({ type: 'crashlyticsDeviceStates', issueId, html }); }
}

/**
 * Fetch the issue's sampled event, render its detail into the in-viewer panel, and stream code context
 * (source line + git blame) for app frames afterwards. Never throws.
 */
export async function handleCrashlyticsDetail(issueId: string, rawMeta: Record<string, unknown>, post: PostFn, consoleUrl = ''): Promise<void> {
    const meta = toMeta(rawMeta);
    // Deep-link the header arrow to this specific issue, not the project issues list.
    const deepLink = issueConsoleUrl(consoleUrl, issueId);
    try {
        const multi = await getCrashEvents(issueId);
        const event = multi && multi.events.length > 0 ? multi.events[multi.currentIndex] : undefined;
        const body = event
            ? renderCrashDetail(event) + (multi ? renderDeviceDistribution(multi) : '')
            : '<div class="no-matches">No stack trace available for this issue.</div>';
        post({ type: 'crashlyticsDetailReady', issueId, title: meta.title ?? 'Issue', html: `${header(meta, deepLink)}<div class="cd-body">${renderStatsStrip(meta)}${body}</div>`, markdown: buildMarkdown(meta, event) });
        if (event) {
            const contexts = await getFrameContexts(event);
            if (contexts.length > 0) { post({ type: 'crashlyticsFrameContext', issueId, contexts }); }
            await streamProjectInsights(issueId, event, meta, post);
        }
        await streamDeviceStates(issueId, post);
        await streamLogCorrelation(issueId, meta, post);
    } catch {
        post({ type: 'crashlyticsDetailReady', issueId, title: meta.title ?? 'Issue', html: `${header(meta, deepLink)}<div class="cd-body"><div class="no-matches">Could not load this issue.</div></div>`, markdown: '' });
    }
}

/**
 * Open a prefilled GitHub "new issue" page for the current crash (UX: file the issue without
 * leaving the editor). Reuses the issue Markdown as the body and the workspace's origin remote
 * for the repo. Never throws. GitHub rejects oversized query strings, so the body is capped well
 * under the ~8 KB URL ceiling — the stack already lives in the copied Markdown if more is needed.
 */
export async function handleCrashlyticsCreateIssue(title: string, body: string): Promise<void> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const slug = cwd ? await getRepoSlug(cwd) : undefined;
    if (!slug) {
        void vscode.window.showWarningMessage(t('viewer.crashlytics.detail.noRemote'));
        return;
    }
    const cappedBody = body.length > 6000 ? `${body.slice(0, 6000)}\n\n…(truncated — full stack copied via Copy as Markdown)` : body;
    const url = `https://github.com/${slug}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(cappedBody)}`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
}
