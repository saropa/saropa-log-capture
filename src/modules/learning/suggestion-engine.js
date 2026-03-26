"use strict";
/**
 * Merges extracted patterns with persisted suggestions and workspace exclusions.
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
exports.SuggestionEngine = void 0;
const crypto = __importStar(require("node:crypto"));
const vscode = __importStar(require("vscode"));
const pattern_extractor_1 = require("./pattern-extractor");
class SuggestionEngine {
    store;
    constructor(store) {
        this.store = store;
    }
    describePattern(p) {
        switch (p.category) {
            case "framework":
                return `Hide framework-style messages matching ${p.pattern}`;
            case "verbose":
                return `Hide verbose lines matching ${p.pattern}`;
            case "repetitive":
                return `Hide repetitive messages like “${p.sampleLines[0]?.slice(0, 50) ?? ""}…”`;
            default:
                return `Hide lines matching ${p.pattern}`;
        }
    }
    async estimateTotalLines() {
        const batches = await this.store.loadRecentBatches(30);
        return batches.reduce((n, b) => n + b.interactions.length, 0);
    }
    impact(matchCount, totalLines) {
        const linesAffected = Math.max(1, matchCount);
        const pct = totalLines > 0 ? Math.min(99, Math.round((100 * matchCount) / totalLines)) : Math.min(99, matchCount * 5);
        return { linesAffected, percentageReduction: pct };
    }
    /**
     * Recompute pending suggestions from recent interactions and return pending rows for UI/notifications.
     */
    async refreshAndListPending() {
        const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
        const minConfidence = cfg.get("learning.minConfidence", 0.8);
        const exclusions = cfg.get("exclusions", []);
        const batches = await this.store.loadRecentBatches(30);
        const interactions = batches.flatMap((b) => b.interactions);
        const totalLines = await this.estimateTotalLines();
        const patterns = (0, pattern_extractor_1.extractPatterns)(interactions, minConfidence, exclusions);
        const existing = await this.store.listSuggestions();
        const pendingByPattern = new Map(existing.filter((s) => s.status === "pending").map((s) => [s.pattern, s]));
        const candidates = patterns.map((p) => {
            const prev = pendingByPattern.get(p.pattern);
            return {
                id: prev?.id ?? crypto.randomUUID(),
                pattern: p.pattern,
                description: this.describePattern(p),
                confidence: p.confidence,
                status: "pending",
                createdAt: prev?.createdAt ?? Date.now(),
                sampleLines: p.sampleLines.slice(0, 3),
                category: p.category,
                matchCount: p.matchCount,
            };
        });
        await this.store.updateSuggestionsAfterExtract(candidates);
        const pending = await this.store.listSuggestions();
        return pending
            .filter((s) => s.status === "pending")
            .map((s) => ({
            id: s.id,
            pattern: s.pattern,
            description: s.description,
            confidence: s.confidence,
            status: s.status,
            sampleLines: s.sampleLines,
            impact: this.impact(s.matchCount, totalLines),
        }));
    }
    async listPendingSuggestions() {
        const totalLines = await this.estimateTotalLines();
        const all = await this.store.listSuggestions();
        return all
            .filter((s) => s.status === "pending")
            .map((s) => ({
            id: s.id,
            pattern: s.pattern,
            description: s.description,
            confidence: s.confidence,
            status: s.status,
            sampleLines: s.sampleLines,
            impact: this.impact(s.matchCount, totalLines),
        }));
    }
}
exports.SuggestionEngine = SuggestionEngine;
//# sourceMappingURL=suggestion-engine.js.map