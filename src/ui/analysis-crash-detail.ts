/** Render Crashlytics crash event detail — frame classification and HTML output. */

import * as vscode from 'vscode';
import { escapeHtml } from '../modules/ansi';
import { isFrameworkFrame } from '../modules/stack-parser';
import { extractSourceReference } from '../modules/source-linker';
import { type StackFrameInfo, renderFrameSection } from './analysis-frame-render';
import type { CrashlyticsEventDetail, CrashlyticsStackFrame } from '../modules/firebase-crashlytics';

/** Classify Crashlytics stack frames as app or framework using workspace context. */
function classifyFrames(frames: readonly CrashlyticsStackFrame[]): StackFrameInfo[] {
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return frames.map(f => ({
        text: f.text,
        isApp: !isFrameworkFrame(f.text, wsPath),
        sourceRef: extractSourceReference(f.text),
    }));
}

/** Render crash event detail with classified stack frames. */
export function renderCrashDetail(detail: CrashlyticsEventDetail): string {
    if (!detail.crashThread && detail.appThreads.length === 0) {
        return '<div class="no-matches">No stack trace available</div>';
    }
    let html = '';
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
    return html;
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
