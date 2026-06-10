/**
 * Optional cross-workspace global aggregates (plan 053, Workstream D).
 *
 * Generic framework noise (`[flutter]`, `Recompiling because main.dart has changed`, Android
 * `MediaCodec` warnings) is noise in *every* repo, not just this one. With explicit opt-in, a
 * high-confidence framework-class pattern the user accepted can be promoted to machine-global
 * storage so a new workspace gets reduced noise from day one without retraining.
 *
 * Privacy posture (D4): promotion is OFF by default, gated behind the deny-list
 * ({@link checkPromotionDenyList}) which is the load-bearing check, and only ever stores the
 * pattern text + category — never paths, workspace ids, or counts that could identify a project.
 * Per-workspace de-duplication (so one workspace can't inflate the "accepted in N workspaces"
 * count) is tracked in WORKSPACE state by the caller, never here, so global state holds nothing
 * workspace-identifying.
 */

import * as vscode from "vscode";
import type { ExtractedPattern } from "./pattern-extractor";
import { checkPromotionDenyList } from "./global-aggregates-denylist";

const GLOBAL_KEY = "saropaLogCapture.learning.global.v1";
const MAX_PATTERNS = 200;

/** Framework-class categories eligible for promotion. `noise` is excluded (too generic). */
const PROMOTABLE_CATEGORIES: ReadonlySet<ExtractedPattern["category"]> = new Set([
    "framework",
    "verbose",
    "repetitive",
]);

/** A promoted, machine-global pattern. Deliberately carries no workspace-identifying field. */
export interface GlobalPattern {
    readonly pattern: string;
    readonly category: ExtractedPattern["category"];
    /** How many distinct workspaces have accepted this pattern (de-duped by the caller). */
    acceptedInWorkspaces: number;
    /** Last promotion time (ms); used for FIFO eviction when the cap is hit. */
    lastPromotedAt: number;
}

interface GlobalAggregatesV1 {
    readonly version: 1;
    patterns: GlobalPattern[];
}

function parse(raw: unknown): GlobalAggregatesV1 {
    if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) {
        return { version: 1, patterns: [] };
    }
    const patterns = (raw as { patterns?: unknown }).patterns;
    return { version: 1, patterns: Array.isArray(patterns) ? (patterns as GlobalPattern[]) : [] };
}

/** Whether a category may ever be promoted. Pure — exposed for the gate and for tests. */
export function isFrameworkClass(category: ExtractedPattern["category"]): boolean {
    return PROMOTABLE_CATEGORIES.has(category);
}

/**
 * Whether a pattern is eligible for promotion: opted in, framework-class, high enough confidence,
 * and free of workspace-identifying content. Pure so the gate is fully fixture-testable.
 */
export function canPromote(
    pattern: string,
    category: ExtractedPattern["category"],
    confidence: number,
    optedIn: boolean,
): boolean {
    if (!optedIn) { return false; }
    if (!isFrameworkClass(category)) { return false; }
    // High-confidence single-workspace accept is the documented promotion bar (D1).
    if (confidence < 0.95) { return false; }
    return checkPromotionDenyList(pattern).allowed;
}

/** Machine-global store for promoted noise patterns (VS Code globalState, opt-in). */
export class GlobalAggregateStore {
    constructor(private readonly globalState: vscode.Memento) {}

    private read(): GlobalAggregatesV1 {
        return parse(this.globalState.get<unknown>(GLOBAL_KEY));
    }

    private async write(data: GlobalAggregatesV1): Promise<void> {
        await this.globalState.update(GLOBAL_KEY, data);
    }

    /** All promoted patterns (newest first). */
    list(): readonly GlobalPattern[] {
        return [...this.read().patterns].sort((a, b) => b.lastPromotedAt - a.lastPromotedAt);
    }

    /**
     * Promote a pattern (bumping its workspace-accept count if already present). Caller must have
     * already confirmed eligibility via {@link canPromote} and de-duped this workspace. Enforces
     * the 200-pattern cap with FIFO eviction by `lastPromotedAt`. `now` is injected so the caller
     * stamps the time (scripts/tests stay deterministic).
     */
    async promote(
        pattern: string,
        category: ExtractedPattern["category"],
        now: number,
    ): Promise<void> {
        const data = this.read();
        const existing = data.patterns.find((p) => p.pattern === pattern);
        if (existing) {
            existing.acceptedInWorkspaces += 1;
            existing.lastPromotedAt = now;
        } else {
            data.patterns.push({ pattern, category, acceptedInWorkspaces: 1, lastPromotedAt: now });
        }
        // FIFO eviction: drop the oldest-promoted entries when over the cap.
        if (data.patterns.length > MAX_PATTERNS) {
            data.patterns.sort((a, b) => a.lastPromotedAt - b.lastPromotedAt);
            data.patterns = data.patterns.slice(data.patterns.length - MAX_PATTERNS);
        }
        await this.write(data);
    }

    /** Wipe all global aggregates (the "Clear global aggregates" command, D4). */
    async clear(): Promise<void> {
        await this.globalState.update(GLOBAL_KEY, undefined);
    }
}
