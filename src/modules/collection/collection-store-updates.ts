/**
 * Field-update helpers for collections.
 * Extracted from collection-store.ts to keep that file under the 300-line limit.
 *
 * Each helper locates the collection by id, produces an updated copy, and
 * persists the whole file. Callers are responsible for firing change events.
 */

import {
    Collection,
    CollectionsFile,
} from './collection-types';
import { loadCollectionsFile, saveCollectionsFile } from './collection-store-io';

/** Result of an update: whether a change was actually persisted. */
export interface UpdateResult {
    readonly changed: boolean;
}

/** Helper: locate an collection by id and replace it via an updater. Returns whether a change was written. */
async function applyUpdate(
    id: string,
    updater: (inv: Collection) => Collection | undefined,
): Promise<boolean> {
    const file = await loadCollectionsFile();
    const idx = file.collections.findIndex(inv => inv.id === id);
    if (idx < 0) { return false; }
    const existing = file.collections[idx];
    const updatedInv = updater(existing);
    if (!updatedInv) { return false; }
    const updated: CollectionsFile = {
        ...file,
        collections: [
            ...file.collections.slice(0, idx),
            updatedInv,
            ...file.collections.slice(idx + 1),
        ],
    };
    await saveCollectionsFile(updated);
    return true;
}

/** Update a collection's notes. Empty string clears the notes. */
export async function updateCollectionNotes(id: string, notes: string): Promise<UpdateResult> {
    const changed = await applyUpdate(id, inv => ({
        ...inv,
        updatedAt: Date.now(),
        notes: notes.trim() || undefined,
    }));
    return { changed };
}

/** Update a collection's display name. */
export async function updateCollectionName(id: string, name: string): Promise<UpdateResult> {
    const changed = await applyUpdate(id, inv => ({
        ...inv,
        updatedAt: Date.now(),
        name: name.trim(),
    }));
    return { changed };
}

/** Update a collection's last search query. Note: does NOT bump updatedAt — search queries are ephemeral. */
export async function updateCollectionLastSearchQuery(
    id: string,
    query: string | undefined,
): Promise<UpdateResult> {
    const changed = await applyUpdate(id, inv => ({
        ...inv,
        lastSearchQuery: query?.trim() || undefined,
    }));
    return { changed };
}
