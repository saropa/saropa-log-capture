/**
 * Builds the in-viewer Crashlytics issue detail (header + stack + breakdown) and a Markdown copy of
 * the whole issue. Replaces the dropped editor-tab dashboard: the sidebar list stays, and clicking a
 * row renders the detail in the viewer's main area (see viewer-crashlytics-panel.ts).
 */

import { t } from '../../../l10n';
import { escapeHtml } from '../../../modules/capture/ansi';
import * as vscode from 'vscode';
import { getCrashEvents } from '../../../modules/crashlytics/firebase-crashlytics';
import { getFrameContexts, resolveFile } from '../../../modules/crashlytics/crash-frame-context';
import { renderCrashDetail, renderDeviceDistribution } from '../../analysis/analysis-crash-detail';
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
}

/** Coerce the untyped meta object posted by the webview into IssueMeta. */
function toMeta(raw: Record<string, unknown>): IssueMeta {
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    return { title: str(raw.title), subtitle: str(raw.subtitle), events: str(raw.events), users: str(raw.users), fatal: raw.fatal === true, fv: str(raw.fv), lv: str(raw.lv) };
}

function versionRange(meta: IssueMeta): string {
    if (meta.fv && meta.lv && meta.fv !== meta.lv) { return `${meta.fv} → ${meta.lv}`; }
    return meta.lv || meta.fv || '';
}

function header(meta: IssueMeta): string {
    return `<div class="cd-header"><span class="cd-title">${escapeHtml(meta.title ?? 'Issue')}</span>`
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
 * Fetch the issue's sampled event, render its detail into the in-viewer panel, and stream code context
 * (source line + git blame) for app frames afterwards. Never throws.
 */
export async function handleCrashlyticsDetail(issueId: string, rawMeta: Record<string, unknown>, post: PostFn): Promise<void> {
    const meta = toMeta(rawMeta);
    try {
        const multi = await getCrashEvents(issueId);
        const event = multi && multi.events.length > 0 ? multi.events[multi.currentIndex] : undefined;
        const body = event
            ? renderCrashDetail(event) + (multi ? renderDeviceDistribution(multi) : '')
            : '<div class="no-matches">No stack trace available for this issue.</div>';
        post({ type: 'crashlyticsDetailReady', issueId, html: `${header(meta)}<div class="cd-body">${body}</div>`, markdown: buildMarkdown(meta, event) });
        if (event) {
            const contexts = await getFrameContexts(event);
            if (contexts.length > 0) { post({ type: 'crashlyticsFrameContext', issueId, contexts }); }
        }
    } catch {
        post({ type: 'crashlyticsDetailReady', issueId, html: `${header(meta)}<div class="cd-body"><div class="no-matches">Could not load this issue.</div></div>`, markdown: '' });
    }
}
