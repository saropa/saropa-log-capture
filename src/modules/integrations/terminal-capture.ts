/**
 * Captures Integrated Terminal output during a session. Buffer is read by the
 * terminal provider at session end. Uses VS Code terminal API when available.
 */

import * as vscode from 'vscode';

const lines: string[] = [];
let maxLinesCap = 50_000;
let disposables: vscode.Disposable[] = [];
let prefixTimestamp = true;
let activeTerminalId: string | undefined;

function append(data: string, terminalName: string): void {
    const t = prefixTimestamp ? `[${new Date().toISOString().slice(11, 23)}] ` : '';
    const prefixed = data.split(/\r?\n/).map((line) => (line ? t + `[${terminalName}] ${line}` : ''));
    for (const line of prefixed) {
        if (line) {
            lines.push(line);
            if (lines.length > maxLinesCap) {lines.shift();}
        }
    }
}

/** Start capturing terminal output. Call when session starts. */
export function startTerminalCapture(options: {
    whichTerminals: 'all' | 'active' | 'linked';
    maxLines: number;
    prefixTimestamp: boolean;
    linkedTerminalIds?: Set<string>;
}): void {
    stopTerminalCapture();
    lines.length = 0;
    maxLinesCap = Math.max(1000, Math.min(500000, options.maxLines));
    prefixTimestamp = options.prefixTimestamp;
    activeTerminalId = undefined;
    if (options.whichTerminals === 'active' && vscode.window.activeTerminal) {
        const t = vscode.window.activeTerminal as unknown as { _id?: string; name?: string };
        activeTerminalId = t._id ?? t.name ?? 'active';
    }

    const win = vscode.window as unknown as { onDidWriteTerminalData?: (e: { terminal: vscode.Terminal; data: string }) => vscode.Disposable };
    if (typeof win.onDidWriteTerminalData !== 'function') {
        return;
    }
    const which = options.whichTerminals;
    const linked = options.linkedTerminalIds ?? new Set<string>();

    const sub = (win.onDidWriteTerminalData as unknown as (cb: (e: { terminal: vscode.Terminal; data: string }) => void) => vscode.Disposable)((e) => {
        const term = e.terminal as vscode.Terminal & { _id?: string; name?: string };
        const id = term._id ?? term.name ?? 'terminal';
        const name = term.name ?? id;
        if (which === 'linked' && !linked.has(String(id))) {return;}
        if (which === 'active' && activeTerminalId !== undefined && String(id) !== activeTerminalId) {return;}
        append(e.data, name);
    });
    if (sub && typeof (sub as vscode.Disposable).dispose === 'function') {
        disposables.push(sub as vscode.Disposable);
    }
}

/** Stop capturing and clear disposables. */
export function stopTerminalCapture(): void {
    for (const d of disposables) {
        try { d.dispose(); } catch { /* ignore */ }
    }
    disposables = [];
}

/** Get buffered lines (consumed by terminal provider at session end). */
export function getTerminalCaptureBuffer(): string[] {
    return [...lines];
}
