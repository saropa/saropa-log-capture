"use strict";
/**
 * Investigation persistence layer.
 * Stores investigations in .saropa/investigations.json (portable, can commit to repo).
 * Active investigation ID is stored in workspace state (user-specific).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigationStore = void 0;
const vscode = __importStar(require("vscode"));
const investigation_types_1 = require("./investigation-types");
const investigation_store_io_1 = require("./investigation-store-io");
const investigation_store_workspace_1 = require("./investigation-store-workspace");
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
class InvestigationStore {
    context;
    _onDidChange = new vscode.EventEmitter();
    onDidChange = this._onDidChange.event;
    constructor(context) {
        this.context = context;
    }
    dispose() {
        this._onDidChange.dispose();
    }
    /** Create a new investigation. Returns the created investigation. */
    async createInvestigation(input) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        if (file.investigations.length >= investigation_types_1.MAX_INVESTIGATIONS) {
            throw new Error(`Maximum of ${investigation_types_1.MAX_INVESTIGATIONS} investigations reached.`);
        }
        const now = Date.now();
        const investigation = {
            id: generateId(),
            name: input.name.trim(),
            createdAt: now,
            updatedAt: now,
            sources: [],
            notes: input.notes?.trim(),
        };
        const updated = {
            ...file,
            investigations: [...file.investigations, investigation],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
        return investigation;
    }
    /** List all investigations, sorted by updatedAt descending (most recent first). */
    async listInvestigations() {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        return [...file.investigations].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    /** Get a specific investigation by ID. */
    async getInvestigation(id) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        return file.investigations.find(inv => inv.id === id);
    }
    /** Add an existing investigation (e.g. from import). Fails if at MAX_INVESTIGATIONS. */
    async addInvestigation(investigation) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        if (file.investigations.length >= investigation_types_1.MAX_INVESTIGATIONS) {
            throw new Error(`Maximum of ${investigation_types_1.MAX_INVESTIGATIONS} investigations reached.`);
        }
        if (file.investigations.some(inv => inv.id === investigation.id)) {
            return;
        }
        const updated = {
            ...file,
            investigations: [...file.investigations, investigation],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
    }
    /** Add a source to an investigation. */
    async addSource(investigationId, input) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        const idx = file.investigations.findIndex(inv => inv.id === investigationId);
        if (idx < 0) {
            throw new Error('Investigation not found.');
        }
        const inv = file.investigations[idx];
        if (inv.sources.length >= investigation_types_1.MAX_SOURCES_PER_INVESTIGATION) {
            throw new Error(`Maximum of ${investigation_types_1.MAX_SOURCES_PER_INVESTIGATION} sources per investigation.`);
        }
        if (inv.sources.some(s => s.relativePath === input.relativePath)) {
            return;
        }
        const source = {
            type: input.type,
            relativePath: input.relativePath,
            label: input.label,
            pinnedAt: Date.now(),
        };
        const updatedInv = {
            ...inv,
            updatedAt: Date.now(),
            sources: [...inv.sources, source],
        };
        const updated = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
    }
    /** Remove a source from an investigation by relative path. */
    async removeSource(investigationId, relativePath) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        const idx = file.investigations.findIndex(inv => inv.id === investigationId);
        if (idx < 0) {
            return;
        }
        const inv = file.investigations[idx];
        const filtered = inv.sources.filter(s => s.relativePath !== relativePath);
        if (filtered.length === inv.sources.length) {
            return;
        }
        const updatedInv = {
            ...inv,
            updatedAt: Date.now(),
            sources: filtered,
        };
        const updated = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
    }
    /** Delete an investigation. */
    async deleteInvestigation(id) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        const filtered = file.investigations.filter(inv => inv.id !== id);
        if (filtered.length === file.investigations.length) {
            return;
        }
        const updated = { ...file, investigations: filtered };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
        const activeId = await (0, investigation_store_workspace_1.getActiveInvestigationId)(this.context);
        if (activeId === id) {
            await this.setActiveInvestigationId(undefined);
        }
    }
    /** Update an investigation's notes. */
    async updateNotes(id, notes) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        const idx = file.investigations.findIndex(inv => inv.id === id);
        if (idx < 0) {
            return;
        }
        const inv = file.investigations[idx];
        const updatedInv = {
            ...inv,
            updatedAt: Date.now(),
            notes: notes.trim() || undefined,
        };
        const updated = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
    }
    /** Update an investigation's name. */
    async updateName(id, name) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        const idx = file.investigations.findIndex(inv => inv.id === id);
        if (idx < 0) {
            return;
        }
        const inv = file.investigations[idx];
        const updatedInv = {
            ...inv,
            updatedAt: Date.now(),
            name: name.trim(),
        };
        const updated = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
    }
    /** Update an investigation's last search query. */
    async updateLastSearchQuery(id, query) {
        const file = await (0, investigation_store_io_1.loadInvestigationsFile)();
        const idx = file.investigations.findIndex(inv => inv.id === id);
        if (idx < 0) {
            return;
        }
        const inv = file.investigations[idx];
        const updatedInv = {
            ...inv,
            lastSearchQuery: query?.trim() || undefined,
        };
        const updated = {
            ...file,
            investigations: [
                ...file.investigations.slice(0, idx),
                updatedInv,
                ...file.investigations.slice(idx + 1),
            ],
        };
        await (0, investigation_store_io_1.saveInvestigationsFile)(updated);
        this._onDidChange.fire();
    }
    /** Get the active investigation ID (stored in workspace state). */
    async getActiveInvestigationId() {
        return (0, investigation_store_workspace_1.getActiveInvestigationId)(this.context);
    }
    /** Set the active investigation ID. Pass undefined to deactivate. */
    async setActiveInvestigationId(id) {
        await (0, investigation_store_workspace_1.setActiveInvestigationId)(this.context, id);
        this._onDidChange.fire();
    }
    /** Get the active investigation (convenience method). */
    async getActiveInvestigation() {
        const id = await this.getActiveInvestigationId();
        if (!id) {
            return undefined;
        }
        return this.getInvestigation(id);
    }
    /** Get recent investigation IDs (most recent first, max 5). */
    async getRecentInvestigationIds() {
        return (0, investigation_store_workspace_1.getRecentInvestigationIds)(this.context);
    }
    /** Get search history (most recent first). */
    async getSearchHistory() {
        return (0, investigation_store_workspace_1.getSearchHistory)(this.context);
    }
    /** Add a query to search history. */
    async addToSearchHistory(query) {
        await (0, investigation_store_workspace_1.addToSearchHistory)(this.context, query);
    }
    /** Clear search history. */
    async clearSearchHistory() {
        await (0, investigation_store_workspace_1.clearSearchHistory)(this.context);
    }
}
exports.InvestigationStore = InvestigationStore;
//# sourceMappingURL=investigation-store.js.map