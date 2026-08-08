/**
 * Native webview panel for the Session Flow Map (plan 056, S1). Renders the diagram, tables, and
 * narrative in VS Code. Every row links back to its source `file:line` (R5) AND its originating LOG
 * line — clicking reveals the line in the log viewer or copies it. A top-bar save icon writes the
 * portable .md; collapsible sections, a TOC, and stat pills round out the dashboard.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import type { FlowGraph, ParsedLog } from '../../modules/flow-map/flow-map-model';
import type { FlowShot } from '../../modules/flow-map/flow-map-screenshots';
import type { BreadcrumbSuggestion } from '../../modules/flow-map/flow-map-empty-diagnostic';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../modules/flow-map/flow-map-html';
import { flowMapStyles } from './flow-map-panel-styles';
import { flowMapScript } from './flow-map-panel-script';
import { flowMapZoomScript } from './flow-map-panel-zoom-script';
import { flowMapReplayScript } from './flow-map-panel-replay-script';
import { flowMapLightboxScript, type LightboxLabels } from './flow-map-panel-lightbox-script';
import {
    loadSessionShots, shotsForScreen, type CompareSession,
} from '../../modules/flow-map/flow-map-cross-session';

const VIEW_TYPE = 'saropaFlowMap';
const POPOUT_VIEW_TYPE = 'saropaFlowMapDiagram';

/** Inputs needed to render and to service the panel's buttons/links. */
export interface FlowMapPanelParams {
    readonly parsed: ParsedLog;
    readonly graph: FlowGraph;
    readonly markdown: string;
    readonly defaultUri: vscode.Uri;
    /** The source log, for "copy log line". */
    readonly logUri: vscode.Uri;
    /** Reveal a 1-based line in the open log viewer ("navigate to that part of the log"). */
    readonly revealLine: (line: number) => void;
    /** Regenerate the report from the current log and re-render the panel. */
    readonly refresh: () => void;
    /** Captured screenshots (plan 114) joined to the screen active when each was taken (Phase E). */
    readonly screenshots: readonly FlowShot[];
    /** Count of sidecar entries beyond the render cap, for the "+N more" gallery note. */
    readonly screenshotsOmitted: number;
    /** Captures the near-duplicate rule dropped at capture time; 0 when that setting is off. */
    readonly screenshotsSuppressed: number;
    /**
     * Capture directories both panels open to `localResourceRoots`: this log's `.screenshots/`
     * first, then those of the sessions it can be compared against. Captures are referenced, not
     * embedded, so a capture outside every one of these roots loads as nothing.
     */
    readonly shotRoots: readonly vscode.Uri[];
    /** Other sessions holding captures of the same screens, for the lightbox's compare selector. */
    readonly compareSessions: readonly CompareSession[];
    /** Empty-state breadcrumb diagnostic (plan follow-up): custom-rule suggestions when the diagram
     * has no nodes. Empty when the graph is populated or the heuristic found nothing worth suggesting. */
    readonly suggestions: readonly BreadcrumbSuggestion[];
}

let current: vscode.WebviewPanel | undefined;
// Latest report shown — the message handler (wired once) reads this so reveals don't stack listeners.
let currentParams: FlowMapPanelParams | undefined;
// The optional "pop-out" panel showing only the diagram at full size (plan 056, S3).
let popout: vscode.WebviewPanel | undefined;

/** Cryptographically-irrelevant nonce for the CSP script/style allowlist. */
function getNonce(): string {
    let out = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) { out += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return out;
}

/** Minimal escape for the dynamic save label injected outside the pre-escaped body. */
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline glyphs (no codicon font asset / no CSP font-src needed).
const ICON = 'width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" '
    + 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SAVE_SVG = `<svg ${ICON}><path d="M8 1.7v7.6"/><path d="M4.7 6.3 8 9.6l3.3-3.3"/><path d="M2.7 13.3h10.6"/></svg>`;
