/**
 * Collection persistence layer.
 * Stores collections in .saropa/collections.json (portable, can commit to repo).
 * Active collection ID is stored in workspace state (user-specific).
 */

import * as vscode from 'vscode';
import {
    Collection,
    CollectionSource,
    CollectionsFile,
    CreateCollectionInput,
    AddSourceInput,
    MAX_COLLECTIONS,
    MAX_SOURCES_PER_COLLECTION,
} from './collection-types';
import { loadCollectionsFile, saveCollectionsFile } from './collection-store-io';
import {
    getActiveCollectionId as getActiveId,
    setActiveCollectionId as setActiveId,
    getRecentCollectionIds as getRecentIds,
    getSearchHistory as getSearchHistoryState,
    addToSearchHistory as addToSearchHistoryState,
    clearSearchHistory as clearSearchHistoryState,
} from './collection-store-workspace';

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class CollectionStore implements vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    dispose(): void {
        this._onDidChange.dispose();
    }

    /** Create a new collection. Returns the created collection. */
    async createCollection(input: CreateCollectionInput): Promise<Collection> {
        const file = await loadCollectionsFile();
        if (file.collections.length >= MAX_COLLECTIONS) {
            throw new Error(`Maximum of ${MAX_COLLECTIONS} collections reached.`);
        }
        const now = Date.now();
        const collection: Collection = {
            id: generateId(),
            name: input.name.trim(),
            createdAt: now,
            updatedAt: now,
            sources: [],
            notes: input.notes?.trim(),
        };
        const updated: CollectionsFile = {
            ...file,
            collections: [...file.collections, collection],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
        return collection;
    }

    /** List all collections, sorted by updatedAt descending (most recent first). */
    async listCollections(): Promise<Collection[]> {
        const file = await loadCollectionsFile();
        return [...file.collections].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /** Get a specific collection by ID. */
    async getCollection(id: string): Promise<Collection | undefined> {
        const file = await loadCollectionsFile();
        return file.collections.find(inv => inv.id === id);
    }

    /** Add an existing collection (e.g. from import). Fails if at MAX_COLLECTIONS. */
    async addCollection(collection: Collection): Promise<void> {
        const file = await loadCollectionsFile();
        if (file.collections.length >= MAX_COLLECTIONS) {
            throw new Error(`Maximum of ${MAX_COLLECTIONS} collections reached.`);
        }
        if (file.collections.some(inv => inv.id === collection.id)) {
            return;
        }
        const updated: CollectionsFile = {
            ...file,
            collections: [...file.collections, collection],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
    }

    /** Add a source to a collection. */
    async addSource(collectionId: string, input: AddSourceInput): Promise<void> {
        const file = await loadCollectionsFile();
        const idx = file.collections.findIndex(inv => inv.id === collectionId);
        if (idx < 0) {
            throw new Error('Collection not found.');
        }
        const inv = file.collections[idx];
        if (inv.sources.length >= MAX_SOURCES_PER_COLLECTION) {
            throw new Error(`Maximum of ${MAX_SOURCES_PER_COLLECTION} sources per collection.`);
        }
        if (inv.sources.some(s => s.relativePath === input.relativePath)) {
            return;
        }
        const source: CollectionSource = {
            type: input.type,
            relativePath: input.relativePath,
            label: input.label,
            pinnedAt: Date.now(),
        };
        const updatedInv: Collection = {
            ...inv,
            updatedAt: Date.now(),
            sources: [...inv.sources, source],
        };
        const updated: CollectionsFile = {
            ...file,
            collections: [
                ...file.collections.slice(0, idx),
                updatedInv,
                ...file.collections.slice(idx + 1),
            ],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
    }

    /** Remove a source from a collection by relative path. */
    async removeSource(collectionId: string, relativePath: string): Promise<void> {
        const file = await loadCollectionsFile();
        const idx = file.collections.findIndex(inv => inv.id === collectionId);
        if (idx < 0) { return; }
        const inv = file.collections[idx];
        const filtered = inv.sources.filter(s => s.relativePath !== relativePath);
        if (filtered.length === inv.sources.length) { return; }
        const updatedInv: Collection = {
            ...inv,
            updatedAt: Date.now(),
            sources: filtered,
        };
        const updated: CollectionsFile = {
            ...file,
            collections: [
                ...file.collections.slice(0, idx),
                updatedInv,
                ...file.collections.slice(idx + 1),
            ],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
    }

    /** Delete a collection. */
    async deleteCollection(id: string): Promise<void> {
        const file = await loadCollectionsFile();
        const filtered = file.collections.filter(inv => inv.id !== id);
        if (filtered.length === file.collections.length) { return; }
        const updated: CollectionsFile = { ...file, collections: filtered };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
        const activeId = await getActiveId(this.context);
        if (activeId === id) {
            await this.setActiveCollectionId(undefined);
        }
    }

    /** Update a collection's notes. */
    async updateNotes(id: string, notes: string): Promise<void> {
        const file = await loadCollectionsFile();
        const idx = file.collections.findIndex(inv => inv.id === id);
        if (idx < 0) { return; }
        const inv = file.collections[idx];
        const updatedInv: Collection = {
            ...inv,
            updatedAt: Date.now(),
            notes: notes.trim() || undefined,
        };
        const updated: CollectionsFile = {
            ...file,
            collections: [
                ...file.collections.slice(0, idx),
                updatedInv,
                ...file.collections.slice(idx + 1),
            ],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
    }

    /** Update a collection's name. */
    async updateName(id: string, name: string): Promise<void> {
        const file = await loadCollectionsFile();
        const idx = file.collections.findIndex(inv => inv.id === id);
        if (idx < 0) { return; }
        const inv = file.collections[idx];
        const updatedInv: Collection = {
            ...inv,
            updatedAt: Date.now(),
            name: name.trim(),
        };
        const updated: CollectionsFile = {
            ...file,
            collections: [
                ...file.collections.slice(0, idx),
                updatedInv,
                ...file.collections.slice(idx + 1),
            ],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
    }

    /** Merge source collection into target: move all sources, then delete source.
     * If the source was the active collection, the target becomes active. */
    async mergeCollections(sourceId: string, targetId: string): Promise<void> {
        const source = await this.getCollection(sourceId);
        const target = await this.getCollection(targetId);
        if (!source || !target) {
            throw new Error('Collection not found.');
        }
        /* Switch active before delete so deleteCollection doesn't clear it */
        const wasActive = (await this.getActiveCollectionId()) === sourceId;
        /* Add each source that isn't already in the target */
        for (const s of source.sources) {
            const alreadyExists = target.sources.some(
                t => t.relativePath === s.relativePath,
            );
            if (!alreadyExists) {
                await this.addSource(targetId, {
                    type: s.type,
                    relativePath: s.relativePath,
                    label: s.label,
                });
            }
        }
        await this.deleteCollection(sourceId);
        if (wasActive) {
            await this.setActiveCollectionId(targetId);
        }
    }

    /** Update a collection's last search query. */
    async updateLastSearchQuery(id: string, query: string | undefined): Promise<void> {
        const file = await loadCollectionsFile();
        const idx = file.collections.findIndex(inv => inv.id === id);
        if (idx < 0) { return; }
        const inv = file.collections[idx];
        const updatedInv: Collection = {
            ...inv,
            lastSearchQuery: query?.trim() || undefined,
        };
        const updated: CollectionsFile = {
            ...file,
            collections: [
                ...file.collections.slice(0, idx),
                updatedInv,
                ...file.collections.slice(idx + 1),
            ],
        };
        await saveCollectionsFile(updated);
        this._onDidChange.fire();
    }

    /** Get the active collection ID (stored in workspace state). */
    async getActiveCollectionId(): Promise<string | undefined> {
        return getActiveId(this.context);
    }

    /** Set the active collection ID. Pass undefined to deactivate. */
    async setActiveCollectionId(id: string | undefined): Promise<void> {
        await setActiveId(this.context, id);
        this._onDidChange.fire();
    }

    /** Get the active collection (convenience method). */
    async getActiveCollection(): Promise<Collection | undefined> {
        const id = await this.getActiveCollectionId();
        if (!id) { return undefined; }
        return this.getCollection(id);
    }

    /** Get recent collection IDs (most recent first, max 5). */
    async getRecentCollectionIds(): Promise<string[]> {
        return getRecentIds(this.context);
    }

    /** Get search history (most recent first). */
    async getSearchHistory(): Promise<string[]> {
        return getSearchHistoryState(this.context);
    }

    /** Add a query to search history. */
    async addToSearchHistory(query: string): Promise<void> {
        await addToSearchHistoryState(this.context, query);
    }

    /** Clear search history. */
    async clearSearchHistory(): Promise<void> {
        await clearSearchHistoryState(this.context);
    }
}
