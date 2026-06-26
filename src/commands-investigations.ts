/**
 * Investigation Groups commands (cross-session-analysis idea #2): create / add / remove / rename /
 * notes / delete, plus open (in `commands-investigations-open.ts`). An investigation is a curated,
 * human-named bundle of related sessions with notes — a layer ON TOP of automatic grouping, never a
 * replacement. Membership is non-destructive: a session can belong to an auto group and any number
 * of investigations, and deleting an investigation never deletes log files.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './l10n';
import { relativeKey } from './modules/session/session-metadata-io';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { Investigation } from './modules/session/investigation-model';
import type { InvestigationStore } from './modules/session/investigation-store';
import {
    resolveTargetUris,
    pickInvestigation,
    pickOrCreateInvestigation,
    promptText,
} from './commands-investigations-helpers';
import { runOpenInvestigation } from './commands-investigations-open';

/** Create a new, empty investigation by name. */
async function runNewInvestigation(store: InvestigationStore): Promise<void> {
    const title = await promptText({
        prompt: t('investigation.newPrompt'),
        placeHolder: t('investigation.newPlaceholder'),
        requireNonEmpty: true,
        emptyMessage: t('investigation.emptyTitle'),
    });
    if (!title) { return; }
    const inv = await store.create(title);
    void vscode.window.showInformationMessage(t('investigation.created', inv.title));
}

/** Add the selected log(s) to an existing or newly-created investigation. */
async function runAddToInvestigation(store: InvestigationStore, uris: readonly vscode.Uri[]): Promise<void> {
    if (uris.length === 0) { return; }
    const inv = await pickOrCreateInvestigation(store, t('investigation.addPlaceholder'));
    if (!inv) { return; }
    let added = 0;
    for (const uri of uris) {
        const key = relativeKey(uri);
        const already = store.get(inv.id)?.sessionKeys.includes(key) ?? false;
        if (already) { continue; }
        await store.addSession(inv.id, key);
        added += 1;
    }
    if (uris.length === 1) {
        const name = path.basename(uris[0].fsPath);
        const msg = added === 1
            ? t('investigation.added', name, inv.title)
            : t('investigation.alreadyMember', name, inv.title);
        void vscode.window.showInformationMessage(msg);
        return;
    }
    void vscode.window.showInformationMessage(t('investigation.addedMulti', added, inv.title));
}

/** Pick which investigation to remove from when a log belongs to more than one. */
async function pickContaining(containing: readonly Investigation[]): Promise<Investigation | undefined> {
    if (containing.length === 1) { return containing[0]; }
    const pick = await vscode.window.showQuickPick(
        containing.map((inv) => ({ label: inv.title, inv })),
        { placeHolder: t('investigation.removePlaceholder') },
    );
    return pick?.inv;
}

/** Remove the selected log from one of the investigations it belongs to. */
async function runRemoveFromInvestigation(store: InvestigationStore, uris: readonly vscode.Uri[]): Promise<void> {
    const uri = uris[0];
    if (!uri) { return; }
    const key = relativeKey(uri);
    const name = path.basename(uri.fsPath);
    const containing = store.containing(key);
    if (containing.length === 0) {
        void vscode.window.showInformationMessage(t('investigation.notInAny', name));
        return;
    }
    const target = await pickContaining(containing);
    if (!target) { return; }
    await store.removeSession(target.id, key);
    void vscode.window.showInformationMessage(t('investigation.removed', name, target.title));
}

/** Rename an investigation. */
async function runRenameInvestigation(store: InvestigationStore): Promise<void> {
    const inv = await pickInvestigation(store, t('investigation.pickPlaceholder'));
    if (!inv) { return; }
    const title = await promptText({
        prompt: t('investigation.renamePrompt'),
        value: inv.title,
        requireNonEmpty: true,
        emptyMessage: t('investigation.emptyTitle'),
    });
    if (!title || title === inv.title) { return; }
    await store.rename(inv.id, title);
    void vscode.window.showInformationMessage(t('investigation.renamed', title));
}

/** Edit an investigation's notes (empty input clears them). */
async function runEditInvestigationNotes(store: InvestigationStore): Promise<void> {
    const inv = await pickInvestigation(store, t('investigation.pickPlaceholder'));
    if (!inv) { return; }
    const notes = await promptText({
        prompt: t('investigation.notesPrompt', inv.title),
        placeHolder: t('investigation.notesPlaceholder'),
        value: inv.notes,
    });
    if (notes === undefined) { return; }
    await store.setNotes(inv.id, notes);
    void vscode.window.showInformationMessage(t('investigation.notesSaved', inv.title));
}

/** Delete an investigation (the log files are kept). */
async function runDeleteInvestigation(store: InvestigationStore): Promise<void> {
    const inv = await pickInvestigation(store, t('investigation.pickPlaceholder'));
    if (!inv) { return; }
    const action = t('investigation.deleteAction');
    const confirm = await vscode.window.showWarningMessage(
        t('investigation.deleteConfirm', inv.title, inv.sessionKeys.length),
        { modal: true },
        action,
    );
    if (confirm !== action) { return; }
    await store.delete(inv.id);
    void vscode.window.showInformationMessage(t('investigation.deleted', inv.title));
}

/** Register all investigation commands. Returns disposables for `context.subscriptions`. */
export function investigationCommands(
    store: InvestigationStore,
    historyProvider: SessionHistoryProvider,
): vscode.Disposable[] {
    const reg = vscode.commands.registerCommand;
    return [
        reg('saropaLogCapture.newInvestigation', () => runNewInvestigation(store)),
        reg('saropaLogCapture.addToInvestigation', (p?: unknown, s?: unknown) =>
            runAddToInvestigation(store, resolveTargetUris(p, s)),
        ),
        reg('saropaLogCapture.removeFromInvestigation', (p?: unknown, s?: unknown) =>
            runRemoveFromInvestigation(store, resolveTargetUris(p, s)),
        ),
        reg('saropaLogCapture.renameInvestigation', () => runRenameInvestigation(store)),
        reg('saropaLogCapture.editInvestigationNotes', () => runEditInvestigationNotes(store)),
        reg('saropaLogCapture.deleteInvestigation', () => runDeleteInvestigation(store)),
        reg('saropaLogCapture.openInvestigation', () => runOpenInvestigation(store, historyProvider)),
    ];
}