const REFRESH_SVG = `<svg ${ICON}><path d="M13.4 8a5.4 5.4 0 1 1-1.5-3.8"/><path d="M13.6 2.6v3h-3"/></svg>`;
const LOG_SVG = `<svg ${ICON}><path d="M4 1.6h5l3 3v9.8H4z"/><path d="M9 1.6v3h3"/><path d="M6 8h4M6 10.5h4"/></svg>`;

/** One icon button for the top bar. */
function iconButton(id: string, label: string, svg: string): string {
    const t9 = esc(label);
    return `<button type="button" id="${id}" class="icon-btn" title="${t9}" aria-label="${t9}">${svg}</button>`;
}

/**
 * Lightbox labels resolved host-side. Built per render (not at import time) so `t()` reads the
 * workspace locale rather than whatever was active when the module first loaded.
 */
function lightboxLabels(): LightboxLabels {
    return {
        title: t('flowMap.shot.title'),
        captured: t('flowMap.shot.captured'),
        trigger: t('flowMap.shot.trigger'),
        screen: t('flowMap.shot.screen'),
        logLine: t('flowMap.shot.logLine'),
        close: t('flowMap.shot.close'),
        // No args: `t()` returns the translated template with {0}/{1} intact for the script to fill.
        counter: t('flowMap.shot.counter'),
        counterScreen: t('flowMap.shot.counterScreen'),
        file: t('flowMap.shot.file'),
        copyPath: t('flowMap.shot.copyPath'),
        zoom: t('flowMap.shot.zoom'),
        zoomHint: t('flowMap.shot.zoomHint'),
        unavailable: t('flowMap.shot.unavailable'),
        compare: t('flowMap.shot.compare'),
        comparePrev: t('flowMap.shot.comparePrev'),
        compareNext: t('flowMap.shot.compareNext'),
        compareSession: t('flowMap.shot.compareSession'),
        compareThisSession: t('flowMap.shot.compareThisSession'),
        compareLoading: t('flowMap.shot.compareLoading'),
        compareNoMatch: t('flowMap.shot.compareNoMatch'),
    };
}

/**
 * Rewrite each capture's `file:` URI into a URL this webview's sandbox will load. Per render, not
 * once at load: the report panel and the pop-out are separate webviews, and only the live one can
 * mint a URL its own CSP `cspSource` matches.
 */
function withWebviewSrc(webview: vscode.Webview, shots: readonly FlowShot[]): readonly FlowShot[] {
    return shots.map(s => ({ ...s, src: webview.asWebviewUri(vscode.Uri.parse(s.src)).toString() }));
}

/**
 * Webview options for both panels. `localResourceRoots` opens exactly the directories holding
 * captures this report can show — the source log's, plus any session it can be compared against.
 */
function webviewOptions(roots: readonly vscode.Uri[]): vscode.WebviewOptions {
    return { enableScripts: true, localResourceRoots: [...roots] };
}

/**
 * Reapply resource roots only when they actually changed. The panel outlives any one log, so the
 * roots must follow the report — but writing `webview.options` unconditionally on every render
 * reassigns a live webview's security configuration for no reason, and a no-op write is not
 * something to do to a surface that is currently displaying content.
 */
function syncResourceRoots(webview: vscode.Webview, roots: readonly vscode.Uri[]): void {
    const current = (webview.options.localResourceRoots ?? []).map(u => u.toString()).join('|');
    const next = roots.map(u => u.toString()).join('|');
    if (current !== next) { webview.options = webviewOptions(roots); }
}

/** The report title, shown first (before the pill/action bar). */
function titleHtml(params: FlowMapPanelParams): string {
    const project = params.parsed.header.project;
    const suffix = project ? ` — ${esc(project)}` : '';
    return `<h1 class="report-title">🧭 ${esc(t('flowMap.panelTitle'))}${suffix}</h1>`;
}

