/**
 * Merges extracted patterns with persisted suggestions and workspace exclusions.
 */

import * as crypto from "node:crypto";
import * as vscode from "vscode";
import type { PersistedRuleSuggestion } from "./learning-store";
import { LearningStore } from "./learning-store";
import { extractPatterns, type ExtractedPattern } from "./pattern-extractor";
import { applyFeedback, buildFeedback } from "./confidence-feedback";

export interface RuleSuggestion {
    id: string;
    pattern: string;
    description: string;
    impact: {
        linesAffected: number;
        percentageReduction: number;
    };
    confidence: number;
    status: "pending" | "accepted" | "rejected";
    sampleLines: readonly string[];
}

export class SuggestionEngine {
    constructor(private readonly store: LearningStore) {}

    private describePattern(p: ExtractedPattern): string {
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

    private async estimateTotalLines(): Promise<number> {
        const batches = await this.store.loadRecentBatches(30);
        return batches.reduce((n, b) => n + b.interactions.length, 0);
    }

    private impact(matchCount: number, totalLines: number): RuleSuggestion["impact"] {
        const linesAffected = Math.max(1, matchCount);
        const pct =
            totalLines > 0 ? Math.min(99, Math.round((100 * matchCount) / totalLines)) : Math.min(99, matchCount * 5);
        return { linesAffected, percentageReduction: pct };
    }

    /**
     * Recompute pending suggestions from recent interactions and return pending rows for UI/notifications.
     */
    async refreshAndListPending(): Promise<RuleSuggestion[]> {
        const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
        const minConfidence = cfg.get<number>("learning.minConfidence", 0.8);
        const exclusions = cfg.get<string[]>("exclusions", []);

        const batches = await this.store.loadRecentBatches(30);
        const interactions = batches.flatMap((b) => b.interactions);
        const totalLines = await this.estimateTotalLines();

        const patterns = extractPatterns(interactions, minConfidence, exclusions);
        const existing = await this.store.listSuggestions();
        const pendingByPattern = new Map(
            existing.filter((s) => s.status === "pending").map((s) => [s.pattern, s]),
        );

        const candidates: PersistedRuleSuggestion[] = patterns
            .map((p) => {
                const prev = pendingByPattern.get(p.pattern);
                // Plan 053-C: fold the user's prior accept/reject judgments into confidence so a
                // rejected pattern (and its near-twins) is damped, an accepted one is reinforced.
                const adjusted = applyFeedback(p.confidence, buildFeedback(p.pattern, existing));
                return {
                    id: prev?.id ?? crypto.randomUUID(),
                    pattern: p.pattern,
                    description: this.describePattern(p),
                    confidence: adjusted,
                    status: "pending" as const,
                    createdAt: prev?.createdAt ?? Date.now(),
                    sampleLines: p.sampleLines.slice(0, 3),
                    category: p.category,
                    matchCount: p.matchCount,
                };
            })
            // A pattern penalized below the confidence floor by feedback drops out entirely —
            // this is how rejecting one pattern suppresses the similar ones the extractor re-emits.
            .filter((c) => c.confidence >= minConfidence);

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

    async listPendingSuggestions(): Promise<RuleSuggestion[]> {
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
