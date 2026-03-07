import * as vscode from 'vscode';
import { t } from '../../l10n';

/** Human-readable labels for integration adapter ids (localized). */
function getIntegrationLabels(): Record<string, string> {
    return {
        packages: t('integration.packages'),
        buildCi: t('integration.buildCi'),
        windowsEvents: t('integration.windowsEvents'),
        git: t('integration.git'),
        database: t('integration.database'),
        externalLogs: t('integration.externalLogs'),
        performance: t('integration.performance'),
        http: t('integration.http'),
        terminal: t('integration.terminal'),
        browser: t('integration.browser'),
        docker: t('integration.docker'),
        linuxLogs: t('integration.linuxLogs'),
        crashDumps: t('integration.crashDumps'),
        testResults: t('integration.testResults'),
        security: t('integration.security'),
        coverage: t('integration.coverage'),
        environment: t('integration.environment'),
        crashlytics: t('integration.crashlytics'),
    };
}

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
        const labelsMap = getIntegrationLabels();
        const integrationSuffix = this.buildIntegrationSuffix(labelsMap);
        const count = this.formatCount(this.lineCount);
        const recordingTip = integrationSuffix
            ? t('statusBar.recordingTooltipWithIntegrations',
                this.integrationAdapterIds.map(id => labelsMap[id] ?? id).join(', '))
            : t('statusBar.recordingTooltip');
        if (this.paused) {
            this.pauseItem.text = '$(debug-pause)';
            this.pauseItem.tooltip = t('statusBar.resumeTooltip');
            this.item.text = t('statusBar.pausedLines', count) + watchSuffix + integrationSuffix;
            this.item.tooltip = t('statusBar.pausedTooltip');
        } else {
            this.pauseItem.text = '$(record)';
            this.pauseItem.tooltip = t('statusBar.pauseTooltip');
            this.item.text = t('statusBar.lines', count) + watchSuffix + integrationSuffix;
            this.item.tooltip = recordingTip;
        }
    }

    /** Build integration suffix using pre-resolved labels to avoid duplicate l10n lookups. */
    private buildIntegrationSuffix(labelsMap: Record<string, string>): string {
        if (this.integrationAdapterIds.length === 0) { return ''; }
        const labels = this.integrationAdapterIds.map(id => labelsMap[id] ?? id);
        return labels.length === 1
            ? t('statusBar.singleAdapterSuffix', labels[0])
            : t('statusBar.adaptersSuffix', String(labels.length));
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
