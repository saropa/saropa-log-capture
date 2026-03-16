import * as vscode from 'vscode';
import { t } from '../../l10n';

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private lineCount = 0;
    private paused = false;
    private watchCounts = new Map<string, number>();

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

    show(): void {
        this.lineCount = 0;
        this.paused = false;
        this.updateText();
        this.item.show();
    }

    hide(): void {
        this.item.hide();
    }

    updateLineCount(count: number): void {
        this.lineCount = count;
        this.updateText();
    }

    setPaused(value: boolean): void {
        this.paused = value;
        this.updateText();
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