/** Full HTML document: CSP, styles, header (title + action buttons), report body, script. */
function buildHtml(params: FlowMapPanelParams, nonce: string, webview: vscode.Webview): string {
    // Stats and the log path now live as rows in the Session-info section (info ≠ navigation).
    const body = buildFlowMapBody(params.parsed, params.graph, params.logUri.fsPath, {
        screenshots: withWebviewSrc(webview, params.screenshots),
        screenshotsOmitted: params.screenshotsOmitted,
        screenshotsSuppressed: params.screenshotsSuppressed,
        suggestions: params.suggestions,
    });
    // img-src ${webview.cspSource} — captures load from disk (gallery AND diagram cards), never as
    // embedded data URIs; `data:` is deliberately NOT allowed, so a stray embed fails loudly here
    // rather than quietly reintroducing megabytes of base64 into the document.
    const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; `
        + `img-src ${webview.cspSource};`;
    const actions = '<div class="topbar-actions">'
        + iconButton('showlog-fm', t('flowMap.showLogBtn'), LOG_SVG)
        + iconButton('refresh-fm', t('flowMap.refreshBtn'), REFRESH_SVG)
        + iconButton('save-md', t('flowMap.saveMarkdownBtn'), SAVE_SVG)
        + '</div>';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
${flowMapStyles(nonce)}</head><body>
<div class="report-head">${titleHtml(params)}${actions}</div>
${body}
${flowMapScript(nonce)}
${flowMapZoomScript(nonce)}
${flowMapReplayScript(nonce)}
${flowMapLightboxScript(nonce, lightboxLabels(), params.compareSessions)}</body></html>`;
}

/** The pop-out panel's HTML: diagram only, full bleed, same lens/popup scripts (no nested pop-out). */
function buildDiagramHtml(params: FlowMapPanelParams, nonce: string, webview: vscode.Webview): string {
    // The pop-out renders no gallery, but its cards carry the same thumbnails, so it needs the same
    // image source as the report. `cspSource` is per-webview — never reuse the report panel's.
    const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; `
        + `img-src ${webview.cspSource};`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
${flowMapStyles(nonce)}</head><body>
<div class="report-head">${titleHtml(params)}</div>
${buildFlowDiagramBody(params.graph, withWebviewSrc(webview, params.screenshots))}
${flowMapScript(nonce)}
${flowMapZoomScript(nonce)}
${flowMapReplayScript(nonce)}
${flowMapLightboxScript(nonce, lightboxLabels(), params.compareSessions)}</body></html>`;
}

/** Open (or reveal) the diagram-only pop-out panel beside the report. */
function showFlowDiagramPanel(params: FlowMapPanelParams): void {
    if (!popout) {
        popout = vscode.window.createWebviewPanel(
            POPOUT_VIEW_TYPE, panelTitle(params), vscode.ViewColumn.Beside,
            { ...webviewOptions(params.shotRoots), retainContextWhenHidden: true },
        );
        popout.onDidDispose(() => { popout = undefined; });
        popout.webview.onDidReceiveMessage(handleMessage);
    }
    popout.title = panelTitle(params);
    syncResourceRoots(popout.webview, params.shotRoots);
    popout.webview.html = buildDiagramHtml(params, getNonce(), popout.webview);
    popout.reveal(vscode.ViewColumn.Beside);
}

/** Save the markdown report via a save dialog, then offer to open it. */
async function saveMarkdown(params: FlowMapPanelParams): Promise<void> {
    const target = await vscode.window.showSaveDialog({
        defaultUri: params.defaultUri,
        filters: { Markdown: ['md'] },
        title: t('flowMap.saveTitle'),
    });
    if (!target) { return; }
    await vscode.workspace.fs.writeFile(target, Buffer.from(params.markdown, 'utf-8'));
    const open = await vscode.window.showInformationMessage(
        t('msg.exportedTo', target.fsPath.split(/[\\/]/).pop() ?? ''), t('action.open'),
    );
    if (open === t('action.open')) { await vscode.window.showTextDocument(target); }
}

/** Resolve a project-relative source path and open it at the given line. */
async function openSource(projectRoot: string | undefined, file: string, line: number): Promise<void> {
    if (!file) { return; }
    const uri = projectRoot && !/^([a-zA-Z]:[\\/]|\/)/.test(file)
        ? vscode.Uri.joinPath(vscode.Uri.file(projectRoot), ...file.split('/'))
        : vscode.Uri.file(file);
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos) });
    } catch {
        void vscode.window.showWarningMessage(t('flowMap.sourceNotFound', file));
    }
}

