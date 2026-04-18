/**
 * Helpers for collection commands: resolve/pick collection, format signal payload.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { CollectionStore } from './modules/collection/collection-store';
import type { Collection } from './modules/collection/collection-types';

/** Payload from Signals panel "+" (add to case) for any signal type, recurring error, or hot file. */
export type AddSignalItemToCollectionPayload =
    | { type: 'recurring'; normalizedText?: string; exampleLine?: string }
    | { type: 'hotfile'; filename?: string }
    | { type: 'signal'; kind: string; label: string; detail?: string; fingerprint?: string };

/** Format a case item payload as a single-line summary for the collection notes. */
export function formatSignalItemLine(payload: AddSignalItemToCollectionPayload | undefined): string {
    if (!payload) { return ''; }
    if (payload.type === 'recurring') {
        const text = (payload.exampleLine ?? payload.normalizedText ?? '').trim();
        return text ? `Recurring: ${text}` : '';
    }
    if (payload.type === 'hotfile') {
        const name = (payload.filename ?? '').trim();
        return name ? `Hot file: ${name}` : '';
    }
    if (payload.type === 'signal') {
        // Format: "Signal [kind]: label — detail" for unified signal entries
        const kindLabel = payload.kind.charAt(0).toUpperCase() + payload.kind.slice(1);
        const detail = payload.detail ? ` — ${payload.detail.slice(0, 100)}` : '';
        return `Signal [${kindLabel}]: ${payload.label}${detail}`;
    }
    return '';
}

/** Generate a human-readable collection name from a filename.
 * Strips extension, converts underscores to spaces, preserves date hyphens,
 * and title-cases words.
 * "flutter_debug_2024-01-15.log" → "Flutter Debug 2024-01-15" */
export function generateCollectionName(filename: string): string {
    /* Strip extension(s) */
    const base = filename.replace(/\.[^.]+$/, '');
    /* Replace underscores with spaces; replace hyphens only when not between digits (date-safe) */
    const spaced = base.replace(/[_]/g, ' ').replace(/(?<!\d)-(?!\d)/g, ' ');
    /* Title-case each word */
    const titled = spaced.replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
    return titled.trim();
}

/** Resolve the active collection, or prompt user to pick/create one. Returns undefined if cancelled.
 * @param suggestedName Optional default name for new collections (e.g. derived from a filename). */
export async function resolveOrPickCollection(store: CollectionStore, suggestedName?: string): Promise<Collection | undefined> {
    const active = await store.getActiveCollection();
    if (active) { return active; }

    const collections = await store.listCollections();
    let result: Collection | undefined;
    if (collections.length === 0) {
        result = await promptCreateCollection(store, suggestedName);
    } else {
        const items: { label: string; collection: Collection | null }[] = collections.map(inv => ({
            label: inv.name,
            collection: inv,
        }));
        items.push({ label: `$(add) ${t('action.createNew')}`, collection: null });

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: t('prompt.selectCollectionToAdd'),
        });
        if (!picked) { return undefined; }
        result = picked.collection ?? await promptCreateCollection(store, suggestedName);
    }
    if (result) { await store.setActiveCollectionId(result.id); }
    return result;
}

/** Prompt the user to create a new collection. Returns undefined if cancelled.
 * @param suggestedName Optional pre-filled name derived from context (e.g. filename). */
export async function promptCreateCollection(store: CollectionStore, suggestedName?: string): Promise<Collection | undefined> {
    const name = await vscode.window.showInputBox({
        prompt: t('prompt.collectionName'),
        placeHolder: t('placeholder.collectionName'),
        value: suggestedName,
    });
    if (!name) { return undefined; }
    return store.createCollection({ name });
}
