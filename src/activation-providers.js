"use strict";
/**
 * Activation Providers
 *
 * Setup functions for webview providers: LogViewer, Vitals, CodeLens.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebviewProviders = setupWebviewProviders;
exports.registerNoRestoreSerializers = registerNoRestoreSerializers;
const vscode = __importStar(require("vscode"));
const log_viewer_provider_1 = require("./ui/provider/log-viewer-provider");
const vitals_panel_1 = require("./ui/panels/vitals-panel");
const crashlytics_codelens_1 = require("./ui/shared/crashlytics-codelens");
const inline_decorations_1 = require("./ui/viewer-decorations/inline-decorations");
/**
 * Setup webview providers and register them with VS Code.
 */
function setupWebviewProviders(context, version) {
    const inlineDecorations = new inline_decorations_1.InlineDecorationsProvider();
    context.subscriptions.push(inlineDecorations);
    const viewerProvider = new log_viewer_provider_1.LogViewerProvider(context.extensionUri, version, context);
    context.subscriptions.push(viewerProvider, vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    const vitalsPanel = new vitals_panel_1.VitalsPanelProvider();
    context.subscriptions.push(vitalsPanel, vscode.window.registerWebviewViewProvider(vitals_panel_1.VitalsPanelProvider.viewType, vitalsPanel), vscode.commands.registerCommand('saropaLogCapture.refreshVitals', () => vitalsPanel.refresh()));
    const crashCodeLens = new crashlytics_codelens_1.CrashlyticsCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, crashCodeLens));
    return { viewerProvider, vitalsPanel, crashCodeLens, inlineDecorations };
}
/**
 * Register webview panel serializers that don't restore state.
 */
function registerNoRestoreSerializers(context) {
    const noRestore = {
        deserializeWebviewPanel(p) { p.dispose(); return Promise.resolve(); },
    };
    for (const viewType of [
        'saropaLogCapture.insights', 'saropaLogCapture.insightTab', 'saropaLogCapture.bugReport',
        'saropaLogCapture.analysis', 'saropaLogCapture.timeline',
        'saropaLogCapture.comparison', 'saropaLogCapture.investigation',
        'saropaLogCapture.popOutViewer',
    ]) {
        context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(viewType, noRestore));
    }
}
//# sourceMappingURL=activation-providers.js.map