/** Read the raw log line (1-based) and copy it to the clipboard. */
async function copyLogLine(logUri: vscode.Uri, line: number): Promise<void> {
    if (line <= 0) { return; }
    try {
        const text = Buffer.from(await vscode.workspace.fs.readFile(logUri)).toString('utf-8').split(/\r?\n/);
        await vscode.env.clipboard.writeText((text[line - 1] ?? '').trim());
        vscode.window.setStatusBarMessage(t('flowMap.logCopied', String(line)), 2000);
    } catch {
        void vscode.window.showWarningMessage(t('flowMap.logCopied', String(line)));
    }
}

/** True when `entries` already contains a custom-breadcrumb rule with this exact `pattern`. */
function hasPattern(entries: readonly unknown[], pattern: string): boolean {
    // Compare trimmed: a rule the user hand-edited with stray whitespace is the SAME rule to the
    // regex engine, so an exact-string check would silently append a duplicate that never fires twice.
    const want = pattern.trim();
    return entries.some((e) => {
        const raw = typeof e === 'object' && e !== null ? (e as { pattern?: unknown }).pattern : undefined;
        return typeof raw === 'string' && raw.trim() === want;
    });
}

/**
 * Where a generated rule is written. Workspace scope keeps a project's log dialect with the project,
 * but `update()` REJECTS workspace scope when no folder is open (a single-file window), which would
 * surface as a bare error on an otherwise valid click — fall back to user scope there.
 */
function ruleTarget(): vscode.ConfigurationTarget {
    return (vscode.workspace.workspaceFolders?.length ?? 0) > 0
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
}

/**
 * Append one `{ pattern, kind: 'nav', label }` rule to `saropaLogCapture.flowMap.customBreadcrumbs`
 * (the empty-state suggestion button's target) and refresh the report so it applies immediately.
 * Non-fatal on a config-write failure — the report itself is not at stake, just the shortcut.
 */
async function addCustomBreadcrumbRule(p: FlowMapPanelParams, pattern: string, label: string): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const existing = cfg.get('flowMap.customBreadcrumbs');
    const entries = Array.isArray(existing) ? existing : [];
    if (hasPattern(entries, pattern)) {
        // Never a silent no-op: the button stays clickable after a refresh, so a repeat click must
        // still report an outcome rather than looking like the click was dropped.
        void vscode.window.showInformationMessage(t('flowMap.ruleExists'));
        return;
    }
    try {
        const next = [...entries, { pattern, kind: 'nav', label }];
        await cfg.update('flowMap.customBreadcrumbs', next, ruleTarget());
        void vscode.window.showInformationMessage(t('flowMap.ruleAdded'));
        p.refresh();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showWarningMessage(t('flowMap.ruleAddFailed', msg));
    }
}

/**
 * Answer a compare request: that session's captures OF THE ASKED SCREEN, as webview URLs for
 * whichever panels are open.
 *
 * The reply goes to BOTH panels rather than to the asker, because the message handler is shared and
 * does not know which webview sent it. That is safe: the reply is addressed by `logFsPath` +
 * `screenKey`, and a panel with no matching request in flight drops it.
 *
 * An empty reply is still a reply. The webview turns it into "that session has no capture of this
 * screen" — a silent non-answer would read as a broken control.
 */
async function sendCompareShots(logFsPath: unknown, screenKey: unknown): Promise<void> {
    if (typeof logFsPath !== 'string' || typeof screenKey !== 'string') { return; }
    // Only sessions this report already offered: the list bounds both the resource roots and what a
    // webview message is allowed to make the host read off disk.
    const known = currentParams?.compareSessions.find(s => s.logFsPath === logFsPath);
    if (!known) { return; }
    let shots: readonly FlowShot[] = [];
    try {
        shots = shotsForScreen(await loadSessionShots(logFsPath), screenKey);
    } catch {
        // A log that vanished or will not parse yields the empty reply, which the webview reports.
        shots = [];
    }
    for (const panel of [current, popout]) {
        if (!panel) { continue; }
        void panel.webview.postMessage({
            type: 'flowMapCompareShots', logFsPath, screenKey, label: known.label,
            shots: withWebviewSrc(panel.webview, shots),
        });
    }
}

