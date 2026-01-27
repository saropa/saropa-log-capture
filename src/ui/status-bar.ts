import * as vscode from 'vscode';

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private lineCount = 0;
    private paused = false;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            'saropaLogCapture.status',
            vscode.StatusBarAlignment.Right,
            50
        );
        this.item.name = 'Saropa Log Capture';
        this.item.command = 'saropaLogCapture.pause';
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

    private updateText(): void {
        if (this.paused) {
            this.item.text = `$(debug-pause) Paused (${this.lineCount} lines)`;
            this.item.tooltip = 'Saropa Log Capture: Paused. Click to resume.';
        } else {
            this.item.text = `$(debug) ${this.lineCount} lines`;
            this.item.tooltip = 'Saropa Log Capture: Recording. Click to pause.';
        }
    }

    dispose(): void {
        this.item.dispose();
    }
}
