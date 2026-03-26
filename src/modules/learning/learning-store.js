"use strict";
/**
 * Persists noise-learning batches and filter suggestions in workspace state (local only).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningStore = void 0;
const STORAGE_KEY = "saropaLogCapture.learning.v1";
function emptyData() {
    return { version: 1, batches: [], suggestions: [], lastSuggestionPromptMs: 0 };
}
function parseData(raw) {
    if (!raw || typeof raw !== "object") {
        return emptyData();
    }
    const o = raw;
    if (o.version !== 1) {
        return emptyData();
    }
    const batches = Array.isArray(o.batches) ? o.batches : [];
    const suggestions = Array.isArray(o.suggestions) ? o.suggestions : [];
    const lastSuggestionPromptMs = typeof o.lastSuggestionPromptMs === "number" ? o.lastSuggestionPromptMs : 0;
    return { version: 1, batches, suggestions, lastSuggestionPromptMs };
}
class LearningStore {
    workspaceState;
    constructor(workspaceState) {
        this.workspaceState = workspaceState;
    }
    async load() {
        const raw = this.workspaceState.get(STORAGE_KEY);
        return parseData(raw);
    }
    async save(data) {
        await this.workspaceState.update(STORAGE_KEY, data);
    }
    async saveBatch(batch) {
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
    async loadRecentBatches(days) {
        const data = await this.load();
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return data.batches.filter((b) => b.batchedAt > cutoff);
    }
    /**
     * Replace pending rows with fresh candidates while preserving accepted/rejected history
     * (rejected patterns are not re-added).
     */
    async updateSuggestionsAfterExtract(candidates) {
        const data = await this.load();
        const terminal = data.suggestions.filter((s) => s.status === "accepted" || s.status === "rejected");
        const rejectedPatterns = new Set(terminal.filter((s) => s.status === "rejected").map((s) => s.pattern));
        const freshPending = candidates.filter((c) => !rejectedPatterns.has(c.pattern));
        data.suggestions = [...terminal, ...freshPending];
        await this.save(data);
    }
    async setSuggestionStatus(id, status) {
        const data = await this.load();
        data.suggestions = data.suggestions.map((s) => (s.id === id ? { ...s, status } : s));
        await this.save(data);
    }
    async setLastSuggestionPromptMs(ms) {
        const data = await this.load();
        data.lastSuggestionPromptMs = ms;
        await this.save(data);
    }
    async getLastSuggestionPromptMs() {
        const data = await this.load();
        return data.lastSuggestionPromptMs;
    }
    async clearAll() {
        await this.save(emptyData());
    }
    async listSuggestions() {
        const data = await this.load();
        return data.suggestions;
    }
}
exports.LearningStore = LearningStore;
//# sourceMappingURL=learning-store.js.map