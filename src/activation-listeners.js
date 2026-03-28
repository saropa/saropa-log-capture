"use strict";
/**
 * Activation Listeners
 *
 * Setup functions for event listeners: line/split listeners,
 * config change handlers, scope context updates.
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
exports.setupLineListeners = setupLineListeners;
exports.setupConfigListener = setupConfigListener;
exports.setupScopeContextListener = setupScopeContextListener;
const vscode = __importStar(require("vscode"));
const config_1 = require("./modules/config/config");
const source_linker_1 = require("./modules/source/source-linker");
const scope_context_1 = require("./modules/storage/scope-context");
const learning_webview_options_1 = require("./modules/learning/learning-webview-options");
const integration_adapter_constants_1 = require("./modules/integrations/integration-adapter-constants");
/**
 * Setup line and split listeners for DAP output routing.
 */
function setupLineListeners(deps) {
    const { sessionManager, broadcaster, historyProvider, inlineDecorations } = deps;
    sessionManager.addLineListener((data) => {
        broadcaster.addLine(data);
        historyProvider.setActiveLineCount(data.lineCount);
        if (data.watchHits && data.watchHits.length > 0) {
            broadcaster.updateWatchCounts(sessionManager.getWatcher().getCounts());
        }
        if (!data.isMarker) {
            const sourceRef = (0, source_linker_1.extractSourceReference)(data.text);
            if (sourceRef) {
                inlineDecorations.recordLogLine(sourceRef.filePath, sourceRef.line, data.text, data.category);
            }
        }
    });
    sessionManager.addSplitListener((_newUri, partNumber, totalParts) => {
        broadcaster.setSplitInfo(partNumber, totalParts);
        const filename = sessionManager.getActiveFilename();
        if (filename) {
            broadcaster.setFilename(filename);
        }
        historyProvider.refresh();
    });
}
/**
 * Setup configuration change listener.
 */
