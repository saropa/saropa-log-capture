import * as vscode from 'vscode';
import { InvestigationStore } from './modules/investigation/investigation-store';
import { MAX_SOURCES_PER_INVESTIGATION } from './modules/investigation/investigation-types';

async function tryAddSaropaLintsViolationsSnapshot(
    store: InvestigationStore,
    investigationId: string,
    violationsUri: vscode.Uri,
    violationsRel: string,
): Promise<void> {
    try {
        await vscode.workspace.fs.stat(violationsUri);
        await store.addSource(investigationId, {
            type: 'file',
            relativePath: violationsRel,
            label: 'Saropa Lints: violations.json',
        });
    } catch {
        // Ignore when snapshot is missing/unreadable.
    }
}

export async function tryPinSaropaLintsViolationsSnapshot(
    store: InvestigationStore,
    investigationId: string,
    existingSources: readonly { relativePath: string }[],
    wsRoot: vscode.Uri,
): Promise<void> {
    // Allow snapshot pin only if it fits within the max sources limit after the session is added.
    if (existingSources.length + 1 >= MAX_SOURCES_PER_INVESTIGATION) { return; }

    const violationsUri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'violations.json');
    const violationsRel = vscode.workspace.asRelativePath(violationsUri, false);
    const alreadyPinned = existingSources.some(s => s.relativePath === violationsRel);
    if (alreadyPinned) { return; }

    await tryAddSaropaLintsViolationsSnapshot(store, investigationId, violationsUri, violationsRel);
}
