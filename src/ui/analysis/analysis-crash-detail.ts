/** Render Crashlytics crash event detail — frame classification and HTML output. */

import * as vscode from 'vscode';
import { escapeHtml } from '../../modules/capture/ansi';
import { isFrameworkFrame } from '../../modules/analysis/stack-parser';
import { extractSourceReference } from '../../modules/source/source-linker';
import { type StackFrameInfo, renderSmartFrameSection } from './analysis-frame-render';
import type { CrashlyticsEventDetail, CrashlyticsStackFrame, CrashlyticsIssueEvents } from '../../modules/crashlytics/firebase-crashlytics';
import type { IssueStats } from '../../modules/crashlytics/crashlytics-stats';
import type { StatEntry } from '../../modules/crashlytics/play-reporting-metrics';
import { groupCrashThreads, type ThreadGroup } from '../../modules/crashlytics/crashlytics-thread-grouping';
import type { CrashlyticsThread } from '../../modules/crashlytics/crashlytics-types';

/** Cap on distinct thread groups rendered, so a 100-thread dump can't flood the panel. */
const maxThreadGroups = 8;
/** Cap on frames shown per thread group — enough to identify the stack without a wall. */
const maxThreadFrames = 10;

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
        if (frames.length > 0) { html += renderSmartFrameSection(frames); }
        else { html += '<div class="no-matches">No frames in crash thread</div>'; }
    }
    if (detail.appThreads.length > 0) { html += renderOtherThreads(detail.appThreads); }
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
    let html = '<details class="group cd-tile"><summary class="group-header">Keys <span class="match-count">' + keys.length + '</span></summary><table class="crash-keys-table">';
    for (const kv of keys) {
        html += `<tr><td class="crash-key-name">${escapeHtml(kv.key)}</td><td class="crash-key-value">${escapeHtml(kv.value)}</td></tr>`;
    }
    return html + '</table></details>';
}

function renderLogsSection(logs: readonly { timestamp?: string; message: string }[]): string {
    let html = '<details class="group cd-tile"><summary class="group-header">Logs <span class="match-count">' + logs.length + ' breadcrumbs</span></summary>';
    for (const entry of logs) {
        const ts = entry.timestamp ? `<span class="crash-log-ts">${escapeHtml(entry.timestamp)}</span> ` : '';
        html += `<div class="crash-log-entry">${ts}${escapeHtml(entry.message)}</div>`;
    }
    return html + '</details>';
}

/**
 * Render the "Other Threads" panel: every non-crash thread, collapsed by identical stack so the few
 * distinct threads stand out instead of being buried under dozens of identical native/waiting ones
 * (plan 054 Stage 5b). Groups beyond the cap are summarized rather than dropped silently.
 */
function renderOtherThreads(threads: readonly CrashlyticsThread[]): string {
    const groups = groupCrashThreads(threads);
    const count = `<span class="match-count">${threads.length} threads · ${groups.length} unique</span>`;
    let html = `<details class="group cd-tile"><summary class="group-header">Other Threads ${count}</summary>`;
    for (const g of groups.slice(0, maxThreadGroups)) { html += renderThreadGroup(g); }
    if (groups.length > maxThreadGroups) {
        html += `<div class="crash-thread-more">+${groups.length - maxThreadGroups} more unique threads</div>`;
    }
    return html + '</details>';
}

/** One thread group: header (name + `×N` collapse badge + the other names), then its frames. */
function renderThreadGroup(g: ThreadGroup): string {
    const badge = g.count > 1
        ? ` <span class="cd-thread-count" title="${g.count} threads with an identical stack">×${g.count}</span>`
        : '';
    let html = `<div class="crash-thread-header">${escapeHtml(g.rep.name)}${badge}</div>`;
    // List the collapsed siblings so a reader can confirm what got merged (capped to stay compact).
    if (g.count > 1) {
        const others = g.names.slice(1, 6).map(escapeHtml).join(', ');
        const overflow = g.count > 6 ? `, +${g.count - 6}` : '';
        html += `<div class="crash-thread-names">${others}${overflow}</div>`;
    }
    return html + renderThreadFrames(g.rep.frames);
}

/** Show a thread's app frames (actionable); fall back to its top native frames so a native-only
 * thread still shows what it was doing rather than rendering an empty header. */
function renderThreadFrames(frames: readonly CrashlyticsStackFrame[]): string {
    const classified = classifyFrames(frames);
    const appFrames = classified.filter(f => f.isApp);
    const show = appFrames.length > 0 ? appFrames.slice(0, maxThreadFrames) : classified.slice(0, 3);
    return show.map(renderThreadFrame).join('');
}

/** Render one frame row inside an Other-Threads group (app frames stay click-to-source). */
function renderThreadFrame(f: StackFrameInfo): string {
    const badge = `<span class="frame-badge ${f.isApp ? 'frame-badge-app' : 'frame-badge-fw'}">${f.isApp ? 'APP' : 'FW'}</span>`;
    if (f.isApp && f.sourceRef) {
        const file = escapeHtml(f.sourceRef.filePath);
        return `<div class="stack-frame frame-app" data-frame-file="${file}" data-frame-line="${f.sourceRef.line}">${badge}<span class="line-text">${escapeHtml(f.text)}</span></div>`;
    }
    const cls = f.isApp ? 'stack-frame frame-app-nosrc' : 'stack-frame frame-fw';
    return `<div class="${cls}">${badge}<span class="line-text">${escapeHtml(f.text)}</span></div>`;
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
    let html = '<details class="group cd-tile" open><summary class="group-header">Device Distribution <span class="match-count">' + multi.events.length + ' events</span></summary>';
    if (devices.size > 0) { html += renderDistributionBar('Devices', devices, multi.events.length); }
    if (osVersions.size > 0) { html += renderDistributionBar('OS Versions', osVersions, multi.events.length); }
    return html + '</details>';
}

/** Render aggregate device/OS distribution from Crashlytics stats API. */
export function renderApiDistribution(stats: IssueStats): string {
    if (stats.deviceStats.length === 0 && stats.osStats.length === 0) { return ''; }
    let html = '<details class="group cd-tile" open><summary class="group-header">Aggregate Distribution <span class="match-count">all events</span></summary>';
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

/** Friendly label for a Play `appProcessState` enum value. */
function processStateLabel(raw: string): string {
    if (raw === 'FOREGROUND') { return 'Foreground'; }
    if (raw === 'BACKGROUND') { return 'Background'; }
    return raw;
}

/**
 * Render the foreground/background "Device states" panel from the Play appProcessState dimension —
 * a true aggregate (not a sample). Empty when there is no data. Streamed into the detail.
 */
export function renderProcessStates(states: readonly StatEntry[]): string {
    const total = states.reduce((sum, e) => sum + e.count, 0);
    if (total === 0) { return ''; }
    const counts = new Map(states.map(e => [processStateLabel(e.name), e.count] as const));
    return '<details class="group cd-tile cd-device-states" open><summary class="group-header">Device states <span class="match-count">all events</span></summary>'
        + renderDistributionBar('App state', counts, total) + '</details>';
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
