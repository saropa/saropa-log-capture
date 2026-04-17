/**
 * Investigation persistence layer.
 * Stores investigations in .saropa/investigations.json (portable, can commit to repo).
 * Active investigation ID is stored in workspace state (user-specific).
 */

import * as vscode from 'vscode';
import {
    Investigation,
    InvestigationSource,
    InvestigationsFile,
    CreateInvestigationInput,
    AddSourceInput,
    MAX_INVESTIGATIONS,
    MAX_SOURCES_PER_INVESTIGATION,
} from './investigation-types';
import { loadInvestigationsFile, saveInvestigationsFile } from './investigation-store-io';
import {
    getActiveInvestigationId as getActiveId,
    setActiveInvestigationId as setActiveId,
    getRecentInvestigationIds as getRecentIds,
    getSearchHistory as getSearchHistoryState,
    addToSearchHistory as addToSearchHistoryState,
    clearSearchHistory as clearSearchHistoryState,
} from './investigation-store-workspace';

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class InvestigationStore implements vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    dispose(): void {
        this._onDidChange.dispose();
    }

    /** Create a new investigation. Returns the created investigation. */
    async createInvestigation(input: CreateInvestigationInput): Promise<Investigation> {
        const file = await loadInvestigationsFile();
        if (file.investigations.length >= MAX_INVESTIGATIONS) {
            throw new Error(`Maximum of ${MAX_INVESTIGATIONS} investigations reached.`);
        }
        const now = Date.now();
        const investigation: Investigation = {
            id: generateId(),
            name: input.name.trim(),
            createdAt: now,
            updatedAt: now,
            sources: [],
            notes: input.notes?.trim(),
        };
        const updated: InvestigationsFile = {
            ...file,
            investigations: [...file.investigations, investigation],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
        return investigation;
    }

    /** List all investigations, sorted by updatedAt descending (most recent first). */
    async listInvestigations(): Promise<Investigation[]> {
        const file = await loadInvestigationsFile();
        return [...file.investigations].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /** Get a specific investigation by ID. */
    async getInvestigation(id: string): Promise<Investigation | undefined> {
        const file = await loadInvestigationsFile();
        return file.investigations.find(inv => inv.id === id);
    }

    /** Add an existing investigation (e.g. from import). Fails if at MAX_INVESTIGATIONS. */
    async addInvestigation(investigation: Investigation): Promise<void> {
        const file = await loadInvestigationsFile();
        if (file.investigations.length >= MAX_INVESTIGATIONS) {
            throw new Error(`Maximum of ${MAX_INVESTIGATIONS} investigations reached.`);
        }
        if (file.investigations.some(inv => inv.id === investigation.id)) {
            return;
        }
        const updated: InvestigationsFile = {
            ...file,
            investigations: [...file.investigations, investigation],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
    }

    /** Add a source to an investigation. */
    async addSource(investigationId: string, input: AddSourceInput): Promise<void> {
        const file = await loadInvestigationsFile();
        const idx = file.investigations.findIndex(inv => inv.id === investigationId);
        if (idx < 0) {
            throw new Error('Investigation not found.');
        }
        const inv = file.investigations[idx];
        if (inv.sources.length >= MAX_SOURCES_PER_INVESTIGATION) {
            throw new Error(`Maximum of ${MAX_SOURCES_PER_INVESTIGATION} sources per investigation.`);
        }
        if (inv.sources.some(s => s.relativePath === input.relativePath)) {
            return;
        }
        const source: InvestigationSource = {
            type: input.type,
            relativePath: input.relativePath,
            label: input.label,
            pinnedAt: Date.now(),
        };
        const updatedInv: Investigation = {
            ...inv,
            updatedAt: Date.now(),
            sources: [...inv.sources, source],
        };
        const updated: InvestigationsFile = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
    }

    /** Remove a source from an investigation by relative path. */
    async removeSource(investigationId: string, relativePath: string): Promise<void> {
        const file = await loadInvestigationsFile();
        const idx = file.investigations.findIndex(inv => inv.id === investigationId);
        if (idx < 0) { return; }
        const inv = file.investigations[idx];
        const filtered = inv.sources.filter(s => s.relativePath !== relativePath);
        if (filtered.length === inv.sources.length) { return; }
        const updatedInv: Investigation = {
            ...inv,
            updatedAt: Date.now(),
            sources: filtered,
        };
        const updated: InvestigationsFile = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
    }

    /** Delete an investigation. */
    async deleteInvestigation(id: string): Promise<void> {
        const file = await loadInvestigationsFile();
        const filtered = file.investigations.filter(inv => inv.id !== id);
        if (filtered.length === file.investigations.length) { return; }
        const updated: InvestigationsFile = { ...file, investigations: filtered };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
        const activeId = await getActiveId(this.context);
        if (activeId === id) {
            await this.setActiveInvestigationId(undefined);
        }
    }

    /** Update an investigation's notes. */
    async updateNotes(id: string, notes: string): Promise<void> {
        const file = await loadInvestigationsFile();
        const idx = file.investigations.findIndex(inv => inv.id === id);
        if (idx < 0) { return; }
        const inv = file.investigations[idx];
        const updatedInv: Investigation = {
            ...inv,
            updatedAt: Date.now(),
            notes: notes.trim() || undefined,
        };
        const updated: InvestigationsFile = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
    }

    /** Update an investigation's name. */
    async updateName(id: string, name: string): Promise<void> {
        const file = await loadInvestigationsFile();
        const idx = file.investigations.findIndex(inv => inv.id === id);
        if (idx < 0) { return; }
        const inv = file.investigations[idx];
        const updatedInv: Investigation = {
            ...inv,
            updatedAt: Date.now(),
            name: name.trim(),
        };
        const updated: InvestigationsFile = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
    }

    /** Update an investigation's last search query. */
    async updateLastSearchQuery(id: string, query: string | undefined): Promise<void> {
        const file = await loadInvestigationsFile();
        const idx = file.investigations.findIndex(inv => inv.id === id);
        if (idx < 0) { return; }
        const inv = file.investigations[idx];
        const updatedInv: Investigation = {
            ...inv,
            lastSearchQuery: query?.trim() || undefined,
        };
        const updated: InvestigationsFile = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await saveInvestigationsFile(updated);
        this._onDidChange.fire();
    }

    /** Get the active investigation ID (stored in workspace state). */
    async getActiveInvestigationId(): Promise<string | undefined> {
        return getActiveId(this.context);
    }

    /** Set the active investigation ID. Pass undefined to deactivate. */
    async setActiveInvestigationId(id: string | undefined): Promise<void> {
        await setActiveId(this.context, id);
        this._onDidChange.fire();
    }

    /** Get the active investigation (convenience method). */
    async getActiveInvestigation(): Promise<Investigation | undefined> {
        const id = await this.getActiveInvestigationId();
        if (!id) { return undefined; }
        return this.getInvestigation(id);
    }

    /** Get recent investigation IDs (most recent first, max 5). */
    async getRecentInvestigationIds(): Promise<string[]> {
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
