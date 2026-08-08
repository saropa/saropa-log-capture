/**
 * File-writing actions for the flow-map panel: the Markdown save and the arranged-diagram SVG
 * export. Split out of `flow-map-panel.ts` to keep that file inside the line budget — both actions
 * share the same save-dialog-then-offer-to-open shape and belong together.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import type { FlowMapPanelParams } from './flow-map-panel';

/** Save the markdown report via a save dialog, then offer to open it. */
export async function saveMarkdown(params: FlowMapPanelParams): Promise<void> {
    const target = await vscode.window.showSaveDialog({
        defaultUri: params.defaultUri,
        filters: { Markdown: ['md'] },
        title: t('flowMap.saveTitle'),
    });
    if (!target) { return; }
    await vscode.workspace.fs.writeFile(target, Buffer.from(params.markdown, 'utf-8'));
    const open = await vscode.window.showInformationMessage(
        t('msg.exportedTo', target.fsPath.split(/[\\/]/).pop() ?? ''), t('action.open'),
    );
    if (open === t('action.open')) { await vscode.window.showTextDocument(target); }
}

/** `params.defaultUri` with its extension swapped for `.svg`, beside the markdown default. */
function defaultSvgUri(params: FlowMapPanelParams): vscode.Uri {
    const dir = vscode.Uri.joinPath(params.defaultUri, '..');
    const base = (params.defaultUri.path.split('/').pop() ?? 'flow-map').replace(/\.[^.]+$/, '');
    return vscode.Uri.joinPath(dir, `${base}.svg`);
}

/**
 * Save the diagram exactly as the webview rendered it — colors and any hand rearrangement already
 * baked in client-side (see `exportArrangedSvg` in flow-map-panel-zoom-script.ts) — so this side
 * only has to write the bytes it was handed.
 *
 * `shotsOmitted` counts screenshot thumbnails the client stripped before serializing (their
 * `vscode-webview://` source means nothing once this file leaves the panel). A save that quietly
 * drops information the reader may have wanted must say so — surfaced as a second line on the same
 * confirmation, not a separate interruption for something that isn't an error.
 */
export async function saveArrangedSvg(
    params: FlowMapPanelParams, svg: string, shotsOmitted: number,
): Promise<void> {
    const target = await vscode.window.showSaveDialog({
        defaultUri: defaultSvgUri(params),
        filters: { 'SVG image': ['svg'] },
        title: t('flowMap.saveSvgTitle'),
    });
    if (!target) { return; }
    await vscode.workspace.fs.writeFile(target, Buffer.from(svg, 'utf-8'));
    const filename = target.fsPath.split(/[\\/]/).pop() ?? '';
    const summary = shotsOmitted > 0
        ? `${t('msg.exportedTo', filename)} ${t('flowMap.exportSvgShotsOmitted', String(shotsOmitted))}`
        : t('msg.exportedTo', filename);
    const open = await vscode.window.showInformationMessage(summary, t('action.open'));
    if (open === t('action.open')) { await vscode.window.showTextDocument(target); }
}
