"use strict";
/**
 * Phase 3: Before collecting bug report lint data, optionally refresh Saropa Lints analysis
 * when violations export is missing or stale and the Saropa Lints extension exposes runAnalysis.
 *
 * No dependency on bug-report-collector (structural frame type only) to avoid circular imports.
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
exports.offerSaropaLintRefreshIfNeeded = offerSaropaLintRefreshIfNeeded;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const saropa_lints_api_1 = require("./saropa-lints-api");
const lint_violation_reader_1 = require("./lint-violation-reader");
/** Activate extension and return API only when runAnalysis is available. */
async function getActivatedSaropaLintsApi() {
    const ext = vscode.extensions.getExtension(saropa_lints_api_1.SAROPA_LINTS_EXTENSION_ID);
    if (!ext) {
        return undefined;
    }
    try {
        await ext.activate();
    }
    catch {
        return undefined;
    }
    const api = ext.exports;
    if (!api || typeof api.runAnalysis !== 'function') {
        return undefined;
    }
    return api;
}
/**
 * Run stack-scoped analysis: prefer runAnalysisForFiles, else runAnalysis({ files }), else full run.
 */
async function runStackScopedAnalysis(api, paths) {
    if (paths.length === 0) {
        return api.runAnalysis();
    }
    if (typeof api.runAnalysisForFiles === 'function') {
        return api.runAnalysisForFiles(paths);
    }
    return api.runAnalysis({ files: paths });
}
/**
 * If Saropa Lints export is missing or stale and the extension can run analysis, offer refresh.
 * After this returns, callers should re-collect lint data (e.g. findLintMatches).
 */
async function offerSaropaLintRefreshIfNeeded(wsRoot, frames) {
    const api = await getActivatedSaropaLintsApi();
    if (!api) {
        return;
    }
    const snapshot = await (0, lint_violation_reader_1.getLintViolationsExportSnapshot)(wsRoot);
    const missing = snapshot === undefined;
    const stale = snapshot !== undefined && (0, lint_violation_reader_1.isLintExportTimestampStale)(snapshot.timestamp);
    if (!missing && !stale) {
        return;
    }
    const continueLabel = (0, l10n_1.t)('msg.lintRefreshContinue');
    const fullLabel = (0, l10n_1.t)('msg.lintRefreshRunFull');
    const stackLabel = (0, l10n_1.t)('msg.lintRefreshRunStack');
    const stackPaths = (0, lint_violation_reader_1.collectAppStackRelativePaths)(frames);
    const actions = stackPaths.length > 0
        ? [continueLabel, fullLabel, stackLabel]
        : [continueLabel, fullLabel];
    const choice = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.lintRefreshPrompt'), { modal: false }, ...actions);
    if (!choice || choice === continueLabel) {
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: (0, l10n_1.t)('msg.lintRefreshProgressTitle'),
        cancellable: false,
    }, async (progress) => {
        progress.report({ message: (0, l10n_1.t)('msg.lintRefreshProgressDetail') });
        try {
            if (choice === stackLabel) {
                await runStackScopedAnalysis(api, stackPaths);
            }
            else {
                await api.runAnalysis();
            }
            vscode.window.setStatusBarMessage((0, l10n_1.t)('msg.lintRefreshDone'), 4000);
        }
        catch {
            vscode.window.showErrorMessage((0, l10n_1.t)('msg.lintRefreshFailed'));
        }
    });
}
//# sourceMappingURL=saropa-lints-refresh-prompt.js.map