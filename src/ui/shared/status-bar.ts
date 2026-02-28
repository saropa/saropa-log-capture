import * as vscode from 'vscode';

/** Human-readable labels for integration adapter ids. */
const INTEGRATION_LABELS: Record<string, string> = {
    packages: 'Packages',
    buildCi: 'Build',
    windowsEvents: 'Windows events',
    git: 'Git',
    database: 'Database',
    externalLogs: 'External logs',
    performance: 'Performance',
    http: 'HTTP',
    terminal: 'Terminal',
    browser: 'Browser',
    docker: 'Docker',
    linuxLogs: 'Linux logs',
    crashDumps: 'Crash dumps',
    testResults: 'Tests',
    security: 'Security',
    coverage: 'Coverage',
    environment: 'Environment',
};

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private readonly pauseItem: vscode.StatusBarItem;
    private lineCount = 0;
    private paused = false;
    private watchCounts = new Map<string, number>();
    private integrationAdapterIds: string[] = [];

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
        this.item.command = 'saropaLogCapture.open';
        this.hide();
    }

    show(): void {
        this.lineCount = 0;
        this.paused = false;
        this.integrationAdapterIds = [];
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

    /** Show which integration adapters contributed (e.g. Packages). Clear with []. */
    updateIntegrationAdapters(adapterIds: string[]): void {
        this.integrationAdapterIds = adapterIds;
        this.updateText();
    }

    private formatCount(n: number): string {
        return n.toLocaleString('en-US');
    }

    private updateText(): void {
        const watchSuffix = this.buildWatchSuffix();
        const integrationSuffix = this.buildIntegrationSuffix();
        const count = this.formatCount(this.lineCount);
        const baseTooltip = 'Saropa Log Capture';
        const recordingTip = integrationSuffix
            ? `${baseTooltip}: Recording. Integrations: ${this.integrationAdapterIds.map(id => INTEGRATION_LABELS[id] ?? id).join(', ')}. Click to open log file.`
            : `${baseTooltip}: Recording. Click to open log file.`;
        if (this.paused) {
            this.pauseItem.text = '$(debug-pause)';
            this.pauseItem.tooltip = 'Saropa Log Capture: Click to resume.';
            this.item.text = `Paused (${count} lines)${watchSuffix}${integrationSuffix}`;
            this.item.tooltip = 'Saropa Log Capture: Paused. Click to open log file.';
        } else {
            this.pauseItem.text = '$(record)';
            this.pauseItem.tooltip = 'Saropa Log Capture: Click to pause.';
            this.item.text = `${count} lines${watchSuffix}${integrationSuffix}`;
            this.item.tooltip = recordingTip;
        }
    }

    private buildIntegrationSuffix(): string {
        if (this.integrationAdapterIds.length === 0) { return ''; }
        const labels = this.integrationAdapterIds.map(id => INTEGRATION_LABELS[id] ?? id);
        return labels.length === 1 ? ` | $(package) ${labels[0]}` : ` | $(check-all) ${labels.length} adapters`;
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
