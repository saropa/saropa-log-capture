/** Render Crashlytics crash event detail — frame classification and HTML output. */

import * as vscode from 'vscode';
import { escapeHtml } from '../modules/ansi';
import { isFrameworkFrame } from '../modules/stack-parser';
import { extractSourceReference } from '../modules/source-linker';
import { type StackFrameInfo, renderFrameSection } from './analysis-frame-render';
import type { CrashlyticsEventDetail, CrashlyticsStackFrame, CrashlyticsIssueEvents } from '../modules/firebase-crashlytics';
import type { IssueStats } from '../modules/crashlytics-stats';

/** Classify Crashlytics stack frames as app or framework using workspace context. */
function classifyFrames(frames: readonly CrashlyticsStackFrame[]): StackFrameInfo[] {
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return frames.map(f => ({
        text: f.text,
        isApp: !isFrameworkFrame(f.text, wsPath),
        sourceRef: extractSourceReference(f.text),
    }));
}

/** Render crash event detail with classified stack frames, device metadata, keys, and logs. */
export function renderCrashDetail(detail: CrashlyticsEventDetail): string {
    if (!detail.crashThread && detail.appThreads.length === 0 && !detail.customKeys?.length && !detail.logs?.length) {
        return '<div class="no-matches">No stack trace available</div>';
    }
    let html = renderDeviceMeta(detail);
    if (detail.crashThread) {
        html += `<div class="crash-thread-header">${escapeHtml(detail.crashThread.name)}</div>`;
        const frames = classifyFrames(detail.crashThread.frames);
        if (frames.length > 0) { html += renderFrameSection(frames); }
        else { html += '<div class="no-matches">No frames in crash thread</div>'; }
    }
    const appThreads = detail.appThreads.filter(t => {
        const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return t.frames.some(f => !isFrameworkFrame(f.text, wsPath));
    });
    if (appThreads.length > 0) { html += renderAppThreads(appThreads); }
    if (detail.customKeys && detail.customKeys.length > 0) { html += renderKeysSection(detail.customKeys); }
    if (detail.logs && detail.logs.length > 0) { html += renderLogsSection(detail.logs); }
    return html;
}

function renderDeviceMeta(detail: CrashlyticsEventDetail): string {
    const parts: string[] = [];
    if (detail.deviceModel) { parts.push(escapeHtml(detail.deviceModel)); }
    if (detail.osVersion) { parts.push(`Android ${escapeHtml(detail.osVersion)}`); }
    if (detail.eventTime) { parts.push(escapeHtml(formatEventTime(detail.eventTime))); }
    if (parts.length === 0) { return ''; }
    return `<div class="crash-device-meta">${parts.join(' · ')}</div>`;
}

function formatEventTime(raw: string): string {
    try { return new Date(raw).toLocaleString(); } catch { return raw; }
}

function renderKeysSection(keys: readonly { key: string; value: string }[]): string {
    let html = '<details class="group"><summary class="group-header">Keys <span class="match-count">' + keys.length + '</span></summary><table class="crash-keys-table">';
    for (const kv of keys) {
        html += `<tr><td class="crash-key-name">${escapeHtml(kv.key)}</td><td class="crash-key-value">${escapeHtml(kv.value)}</td></tr>`;
    }
    return html + '</table></details>';
}

function renderLogsSection(logs: readonly { timestamp?: string; message: string }[]): string {
    let html = '<details class="group"><summary class="group-header">Logs <span class="match-count">' + logs.length + ' breadcrumbs</span></summary>';
    for (const entry of logs) {
        const ts = entry.timestamp ? `<span class="crash-log-ts">${escapeHtml(entry.timestamp)}</span> ` : '';
        html += `<div class="crash-log-entry">${ts}${escapeHtml(entry.message)}</div>`;
    }
    return html + '</details>';
}

function renderAppThreads(threads: readonly { name: string; frames: readonly CrashlyticsStackFrame[] }[]): string {
    let html = `<details class="group"><summary class="group-header">Other Threads <span class="match-count">${threads.length} with app frames</span></summary>`;
    for (const t of threads.slice(0, 5)) {
        html += `<div class="crash-thread-header">${escapeHtml(t.name)}</div>`;
        const frames = classifyFrames(t.frames);
        const appFrames = frames.filter(f => f.isApp);
        for (const f of appFrames.slice(0, 10)) {
            const badge = '<span class="frame-badge frame-badge-app">APP</span>';
            if (f.sourceRef) {
                const file = escapeHtml(f.sourceRef.filePath);
                html += `<div class="stack-frame frame-app" data-frame-file="${file}" data-frame-line="${f.sourceRef.line}">${badge}<span class="line-text">${escapeHtml(f.text)}</span></div>`;
            } else {
                html += `<div class="stack-frame frame-app-nosrc">${badge}<span class="line-text">${escapeHtml(f.text)}</span></div>`;
            }
        }
    }
    return html + '</details>';
}

/** Render device/OS distribution summary across all events in an issue. */
export function renderDeviceDistribution(multi: CrashlyticsIssueEvents): string {
    if (multi.events.length < 2) { return ''; }
    const devices = new Map<string, number>();
    const osVersions = new Map<string, number>();
    for (const ev of multi.events) {
        if (ev.deviceModel) { devices.set(ev.deviceModel, (devices.get(ev.deviceModel) ?? 0) + 1); }
        if (ev.osVersion) { osVersions.set(ev.osVersion, (osVersions.get(ev.osVersion) ?? 0) + 1); }
    }
    if (devices.size === 0 && osVersions.size === 0) { return ''; }
    let html = '<details class="group" open><summary class="group-header">Device Distribution <span class="match-count">' + multi.events.length + ' events</span></summary>';
    if (devices.size > 0) { html += renderDistributionBar('Devices', devices, multi.events.length); }
    if (osVersions.size > 0) { html += renderDistributionBar('OS Versions', osVersions, multi.events.length); }
    return html + '</details>';
}

/** Render aggregate device/OS distribution from Crashlytics stats API. */
export function renderApiDistribution(stats: IssueStats): string {
    if (stats.deviceStats.length === 0 && stats.osStats.length === 0) { return ''; }
    let html = '<details class="group" open><summary class="group-header">Aggregate Distribution <span class="match-count">all events</span></summary>';
    if (stats.deviceStats.length > 0) {
        const devices = new Map(stats.deviceStats.map(e => [e.name, e.count]));
        html += renderDistributionBar('Devices', devices, stats.deviceStats.reduce((s, e) => s + e.count, 0));
    }
    if (stats.osStats.length > 0) {
        const os = new Map(stats.osStats.map(e => [e.name, e.count]));
        html += renderDistributionBar('OS Versions', os, stats.osStats.reduce((s, e) => s + e.count, 0));
    }
    return html + '</details>';
}

function renderDistributionBar(label: string, counts: Map<string, number>, total: number): string {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    let html = `<div class="crash-dist-label">${label}</div>`;
    for (const [name, count] of sorted) {
        const pct = Math.round((count / total) * 100);
        html += `<div class="crash-dist-row"><span class="crash-dist-name">${escapeHtml(name)}</span><div class="crash-dist-bar-bg"><div class="crash-dist-bar-fill" style="width:${pct}%"></div></div><span class="crash-dist-count">${count} (${pct}%)</span></div>`;
    }
    return html;
}
