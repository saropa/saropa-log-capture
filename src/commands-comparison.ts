/** Session comparison command registrations. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from './modules/config/config';
import { getComparisonPanel } from './ui/session/session-comparison';
import { compareThreeSessions } from './modules/compare/session-compare';
import { renderThreeWayMarkdown } from './modules/compare/session-compare-markdown';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';

/**
 * URI of session marked for comparison (first selection). Retained for `markForComparison`
 * even though its former reader `compareWithMarked` was removed (bug_006 — that command
 * required a TreeView `viewItem` context that no view ever provided, so it was
 * unreachable). `markForComparison` is tracked separately by bug_014, which proposes
 * wiring a working context-menu entry point for the mark/compare pair.
 */
let comparisonMarkUri: vscode.Uri | undefined;

/** Register session comparison commands. */
export function comparisonCommands(extensionUri: vscode.Uri, broadcaster: ViewerBroadcaster): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.markForComparison',
          (item: { uri: vscode.Uri; filename: string }) => {
            // Palette invocation has no target log — guide the user to the context menu.
            if (!item?.uri) {
                void vscode.window.showInformationMessage(t('msg.paletteRequiresLog'));
                return;
            }
            comparisonMarkUri = item.uri;
            vscode.window.showInformationMessage(
                t('msg.markedForComparison', item.filename),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareSessions', async () => {
            const sessions = await pickTwoSessions();
            if (sessions) {
                const panel = getComparisonPanel(extensionUri, broadcaster);
                await panel.compare(sessions[0], sessions[1]);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareThreeSessions', async () => {
            const picked = await pickThreeSessions();
            if (picked) { await openThreeWayComparison(picked); }
        }),
    ];
}

/** Read a log file's lines (UTF-8, split on CR/LF). Empty on read failure — IO is best-effort. */
async function readLogLines(uri: vscode.Uri): Promise<string[]> {
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf-8').split(/\r?\n/);
    } catch {
        return [];
    }
}

/** Run the 3-way engine on the picked sessions and open the report as a Markdown document. */
async function openThreeWayComparison(picked: readonly PickedSession[]): Promise<void> {
    const [a, b, c] = picked;
    const [linesA, linesB, linesC] = await Promise.all([
        readLogLines(a.uri), readLogLines(b.uri), readLogLines(c.uri),
    ]);
    const result = compareThreeSessions({
        labelA: a.label, labelB: b.label, labelC: c.label, linesA, linesB, linesC,
    });
    const doc = await vscode.workspace.openTextDocument({
        content: renderThreeWayMarkdown(result),
        language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: false });
    // Open the rendered Markdown preview beside the source so the report reads as a document.
    await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
}

interface PickedSession { readonly uri: vscode.Uri; readonly label: string; }

/** Quick Pick three sessions (baseline, run B, run C); each step excludes prior choices. */
async function pickThreeSessions(): Promise<PickedSession[] | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    const { fileTypes, includeSubfolders } = getConfig();
    const tracked = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
    const files = tracked
        .map(rel => ({ label: rel, uri: vscode.Uri.joinPath(logDir, rel) }))
        .sort((x, y) => y.label.localeCompare(x.label));
    if (files.length < 3) {
        vscode.window.showWarningMessage(t('msg.needThreeSessions'));
        return undefined;
    }
    const chosen: PickedSession[] = [];
    const prompts = ['prompt.selectBaseline', 'prompt.selectRunB', 'prompt.selectRunC'];
    const titles = ['title.compare3Baseline', 'title.compare3RunB', 'title.compare3RunC'];
    for (let i = 0; i < 3; i++) {
        const remaining = files.filter(f => !chosen.some(p => p.uri.fsPath === f.uri.fsPath));
        const pick = await vscode.window.showQuickPick(remaining, {
            placeHolder: t(prompts[i]),
            title: t(titles[i]),
        });
        if (!pick) { return undefined; }
        chosen.push({ uri: pick.uri, label: pick.label });
    }
    return chosen;
}

/** Show Quick Pick to select two sessions for comparison. */
async function pickTwoSessions(): Promise<[vscode.Uri, vscode.Uri] | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    const { fileTypes, includeSubfolders } = getConfig();
    const tracked = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
    const files = tracked
        .map(rel => ({ label: rel, uri: vscode.Uri.joinPath(logDir, rel) }))
        .sort((a, b) => b.label.localeCompare(a.label));
    if (files.length < 2) {
        vscode.window.showWarningMessage(t('msg.needTwoSessions'));
        return undefined;
    }
    const first = await vscode.window.showQuickPick(files, {
        placeHolder: t('prompt.selectFirstSession'),
        title: t('title.compareSessions1'),
    });
    if (!first) { return undefined; }
    const second = await vscode.window.showQuickPick(
        files.filter(f => f.uri.fsPath !== first.uri.fsPath),
        {
            placeHolder: t('prompt.selectSecondSession'),
            title: t('title.compareSessions2'),
        },
    );
    return second ? [first.uri, second.uri] : undefined;
}
