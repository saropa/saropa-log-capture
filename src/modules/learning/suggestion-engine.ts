/**
 * Merges extracted patterns with persisted suggestions and workspace exclusions.
 */

import * as crypto from "node:crypto";
import * as vscode from "vscode";
import type { PersistedRuleSuggestion } from "./learning-store";
import { LearningStore } from "./learning-store";
import { extractPatterns, type ExtractedPattern } from "./pattern-extractor";
import { applyFeedback, buildFeedback } from "./confidence-feedback";
import type { GlobalAggregateStore } from "./global-aggregates";

/** Label prepended to a suggestion sourced from the user's other workspaces (plan 053-D). */
const GLOBAL_SOURCE_LABEL = "Suggested from your other workspaces: ";

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
    /**
     * @param store   workspace-scoped learning store (required).
     * @param globalStore optional cross-workspace store; when present AND the user has opted in
     *        (`learning.globalAggregates`), promoted patterns from other workspaces are merged in
     *        as labeled pending suggestions (plan 053-D). Omitted → workspace-only behavior.
     */
    constructor(
        private readonly store: LearningStore,
        private readonly globalStore?: GlobalAggregateStore,
    ) {}

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

        // Plan 053-D: merge in patterns promoted from the user's OTHER workspaces (opt-in). They
        // join as normal pending candidates, so accept/reject use the existing path — and a reject
        // is recorded in workspace state, suppressing it HERE only (other workspaces still see it).
        this.appendGlobalCandidates(candidates, pendingByPattern, cfg);

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

    /**
     * Append promoted cross-workspace patterns as pending candidates (in place). No-op unless a
     * global store is wired AND the user opted in. Patterns already present locally are skipped;
     * the rest become normal pending rows (reuse a prior id/createdAt when one exists) labeled as
     * coming from other workspaces. matchCount is 0 (no local sample), so impact shows as minimal.
     */
    private appendGlobalCandidates(
        candidates: PersistedRuleSuggestion[],
        pendingByPattern: Map<string, PersistedRuleSuggestion>,
        cfg: vscode.WorkspaceConfiguration,
    ): void {
        if (!this.globalStore || cfg.get<boolean>("learning.globalAggregates", false) !== true) { return; }
        const present = new Set(candidates.map((c) => c.pattern));
        for (const g of this.globalStore.list()) {
            if (present.has(g.pattern)) { continue; }
            const prev = pendingByPattern.get(g.pattern);
            candidates.push({
                id: prev?.id ?? crypto.randomUUID(),
                pattern: g.pattern,
                description: GLOBAL_SOURCE_LABEL + g.pattern,
                confidence: 0.95, // cleared the >0.95 promotion bar in its origin workspace
                status: "pending",
                createdAt: prev?.createdAt ?? Date.now(),
                sampleLines: [],
                category: g.category,
                matchCount: 0,
            });
        }
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
