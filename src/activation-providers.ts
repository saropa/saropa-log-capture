/**
 * Activation Providers
 *
 * Setup functions for webview providers: LogViewer, Vitals, CodeLens.
 */

import * as vscode from 'vscode';
import { LogViewerProvider } from './ui/provider/log-viewer-provider';
import { VitalsPanelProvider } from './ui/panels/vitals-panel';
import { CrashlyticsWatcher } from './modules/crashlytics/crashlytics-watcher';
import { CrashlyticsCodeLensProvider } from './ui/shared/crashlytics-codelens';
import { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';

export interface WebviewProviders {
    viewerProvider: LogViewerProvider;
    vitalsPanel: VitalsPanelProvider;
    crashCodeLens: CrashlyticsCodeLensProvider;
    inlineDecorations: InlineDecorationsProvider;
}

/**
 * Setup webview providers and register them with VS Code.
 */
export function setupWebviewProviders(
    context: vscode.ExtensionContext,
    version: string,
): WebviewProviders {
    const inlineDecorations = new InlineDecorationsProvider();
    context.subscriptions.push(inlineDecorations);

    const viewerProvider = new LogViewerProvider(context.extensionUri, version, context);
    context.subscriptions.push(
        viewerProvider,
        vscode.window.registerWebviewViewProvider('saropaCapture.logViewer', viewerProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );

    const vitalsPanel = new VitalsPanelProvider();
    context.subscriptions.push(
        vitalsPanel,
        vscode.window.registerWebviewViewProvider(VitalsPanelProvider.viewType, vitalsPanel),
        vscode.commands.registerCommand('saropaCapture.refreshVitals', () => vitalsPanel.refresh()),
    );

    const crashCodeLens = new CrashlyticsCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, crashCodeLens));

    // Background new-issue / regression watcher (off unless saropaCapture.firebase.notifyNewIssues).
    const crashWatcher = new CrashlyticsWatcher(context);
    context.subscriptions.push(crashWatcher);
    crashWatcher.start();

    return { viewerProvider, vitalsPanel, crashCodeLens, inlineDecorations };
}

/**
 * Register webview panel serializers that don't restore state.
 */
export function registerNoRestoreSerializers(context: vscode.ExtensionContext): void {
    const noRestore: vscode.WebviewPanelSerializer = {
        deserializeWebviewPanel(p) { p.dispose(); return Promise.resolve(); },
    };
    for (const viewType of [
        'saropaCapture.signals', 'saropaCapture.signalTab', 'saropaCapture.bugReport',
        'saropaCapture.analysis', 'saropaCapture.timeline',
        'saropaCapture.comparison', 'saropaCapture.collection',
        'saropaCapture.popOutViewer',
    ]) {
        context.subscriptions.push(
            vscode.window.registerWebviewPanelSerializer(viewType, noRestore),
        );
    }
}