function setupConfigListener(context, sessionManager, broadcaster) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('saropaLogCapture')) {
            return;
        }
        const cfg = (0, config_1.getConfig)();
        sessionManager.refreshConfig(cfg);
        if (e.affectsConfiguration('saropaLogCapture.iconBarPosition')) {
            broadcaster.setIconBarPosition(cfg.iconBarPosition);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowInfoMarkers')) {
            broadcaster.setMinimapShowInfo(cfg.minimapShowInfoMarkers);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowSqlDensity')) {
            broadcaster.setMinimapShowSqlDensity(cfg.minimapShowSqlDensity);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapProportionalLines')) {
            broadcaster.setMinimapProportionalLines(cfg.minimapProportionalLines);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapViewportRedOutline')) {
            broadcaster.setMinimapViewportRedOutline(cfg.minimapViewportRedOutline);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapViewportOutsideArrow')) {
            broadcaster.setMinimapViewportOutsideArrow(cfg.minimapViewportOutsideArrow);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapWidth')) {
            broadcaster.setMinimapWidth(cfg.minimapWidth);
        }
        if (e.affectsConfiguration('saropaLogCapture.showScrollbar')) {
            broadcaster.setScrollbarVisible(cfg.showScrollbar);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerAlwaysShowSearchMatchOptions')) {
            broadcaster.setSearchMatchOptionsAlwaysVisible(cfg.viewerAlwaysShowSearchMatchOptions);
        }
        if (e.affectsConfiguration('saropaLogCapture.learning')) {
            broadcaster.postToWebview((0, learning_webview_options_1.getLearningWebviewOptions)());
        }
        if (e.affectsConfiguration('saropaLogCapture.autoHidePatterns')) {
            broadcaster.setAutoHidePatterns(cfg.autoHidePatterns);
        }
        if (e.affectsConfiguration('saropaLogCapture.repeatCollapseGlobalMinCount')
            || e.affectsConfiguration('saropaLogCapture.repeatCollapseReadMinCount')
            || e.affectsConfiguration('saropaLogCapture.repeatCollapseTransactionMinCount')
            || e.affectsConfiguration('saropaLogCapture.repeatCollapseDmlMinCount')) {
            broadcaster.setViewerRepeatThresholds(cfg.viewerRepeatThresholds);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerDbInsightsEnabled')) {
            broadcaster.setViewerDbInsightsEnabled(cfg.viewerDbInsightsEnabled);
        }
        if (e.affectsConfiguration('saropaLogCapture.staticSqlFromFingerprint.enabled')) {
            broadcaster.setStaticSqlFromFingerprintEnabled(cfg.staticSqlFromFingerprintEnabled);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerDbDetectorNPlusOneEnabled')
            || e.affectsConfiguration('saropaLogCapture.viewerDbDetectorSlowBurstEnabled')
            || e.affectsConfiguration('saropaLogCapture.viewerDbDetectorBaselineHintsEnabled')) {
            broadcaster.setViewerDbDetectorToggles({
                nPlusOneEnabled: cfg.viewerDbDetectorNPlusOneEnabled,
                slowBurstEnabled: cfg.viewerDbDetectorSlowBurstEnabled,
                baselineHintsEnabled: cfg.viewerDbDetectorBaselineHintsEnabled,
            });
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerSlowBurstSlowQueryMs')
            || e.affectsConfiguration('saropaLogCapture.viewerSlowBurstMinCount')
            || e.affectsConfiguration('saropaLogCapture.viewerSlowBurstWindowMs')
            || e.affectsConfiguration('saropaLogCapture.viewerSlowBurstCooldownMs')) {
            broadcaster.setViewerSlowBurstThresholds(cfg.viewerSlowBurstThresholds);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerSqlPatternChipMinCount')
            || e.affectsConfiguration('saropaLogCapture.viewerSqlPatternMaxChips')) {
            broadcaster.setViewerSqlPatternChipSettings(cfg.viewerSqlPatternChipMinCount, cfg.viewerSqlPatternMaxChips);
        }
        if (e.affectsConfiguration('saropaLogCapture.errorRateBucketSize')
            || e.affectsConfiguration('saropaLogCapture.errorRateShowWarnings')
            || e.affectsConfiguration('saropaLogCapture.errorRateDetectSpikes')) {
            broadcaster.setErrorRateConfig((0, config_1.errorRateConfigFromConfig)(cfg));
        }
        if (e.affectsConfiguration('saropaLogCapture.integrations.adapters')
            || e.affectsConfiguration('saropaLogCapture.ai.enabled')) {
            syncIntegrationsAdaptersToWebview(broadcaster);
        }
        if (e.affectsConfiguration('saropaLogCapture.integrations.adapters')) {
            showSecurityAdapterNotice(context, cfg).catch(() => { });
        }
        if (e.affectsConfiguration('saropaLogCapture.suppressTransientErrors')
            || e.affectsConfiguration('saropaLogCapture.breakOnCritical')
            || e.affectsConfiguration('saropaLogCapture.levelDetection')
            || e.affectsConfiguration('saropaLogCapture.deemphasizeFrameworkLevels')
            || e.affectsConfiguration('saropaLogCapture.stderrTreatAsError')) {
            broadcaster.setErrorClassificationSettings(cfg.suppressTransientErrors, cfg.breakOnCritical, cfg.levelDetection, cfg.deemphasizeFrameworkLevels, cfg.stderrTreatAsError);
        }
    }));
}
const securityNoticeKey = 'securityAdapterNoticeShown';
/** Push session + Explain-with-AI checkbox state to the log viewer after settings change. */
function syncIntegrationsAdaptersToWebview(broadcaster) {
    const cfg = (0, config_1.getConfig)();
    const merged = (0, integration_adapter_constants_1.mergeIntegrationAdaptersForWebview)(cfg.integrationsAdapters, vscode.workspace.getConfiguration('saropaLogCapture.ai').get('enabled', false));
    broadcaster.postToWebview({ type: 'integrationsAdapters', adapterIds: merged });
}
/** Show a one-time info message when the security adapter is first enabled. */
async function showSecurityAdapterNotice(context, cfg) {
    if (!cfg.integrationsAdapters.includes('security')) {
        return;
    }
    if (context.workspaceState.get(securityNoticeKey)) {
        return;
    }
    await context.workspaceState.update(securityNoticeKey, true);
    const openSettings = 'Open Settings';
    const choice = await vscode.window.showInformationMessage('Security adapter enabled. Events may contain sensitive data — redaction is on by default. Configure paths in Settings.', openSettings);
    if (choice === openSettings) {
        vscode.commands.executeCommand('workbench.action.openSettings', 'saropaLogCapture.integrations.security').then(undefined, () => { });
    }
}
/**
 * Setup scope context listener for source-scope filter.
 */
function setupScopeContextListener(context, broadcaster) {
    const updateScopeContext = async () => {
        const ctx = await (0, scope_context_1.buildScopeContext)(vscode.window.activeTextEditor);
        broadcaster.setScopeContext(ctx);
    };
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => { updateScopeContext().catch(() => { }); }));
    updateScopeContext().catch(() => { });
}
//# sourceMappingURL=activation-listeners.js.map