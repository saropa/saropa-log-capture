/**
 * Phase 3: Before collecting bug report lint data, optionally refresh Saropa Lints analysis
 * when violations export is missing or stale and the Saropa Lints extension exposes runAnalysis.
 *
 * No dependency on bug-report-collector (structural frame type only) to avoid circular imports.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { SAROPA_LINTS_EXTENSION_ID, type SaropaLintsApi } from './saropa-lints-api';
import {
    collectAppStackRelativePaths,
    getLintViolationsExportSnapshot,
    isLintExportTimestampStale,
    type LintStackPathFrame,
} from './lint-violation-reader';

/** Activate extension and return API only when runAnalysis is available. */
async function getActivatedSaropaLintsApi(): Promise<SaropaLintsApi | undefined> {
    const ext = vscode.extensions.getExtension<SaropaLintsApi>(SAROPA_LINTS_EXTENSION_ID);
    if (!ext) { return undefined; }
    try {
        await ext.activate();
    } catch {
        return undefined;
    }
    const api = ext.exports;
    if (!api || typeof api.runAnalysis !== 'function') { return undefined; }
    return api;
}

/**
 * Run stack-scoped analysis: prefer runAnalysisForFiles, else runAnalysis({ files }), else full run.
 */
async function runStackScopedAnalysis(api: SaropaLintsApi, paths: string[]): Promise<boolean> {
    if (paths.length === 0) { return api.runAnalysis(); }
    if (typeof api.runAnalysisForFiles === 'function') {
        return api.runAnalysisForFiles(paths);
    }
    return api.runAnalysis({ files: paths });
}

/**
 * If Saropa Lints export is missing or stale and the extension can run analysis, offer refresh.
 * After this returns, callers should re-collect lint data (e.g. findLintMatches).
 */
export async function offerSaropaLintRefreshIfNeeded(
    wsRoot: vscode.Uri,
    frames: readonly LintStackPathFrame[],
): Promise<void> {
    const api = await getActivatedSaropaLintsApi();
    if (!api) { return; }

    const snapshot = await getLintViolationsExportSnapshot(wsRoot);
    const missing = snapshot === undefined;
    const stale = snapshot !== undefined && isLintExportTimestampStale(snapshot.timestamp);
    if (!missing && !stale) { return; }

    const continueLabel = t('msg.lintRefreshContinue');
    const fullLabel = t('msg.lintRefreshRunFull');
    const stackLabel = t('msg.lintRefreshRunStack');
    const stackPaths = collectAppStackRelativePaths(frames);
    const actions = stackPaths.length > 0
        ? [continueLabel, fullLabel, stackLabel]
        : [continueLabel, fullLabel];

    const choice = await vscode.window.showInformationMessage(
        t('msg.lintRefreshPrompt'),
        { modal: false },
        ...actions,
    );
    if (!choice || choice === continueLabel) { return; }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: t('msg.lintRefreshProgressTitle'),
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: t('msg.lintRefreshProgressDetail') });
            try {
                if (choice === stackLabel) {
                    await runStackScopedAnalysis(api, stackPaths);
                } else {
                    await api.runAnalysis();
                }
                vscode.window.setStatusBarMessage(t('msg.lintRefreshDone'), 4000);
            } catch {
                vscode.window.showErrorMessage(t('msg.lintRefreshFailed'));
            }
        },
    );
}
