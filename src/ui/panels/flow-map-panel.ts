/**
 * Native webview panel for the Session Flow Map (plan 056, S1). Renders the diagram, tables, and
 * narrative in VS Code. Every row links back to its source `file:line` (R5) AND its originating LOG
 * line — clicking reveals the line in the log viewer or copies it. A top-bar save icon writes the
 * portable .md; collapsible sections, a TOC, and stat pills round out the dashboard.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import type { FlowGraph, ParsedLog } from '../../modules/flow-map/flow-map-model';
import { buildFlowMapBody, statPillsHtml } from '../../modules/flow-map/flow-map-html';
import { flowMapStyles } from './flow-map-panel-styles';
import { flowMapScript } from './flow-map-panel-script';

const VIEW_TYPE = 'saropaFlowMap';

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
}

let current: vscode.WebviewPanel | undefined;
// Latest report shown — the message handler (wired once) reads this so reveals don't stack listeners.
let currentParams: FlowMapPanelParams | undefined;

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

/** Inline download glyph (no codicon font asset / no CSP font-src needed). */
const SAVE_SVG = '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" '
    + 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M8 1.7v7.6"/><path d="M4.7 6.3 8 9.6l3.3-3.3"/><path d="M2.7 13.3h10.6"/></svg>';

/** Full HTML document: CSP, styles, top bar (pills + save), report body, script. */
function buildHtml(params: FlowMapPanelParams, nonce: string): string {
    const body = buildFlowMapBody(params.parsed, params.graph);
    const pills = statPillsHtml(params.parsed, params.graph);
    const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    const saveLabel = esc(t('flowMap.saveMarkdownBtn'));
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
${flowMapStyles(nonce)}</head><body>
<div class="topbar"><div class="pills">${pills}</div>
<button type="button" id="save-md" class="save-icon" title="${saveLabel}" aria-label="${saveLabel}">${SAVE_SVG}</button></div>
${body}
${flowMapScript(nonce)}</body></html>`;
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

/** Dispatch one webview message against the latest shown report. */
function handleMessage(msg: { type?: string; file?: string; line?: number }): void {
    const p = currentParams;
    if (!p) { return; }
    if (msg.type === 'saveMarkdown') {
        void saveMarkdown(p);
    } else if (msg.type === 'openFlowMapSource' && msg.file) {
        void openSource(p.parsed.header.projectRoot, msg.file, msg.line ?? 1);
    } else if (msg.type === 'revealLogLine' && msg.line) {
        p.revealLine(msg.line);
    } else if (msg.type === 'copyLogLine' && msg.line) {
        void copyLogLine(p.logUri, msg.line);
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
            { enableScripts: true, localResourceRoots: [], retainContextWhenHidden: true },
        );
        current.onDidDispose(() => { current = undefined; currentParams = undefined; });
        current.webview.onDidReceiveMessage(handleMessage);
    }
    current.title = title;
    current.webview.html = buildHtml(params, getNonce());
    current.reveal(vscode.ViewColumn.Active);
}

/** Dispose the panel on extension deactivate. */
export function disposeFlowMapPanel(): void {
    current?.dispose();
    current = undefined;
}
