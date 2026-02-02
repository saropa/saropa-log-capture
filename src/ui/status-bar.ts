import * as vscode from 'vscode';

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private readonly pauseItem: vscode.StatusBarItem;
    private lineCount = 0;
    private paused = false;
    private watchCounts = new Map<string, number>();

    constructor() {
        this.pauseItem = vscode.window.createStatusBarItem(
            'saropaLogCapture.pauseControl',
            vscode.StatusBarAlignment.Right,
            51,
        );
        this.pauseItem.name = 'Saropa Log Capture: Pause';
        this.pauseItem.command = 'saropaLogCapture.pause';

        this.item = vscode.window.createStatusBarItem(
            'saropaLogCapture.status',
            vscode.StatusBarAlignment.Right,
            50,
        );
        this.item.name = 'Saropa Log Capture';
        this.item.command = 'saropaLogCapture.logViewer.focus';
        this.hide();
    }

    show(): void {
        this.lineCount = 0;
        this.paused = false;
        this.updateText();
        this.pauseItem.show();
        this.item.show();
    }

    hide(): void {
        this.pauseItem.hide();
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

    private updateText(): void {
        const watchSuffix = this.buildWatchSuffix();
        if (this.paused) {
            this.pauseItem.text = '$(debug-pause)';
            this.pauseItem.tooltip = 'Saropa Log Capture: Click to resume.';
            this.item.text = `Paused (${this.lineCount} lines)${watchSuffix}`;
            this.item.tooltip = 'Saropa Log Capture: Paused. Click to show viewer.';
        } else {
            this.pauseItem.text = '$(record)';
            this.pauseItem.tooltip = 'Saropa Log Capture: Click to pause.';
            this.item.text = `${this.lineCount} lines${watchSuffix}`;
            this.item.tooltip = 'Saropa Log Capture: Recording. Click to show viewer.';
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
        this.pauseItem.dispose();
        this.item.dispose();
    }
}
