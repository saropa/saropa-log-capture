/**
 * Persists noise-learning batches and filter suggestions in workspace state (local only).
 */

import * as vscode from "vscode";
import type { InteractionBatch } from "./interaction-types";
import type { ExtractedPattern } from "./pattern-extractor";

const STORAGE_KEY = "saropaLogCapture.learning.v1";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

/** Persisted suggestion row (survives reloads; keyed by id). */
export interface PersistedRuleSuggestion {
    readonly id: string;
    readonly pattern: string;
    readonly description: string;
    readonly confidence: number;
    readonly status: SuggestionStatus;
    readonly createdAt: number;
    readonly sampleLines: readonly string[];
    readonly category: ExtractedPattern["category"];
    readonly matchCount: number;
}

export interface LearningDataV1 {
    readonly version: 1;
    batches: InteractionBatch[];
    suggestions: PersistedRuleSuggestion[];
    /** Last time we showed the "review suggestions" notification (ms). */
    lastSuggestionPromptMs: number;
}

function emptyData(): LearningDataV1 {
    return { version: 1, batches: [], suggestions: [], lastSuggestionPromptMs: 0 };
}

function parseData(raw: unknown): LearningDataV1 {
    if (!raw || typeof raw !== "object") {
        return emptyData();
    }
    const o = raw as Record<string, unknown>;
    if (o.version !== 1) {
        return emptyData();
    }
    const batches = Array.isArray(o.batches) ? (o.batches as InteractionBatch[]) : [];
    const suggestions = Array.isArray(o.suggestions) ? (o.suggestions as PersistedRuleSuggestion[]) : [];
    const lastSuggestionPromptMs = typeof o.lastSuggestionPromptMs === "number" ? o.lastSuggestionPromptMs : 0;
    return { version: 1, batches, suggestions, lastSuggestionPromptMs };
}

export class LearningStore {
    constructor(private readonly workspaceState: vscode.Memento) {}

    async load(): Promise<LearningDataV1> {
        const raw = this.workspaceState.get<unknown>(STORAGE_KEY);
        return parseData(raw);
    }

    private async save(data: LearningDataV1): Promise<void> {
        await this.workspaceState.update(STORAGE_KEY, data);
    }

    async saveBatch(batch: InteractionBatch): Promise<void> {
        const data = await this.load();
        data.batches.push(batch);
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        data.batches = data.batches.filter((b) => b.batchedAt > cutoff);
        // Cap batch count so workspace state stays bounded.
        const maxBatches = 500;
        if (data.batches.length > maxBatches) {
            data.batches = data.batches.slice(-maxBatches);
        }
        await this.save(data);
    }

    async loadRecentBatches(days: number): Promise<InteractionBatch[]> {
        const data = await this.load();
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return data.batches.filter((b) => b.batchedAt > cutoff);
    }

    /**
     * Replace pending rows with fresh candidates while preserving accepted/rejected history
     * (rejected patterns are not re-added).
     */
    async updateSuggestionsAfterExtract(candidates: readonly PersistedRuleSuggestion[]): Promise<void> {
        const data = await this.load();
        const terminal = data.suggestions.filter((s) => s.status === "accepted" || s.status === "rejected");
        const rejectedPatterns = new Set(
            terminal.filter((s) => s.status === "rejected").map((s) => s.pattern),
        );
        const freshPending = candidates.filter((c) => !rejectedPatterns.has(c.pattern));
        data.suggestions = [...terminal, ...freshPending];
        await this.save(data);
    }

    async setSuggestionStatus(id: string, status: SuggestionStatus): Promise<void> {
        const data = await this.load();
        data.suggestions = data.suggestions.map((s) => (s.id === id ? { ...s, status } : s));
        await this.save(data);
    }

    async setLastSuggestionPromptMs(ms: number): Promise<void> {
        const data = await this.load();
        data.lastSuggestionPromptMs = ms;
        await this.save(data);
    }

    async getLastSuggestionPromptMs(): Promise<number> {
        const data = await this.load();
        return data.lastSuggestionPromptMs;
    }

    async clearAll(): Promise<void> {
        await this.save(emptyData());
    }

    async listSuggestions(): Promise<readonly PersistedRuleSuggestion[]> {
        const data = await this.load();
        return data.suggestions;
    }
}
