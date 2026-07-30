import * as vscode from 'vscode';
import { t } from '../../l10n';

/** Callback fired when session visibility or pause state changes. */
export type SessionStateObserver = (active: boolean, paused: boolean) => void;

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private lineCount = 0;
    private paused = false;
    private visible = false;
    private watchCounts = new Map<string, number>();
    private sessionStateObserver?: SessionStateObserver;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            'saropaLogCapture.status',
            vscode.StatusBarAlignment.Right,
            50,
        );
        this.item.name = 'Saropa Log Capture';
        this.item.command = 'saropaLogCapture.open';
        this.hide();
    }

    /** Subscribe to session visibility/pause changes. Single observer only —
     *  upgrade to an array or EventEmitter if a second consumer is needed. */
    setSessionStateObserver(fn: SessionStateObserver): void {
        this.sessionStateObserver = fn;
    }

    show(): void {
        this.lineCount = 0;
        this.paused = false;
        this.visible = true;
        this.updateText();
        this.item.show();
        this.sessionStateObserver?.(true, false);
    }

    hide(): void {
        this.visible = false;
        this.item.hide();
        this.sessionStateObserver?.(false, false);
    }

    updateLineCount(count: number): void {
        this.lineCount = count;
        this.updateText();
    }

    setPaused(value: boolean): void {
        this.paused = value;
        this.updateText();
        /* `paused=true` only meaningful when `visible=true`; observer consumers
         * guard on the active flag so a stale setPaused after hide() is harmless. */
        this.sessionStateObserver?.(this.visible, value);
    }

    /** Update keyword watch hit counts shown in the status bar. */
    updateWatchCounts(counts: ReadonlyMap<string, number>): void {
        this.watchCounts = new Map(counts);
        this.updateText();
    }

    private formatCount(n: number): string {
        return n.toLocaleString('en-US');
    }

    private updateText(): void {
        const watchSuffix = this.buildWatchSuffix();
        const count = this.formatCount(this.lineCount);
        if (this.paused) {
            this.item.text = `$(debug-pause) ${t('statusBar.pausedLines', count)}${watchSuffix}`;
            this.item.tooltip = t('statusBar.pausedTooltip');
        } else {
            this.item.text = `$(record) ${t('statusBar.lines', count)}${watchSuffix}`;
            this.item.tooltip = t('statusBar.recordingTooltip');
        }
    }

    private buildWatchSuffix(): string {
        const parts: string[] = [];
        for (const [label, count] of this.watchCounts) {
            if (count > 0) {
                parts.push(`${label}: ${count}`);
            }
        }
        return parts.length > 0 ? ` | ${parts.join(' | ')}` : '';
    }

    dispose(): void {
        this.item.dispose();
    }
}
