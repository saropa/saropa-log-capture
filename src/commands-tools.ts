/** Tool commands: index rebuild, pop-out, search, presets, templates, integrations, reset settings. */

import * as vscode from 'vscode';
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
    const { viewerProvider, inlineDecorations, popOutPanel, sessionManager } = deps;
    return [
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
            vscode.window.showInformationMessage(vscode.l10n.t('msg.filePathCopied'));
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
                enabled ? vscode.l10n.t('msg.inlineDecorationsEnabled') : vscode.l10n.t('msg.inlineDecorationsDisabled'),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyTemplate', async () => {
            const template = await pickTemplate();
            if (template) {
                await applyTemplate(template);
                vscode.window.showInformationMessage(vscode.l10n.t('msg.templateApplied', template.name));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.saveTemplate', async () => { await promptSaveTemplate(); }),
        vscode.commands.registerCommand('saropaLogCapture.resetAllSettings', resetAllSettings),
        vscode.commands.registerCommand('saropaLogCapture.configureIntegrations', () => showIntegrationsPicker()),
    ];
}

async function resetAllSettings(): Promise<void> {
    const answer = await vscode.window.showWarningMessage(
        vscode.l10n.t('msg.resetSettingsConfirm'),
        { modal: true },
        vscode.l10n.t('action.reset'),
    );
    if (answer !== vscode.l10n.t('action.reset')) { return; }

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
        vscode.l10n.t('msg.settingsReset', String(keys.length)),
    );
}
