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
    MAX_SEARCH_HISTORY,
} from './investigation-types';

const INVESTIGATIONS_FILENAME = 'investigations.json';
const SAROPA_FOLDER = '.saropa';
const ACTIVE_INVESTIGATION_KEY = 'slc.activeInvestigationId';
const RECENT_INVESTIGATIONS_KEY = 'slc.recentInvestigationIds';
const SEARCH_HISTORY_KEY = 'slc.searchHistory';
const MAX_RECENT = 5;

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
        const file = await this.load();
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
        await this.save(updated);
        return investigation;
    }

    /** List all investigations, sorted by updatedAt descending (most recent first). */
    async listInvestigations(): Promise<Investigation[]> {
        const file = await this.load();
        return [...file.investigations].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /** Get a specific investigation by ID. */
    async getInvestigation(id: string): Promise<Investigation | undefined> {
        const file = await this.load();
        return file.investigations.find(inv => inv.id === id);
    }

    /** Add a source to an investigation. */
    async addSource(investigationId: string, input: AddSourceInput): Promise<void> {
        const file = await this.load();
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
        await this.save(updated);
    }

    /** Remove a source from an investigation by relative path. */
    async removeSource(investigationId: string, relativePath: string): Promise<void> {
        const file = await this.load();
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
        await this.save(updated);
    }

    /** Delete an investigation. */
    async deleteInvestigation(id: string): Promise<void> {
        const file = await this.load();
        const filtered = file.investigations.filter(inv => inv.id !== id);
        if (filtered.length === file.investigations.length) { return; }
        const updated: InvestigationsFile = { ...file, investigations: filtered };
        await this.save(updated);
        const activeId = await this.getActiveInvestigationId();
        if (activeId === id) {
            await this.setActiveInvestigationId(undefined);
        }
    }

    /** Update an investigation's notes. */
    async updateNotes(id: string, notes: string): Promise<void> {
        const file = await this.load();
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
        await this.save(updated);
    }

    /** Update an investigation's name. */
    async updateName(id: string, name: string): Promise<void> {
        const file = await this.load();
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
        await this.save(updated);
    }

    /** Update an investigation's last search query. */
    async updateLastSearchQuery(id: string, query: string | undefined): Promise<void> {
        const file = await this.load();
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
        await this.save(updated);
    }

    /** Get the active investigation ID (stored in workspace state). */
    async getActiveInvestigationId(): Promise<string | undefined> {
        return this.context.workspaceState.get<string>(ACTIVE_INVESTIGATION_KEY);
    }

    /** Set the active investigation ID. Pass undefined to deactivate. */
    async setActiveInvestigationId(id: string | undefined): Promise<void> {
        await this.context.workspaceState.update(ACTIVE_INVESTIGATION_KEY, id);
        if (id) {
            await this.addToRecent(id);
        }
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
        return this.context.workspaceState.get<string[]>(RECENT_INVESTIGATIONS_KEY, []);
    }

    private async addToRecent(id: string): Promise<void> {
        const recent = await this.getRecentInvestigationIds();
        const filtered = recent.filter(r => r !== id);
        const updated = [id, ...filtered].slice(0, MAX_RECENT);
        await this.context.workspaceState.update(RECENT_INVESTIGATIONS_KEY, updated);
    }

    /** Get search history (most recent first). */
    async getSearchHistory(): Promise<string[]> {
        return this.context.workspaceState.get<string[]>(SEARCH_HISTORY_KEY, []);
    }

    /** Add a query to search history. */
    async addToSearchHistory(query: string): Promise<void> {
        if (!query.trim()) { return; }
        const history = await this.getSearchHistory();
        const filtered = history.filter(q => q !== query);
        const updated = [query, ...filtered].slice(0, MAX_SEARCH_HISTORY);
        await this.context.workspaceState.update(SEARCH_HISTORY_KEY, updated);
    }

    /** Clear search history. */
    async clearSearchHistory(): Promise<void> {
        await this.context.workspaceState.update(SEARCH_HISTORY_KEY, []);
    }

    private getInvestigationsFileUri(): vscode.Uri | undefined {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) { return undefined; }
        return vscode.Uri.joinPath(folder.uri, SAROPA_FOLDER, INVESTIGATIONS_FILENAME);
    }

    private async load(): Promise<InvestigationsFile> {
        const uri = this.getInvestigationsFileUri();
        if (!uri) {
            return { version: 1, investigations: [] };
        }
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            const json = JSON.parse(Buffer.from(data).toString('utf-8')) as InvestigationsFile;
            if (json.version !== 1 || !Array.isArray(json.investigations)) {
                return { version: 1, investigations: [] };
            }
            return json;
        } catch {
            return { version: 1, investigations: [] };
        }
    }

    private async save(file: InvestigationsFile): Promise<void> {
        const uri = this.getInvestigationsFileUri();
        if (!uri) { return; }
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) { return; }
        const saropaDir = vscode.Uri.joinPath(folder.uri, SAROPA_FOLDER);
        try {
            await vscode.workspace.fs.createDirectory(saropaDir);
        } catch { /* may exist */ }
        const content = JSON.stringify(file, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        this._onDidChange.fire();
    }
}
