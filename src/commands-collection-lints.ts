import * as vscode from 'vscode';
import { CollectionStore } from './modules/collection/collection-store';
import { CollectionSource, MAX_SOURCES_PER_COLLECTION } from './modules/collection/collection-types';

async function tryAddSaropaLintsViolationsSnapshot(
    store: CollectionStore,
    collectionId: string,
    violationsUri: vscode.Uri,
    violationsRel: string,
): Promise<void> {
    try {
        await vscode.workspace.fs.stat(violationsUri);
        await store.addSource(collectionId, {
            type: 'file',
            relativePath: violationsRel,
            label: 'Saropa Lints: violations.json',
        });
    } catch {
        // Ignore when snapshot is missing/unreadable.
    }
}

export async function tryPinSaropaLintsViolationsSnapshot(
    store: CollectionStore,
    collectionId: string,
    existingSources: readonly CollectionSource[],
    wsRoot: vscode.Uri,
): Promise<void> {
    // Allow snapshot pin only if it fits within the max sources limit after the session is added.
    if (existingSources.length + 1 >= MAX_SOURCES_PER_COLLECTION) { return; }

    const violationsUri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'violations.json');
    const violationsRel = vscode.workspace.asRelativePath(violationsUri, false);
    // Group sources don't carry a relativePath; filter to file/session sources for the dup check.
    const alreadyPinned = existingSources.some(
        s => s.type !== 'group' && s.relativePath === violationsRel,
    );
    if (alreadyPinned) { return; }

    await tryAddSaropaLintsViolationsSnapshot(store, collectionId, violationsUri, violationsRel);
}
