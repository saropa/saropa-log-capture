/**
 * Activation Providers
 *
 * Setup functions for webview providers: LogViewer, Vitals, CodeLens.
 */

import * as vscode from 'vscode';
import { LogViewerProvider } from './ui/provider/log-viewer-provider';
import { VitalsPanelProvider } from './ui/panels/vitals-panel';
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
    context.subscriptions.push(viewerProvider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );

    const vitalsPanel = new VitalsPanelProvider();
    context.subscriptions.push(vitalsPanel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VitalsPanelProvider.viewType, vitalsPanel),
    );
    context.subscriptions.push(vscode.commands.registerCommand(
        'saropaLogCapture.refreshVitals', () => vitalsPanel.refresh(),
    ));

    const crashCodeLens = new CrashlyticsCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, crashCodeLens));

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
        'saropaLogCapture.insights', 'saropaLogCapture.bugReport',
        'saropaLogCapture.analysis', 'saropaLogCapture.timeline',
        'saropaLogCapture.comparison', 'saropaLogCapture.investigation',
    ]) {
        context.subscriptions.push(
            vscode.window.registerWebviewPanelSerializer(viewType, noRestore),
        );
    }
}
