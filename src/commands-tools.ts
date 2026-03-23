/** Tool commands: index rebuild, pop-out, search, presets, templates, integrations, reset settings. */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { CommandDeps } from './commands-deps';
import { showSearchQuickPick } from './modules/search/log-search-ui';
import { openLogAtLine } from './modules/search/log-search';
import { copyDeepLinkToClipboard } from './modules/features/deep-links';
import { loadPresets, promptSavePreset, pickPreset } from './modules/storage/filter-presets';
import { applyTemplate } from './modules/session/session-templates';
import { pickTemplate, promptSaveTemplate } from './modules/misc/session-templates-ui';
import { showIntegrationsPicker } from './modules/integrations/integrations-ui';
import { getGlobalProjectIndexer } from './modules/project-indexer/project-indexer';
import { logExtensionWarn } from './modules/misc/extension-logger';

const extensionId = 'saropa.saropa-log-capture';
const settingsSection = 'saropaLogCapture';

export function toolCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, inlineDecorations, popOutPanel, sessionManager, broadcaster } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.explainRootCauseHypotheses', () => {
            broadcaster.postToWebview({ type: 'triggerExplainRootCauseHypotheses' });
        }),
        vscode.commands.registerCommand('saropaLogCapture.rebuildProjectIndex', async () => {
            const indexer = getGlobalProjectIndexer();
            if (!indexer) {
                logExtensionWarn('rebuildProjectIndex', 'Project index not available (no workspace folder)');
                vscode.window.showWarningMessage('Project index is not available (no workspace folder).');
                return;
            }
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Rebuilding project index', cancellable: true },
                async (_progress, _token) => {
                    const getActiveLogUri = () => sessionManager.getActiveSession()?.fileUri;
                    await indexer.build(getActiveLogUri);
                },
            );
            vscode.window.showInformationMessage('Project index rebuilt.');
        }),
        vscode.commands.registerCommand('saropaLogCapture.debugProjectIndexRanking', async () => {
            const indexer = getGlobalProjectIndexer();
            if (!indexer) {
                vscode.window.showWarningMessage('Project index is not available (no workspace folder).');
                return;
            }
            const raw = await vscode.window.showInputBox({
                placeHolder: 'Enter tokens (space/comma separated), e.g. firebase projectId permission',
                prompt: 'Show ranked project-index doc matches for tokens',
                ignoreFocusOut: true,
            });
            if (!raw) { return; }
            const tokens = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
            if (tokens.length === 0) {
                vscode.window.showInformationMessage('No tokens provided.');
                return;
            }
            await indexer.getOrRebuild(60_000);
            const ranked = indexer.queryDocEntriesByTokensWithDebug(tokens).slice(0, 20);
            if (ranked.length === 0) {
                vscode.window.showInformationMessage(`No project-index docs matched: ${tokens.join(', ')}`);
                return;
            }
            const items = ranked.map((r) => ({
                label: `${r.score}  ${r.doc.relativePath}`,
                description: `${r.doc.tokens.length} tokens`,
                doc: r.doc,
                row: r,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                title: `Project index ranking (${tokens.join(', ')})`,
                placeHolder: 'Pick an entry to open',
                matchOnDescription: true,
            });
            if (!picked) { return; }
            const action = await vscode.window.showQuickPick(
                [
                    { label: 'Open file', value: 'open' },
                    { label: 'Copy score breakdown', value: 'copy' },
                    { label: 'Copy top 100 as JSON', value: 'copyJson' },
                ],
                { title: 'Debug ranking action' },
            );
            if (!action) { return; }
            if (action.value === 'copy') {
                const lines = ranked.map((r) => {
                    const detail = r.contributions
                        .map((c) => `${c.points}:${c.kind}:${c.token}`)
                        .join(', ');
                    return `${r.score}\t${r.doc.relativePath}\t${detail}`;
                });
                const payload = [
                    `tokens\t${tokens.join(',')}`,
                    'score\tpath\tcontributions(points:kind:token)',
                    ...lines,
                ].join('\n');
                await vscode.env.clipboard.writeText(payload);
                vscode.window.showInformationMessage('Copied project index score breakdown to clipboard.');
                return;
            }
            if (action.value === 'copyJson') {
                const top = indexer.queryDocEntriesByTokensWithDebug(tokens).slice(0, 100);
                const payload = JSON.stringify({
                    version: 1,
                    tokens,
                    generatedAt: new Date().toISOString(),
                    results: top.map((r) => ({
                        score: r.score,
                        path: r.doc.relativePath,
                        uri: r.doc.uri,
                        tokenCount: r.doc.tokens.length,
                        contributions: r.contributions,
                    })),
                }, null, 2);
                await vscode.env.clipboard.writeText(payload);
                vscode.window.showInformationMessage('Copied top 100 project index results as JSON.');
                return;
            }
            await vscode.window.showTextDocument(vscode.Uri.parse(picked.doc.uri), { preview: true });
        }),
        vscode.commands.registerCommand('saropaLogCapture.popOutViewer', async () => { await popOutPanel.open(); }),
        vscode.commands.registerCommand('saropaLogCapture.searchLogs', async () => {
            const match = await showSearchQuickPick();
            if (match) { await openLogAtLine(match); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyDeepLink',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (item?.filename) { await copyDeepLinkToClipboard(item.filename); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyFilePath', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            await vscode.env.clipboard.writeText(item.uri.fsPath);
            vscode.window.showInformationMessage(t('msg.filePathCopied'));
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyPreset', async () => {
            const preset = await pickPreset();
            if (preset) { viewerProvider.applyPreset(preset.name); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.savePreset', async () => {
            const preset = await promptSavePreset({});
            if (preset) { viewerProvider.setPresets(loadPresets()); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.toggleInlineDecorations', () => {
            const enabled = inlineDecorations.toggle();
            vscode.window.showInformationMessage(
                enabled ? t('msg.inlineDecorationsEnabled') : t('msg.inlineDecorationsDisabled'),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyTemplate', async () => {
            const template = await pickTemplate();
            if (template) {
                await applyTemplate(template);
                vscode.window.showInformationMessage(t('msg.templateApplied', template.name));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.saveTemplate', async () => { await promptSaveTemplate(); }),
        vscode.commands.registerCommand('saropaLogCapture.resetAllSettings', resetAllSettings),
        vscode.commands.registerCommand('saropaLogCapture.configureIntegrations', () => showIntegrationsPicker()),
    ];
}

async function resetAllSettings(): Promise<void> {
    const answer = await vscode.window.showWarningMessage(
        t('msg.resetSettingsConfirm'),
        { modal: true },
        t('action.reset'),
    );
    if (answer !== t('action.reset')) { return; }

    const ext = vscode.extensions.getExtension(extensionId);
    const props: Record<string, unknown> | undefined =
        ext?.packageJSON?.contributes?.configuration?.properties;
    if (!props) { return; }

    const cfg = vscode.workspace.getConfiguration(settingsSection);
    const prefix = `${settingsSection}.`;
    const keys = Object.keys(props)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));

    const { Global, Workspace } = vscode.ConfigurationTarget;
    await Promise.all(keys.flatMap(k => [
        cfg.update(k, undefined, Global),
        cfg.update(k, undefined, Workspace),
    ]));

    vscode.window.showInformationMessage(
        t('msg.settingsReset', String(keys.length)),
    );
}