/** Dispatch one webview message against the latest shown report. */
function handleMessage(
    msg: {
        type?: string; file?: string; line?: number; text?: string; pattern?: string; label?: string;
        logFsPath?: string; screenKey?: string;
    },
): void {
    const p = currentParams;
    if (!p) { return; }
    if (msg.type === 'saveMarkdown') {
        void saveMarkdown(p);
    } else if (msg.type === 'popOutFlow') {
        showFlowDiagramPanel(p);
    } else if (msg.type === 'refreshFlowMap') {
        p.refresh();
    } else if (msg.type === 'showFlowLog') {
        // The report's source log is the open viewer log; reveal it at the top.
        p.revealLine(1);
    } else if (msg.type === 'openFlowMapSource' && msg.file) {
        void openSource(p.parsed.header.projectRoot, msg.file, msg.line ?? 1);
    } else if (msg.type === 'revealLogLine' && msg.line) {
        p.revealLine(msg.line);
    } else if (msg.type === 'copyLogLine' && msg.line) {
        void copyLogLine(p.logUri, msg.line);
    } else if (msg.type === 'addFlowMapPattern' && msg.pattern) {
        void addCustomBreadcrumbRule(p, msg.pattern, msg.label || '$1');
    } else if (msg.type === 'compareSessionShots') {
        void sendCompareShots(msg.logFsPath, msg.screenKey);
    } else if (msg.type === 'copyShotPath' && msg.text) {
        // Its own case rather than reusing copyText: the status line has to name what was copied, and
        // "Summary copied" after clicking a screenshot's copy button is a wrong outcome report.
        void vscode.env.clipboard.writeText(msg.text);
        vscode.window.setStatusBarMessage(t('flowMap.shot.pathCopied'), 2000);
    } else if (msg.type === 'copyText' && msg.text) {
        // The Executive-Summary copy button sends the rendered prose; write it straight to clipboard.
        void vscode.env.clipboard.writeText(msg.text);
        vscode.window.setStatusBarMessage(t('flowMap.summaryCopied'), 2000);
    }
}

/** Tab title: "Saropa Flow Map — <project>" (project appended when known). */
function panelTitle(params: FlowMapPanelParams): string {
    const project = params.parsed.header.project;
    return project ? `${t('flowMap.panelTitle')} — ${project}` : t('flowMap.panelTitle');
}

/** Open (or reveal and refresh) the flow-map webview for the given report. */
export function showFlowMapPanel(params: FlowMapPanelParams): void {
    currentParams = params;
    const title = panelTitle(params);
    if (!current) {
        current = vscode.window.createWebviewPanel(
            VIEW_TYPE, title, vscode.ViewColumn.Active,
            { ...webviewOptions(params.shotRoots), retainContextWhenHidden: true },
        );
        current.onDidDispose(() => { current = undefined; currentParams = undefined; });
        current.webview.onDidReceiveMessage(handleMessage);
    }
    current.title = title;
    // Reapplied every render: an existing panel showing a different log has the old roots.
    syncResourceRoots(current.webview, params.shotRoots);
    current.webview.html = buildHtml(params, getNonce(), current.webview);
    current.reveal(vscode.ViewColumn.Active);
    // Keep an open pop-out diagram in sync after a refresh (it shares the same report).
    if (popout) {
        popout.title = title;
        syncResourceRoots(popout.webview, params.shotRoots);
        popout.webview.html = buildDiagramHtml(params, getNonce(), popout.webview);
    }
}

/** Dispose the panel(s) on extension deactivate. */
export function disposeFlowMapPanel(): void {
    current?.dispose();
    current = undefined;
    popout?.dispose();
    popout = undefined;
}
