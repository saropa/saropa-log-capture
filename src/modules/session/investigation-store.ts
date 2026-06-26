/**
 * Workspace-state persistence for Investigation Groups (cross-session-analysis idea #2).
 *
 * Investigations persist in `context.workspaceState` (private, per-workspace, no extra files). The
 * shareable `reports/.investigations.json` variant the plan raised as an open question is a heavier
 * follow-up — workspace state is the simpler default and keeps a half-finished investigation out of
 * the user's git tree. All list logic lives in the pure `investigation-model.ts`; this class only
 * adds id/timestamp minting, the Memento read/write, and a change event for UI refresh.
 */

import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import {
    type Investigation,
    upsertInvestigation,
    removeInvestigationById,
    renameInvestigation,
    setInvestigationNotes,
    addSessionKey,
    removeSessionKey,
    findById,
    investigationsContaining,
} from './investigation-model';

/** workspaceState key under which the investigation array is stored. */
const STORE_KEY = 'saropaLogCapture.investigations';

/** Memento-backed CRUD store. One instance per extension activation. */
export class InvestigationStore implements vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    /** Fires after any successful mutation so the UI can refresh. */
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly memento: vscode.Memento) {}

    /** All investigations, newest-created first (a fresh copy — callers may not mutate it). */
    getAll(): Investigation[] {
        const list = this.memento.get<Investigation[]>(STORE_KEY, []);
        return [...list].sort((a, b) => b.createdAt - a.createdAt);
    }

    /** One investigation by id, or undefined. */
    get(id: string): Investigation | undefined {
        return findById(this.getAll(), id);
    }

    /** Every investigation containing a given session key (a session may be in several). */
    containing(key: string): Investigation[] {
        return investigationsContaining(this.getAll(), key);
    }

    /** Create a new, empty investigation with the given title and return it. */
    async create(title: string): Promise<Investigation> {
        const inv: Investigation = {
            id: crypto.randomUUID(),
            title,
            notes: '',
            sessionKeys: [],
            createdAt: Date.now(),
        };
        await this.persist(upsertInvestigation(this.getAll(), inv));
        return inv;
    }

    /** Replace an investigation's title. */
    async rename(id: string, title: string): Promise<void> {
        await this.persist(renameInvestigation(this.getAll(), id, title));
    }

    /** Replace an investigation's notes. */
    async setNotes(id: string, notes: string): Promise<void> {
        await this.persist(setInvestigationNotes(this.getAll(), id, notes));
    }

    /** Add a session key to an investigation (de-duplicated by the model). */
    async addSession(id: string, key: string): Promise<void> {
        await this.persist(addSessionKey(this.getAll(), id, key));
    }

    /** Remove a session key from an investigation. */
    async removeSession(id: string, key: string): Promise<void> {
        await this.persist(removeSessionKey(this.getAll(), id, key));
    }

    /** Delete an investigation entirely. */
    async delete(id: string): Promise<void> {
        await this.persist(removeInvestigationById(this.getAll(), id));
    }

    /** Write the new list and notify listeners. */
    private async persist(list: readonly Investigation[]): Promise<void> {
        await this.memento.update(STORE_KEY, list);
        this._onDidChange.fire();
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
