/**
 * Data model for the Session Flow Map (plan 056).
 *
 * A session is reconstructed as a directed graph: nodes are screens / tabs / dialogs the user
 * reached, edges are one-way transitions between them. Counters (visits, dwell, traversals) and an
 * issue overlay are folded onto the graph. Every node/edge can carry a source anchor (file:line) so
 * the rendered report links back to code.
 *
 * These types are pure data — no VS Code dependency — so the parser, builder, and mermaid/report
 * formatters are all unit-testable without the Extension Host.
 */

/** A location in the target project's source, relative to the project root. */
export interface SourceAnchor {
    readonly file: string;
    readonly line?: number;
}

/** Kind of node, drives box styling and the dwell-table "Type" column. */
export type NodeKind = 'launch' | 'screen' | 'tab' | 'dialog' | 'inline' | 'unknown';

/** Severity of an issue surfaced on the timeline. */
export type IssueSeverity = 'info' | 'warn' | 'perf' | 'error';

/** A node in the flow graph: one screen / tab / dialog. */
export interface FlowNode {
    /** Normalized identity (R3) — repeated visits collapse onto one key. */
    readonly key: string;
    label: string;
    kind: NodeKind;
    visits: number;
    dwellMs: number;
    firstTsMs?: number;
    lastTsMs?: number;
    /** Categorized in-screen action counts (e.g. { Favorite: 6, Emergency: 2 }). */
    readonly actionCounts: Record<string, number>;
    readonly issues: IssueEvent[];
    source?: SourceAnchor;
    /** True when the session actually visited this node (vs. static-only/possible). */
    walked: boolean;
    /** True when joined to a source file via the static scan or crash report. */
    resolved: boolean;
}

/** A directed transition between two nodes. */
export interface FlowEdge {
    readonly from: string;
    readonly to: string;
    count: number;
    source?: SourceAnchor;
    walked: boolean;
    /** True when the transition was recovered indirectly (e.g. crash widget), not from a breadcrumb. */
    inferred?: boolean;
}

/** The assembled graph. */
export interface FlowGraph {
    readonly nodes: FlowNode[];
    readonly edges: FlowEdge[];
}

/** A navigation/action breadcrumb extracted from the log, in session order. */
export interface TimelineEvent {
    readonly tsMs: number;
    readonly clock: string;
    readonly kind: 'nav' | 'action' | 'reached' | 'viewed' | 'lifecycle';
    /** Display label hint for the target node, already cleaned of the breadcrumb prefix. */
    readonly label: string;
    /** For actions: the category (Favorite, Emergency, …) used for per-node counts. */
    readonly actionCategory?: string;
}

/** A performance / warning / error event for the issue overlay and table. */
export interface IssueEvent {
    readonly tsMs: number;
    readonly clock: string;
    readonly severity: IssueSeverity;
    readonly category: string;
    readonly detail: string;
    source?: SourceAnchor;
}

/** Parsed session header fields from the SESSION START banner. */
export interface SessionHeader {
    project?: string;
    projectRoot?: string;
    device?: string;
    branch?: string;
    commit?: string;
    version?: string;
    captureStartClock?: string;
}

/** The crashing widget recovered from a Flutter error report. */
export interface CrashInfo {
    readonly tsMs: number;
    readonly clock: string;
    readonly message: string;
    readonly widget?: string;
    source?: SourceAnchor;
}

/** Everything the log parser extracts from one session log. */
export interface ParsedLog {
    readonly header: SessionHeader;
    readonly events: TimelineEvent[];
    readonly issues: IssueEvent[];
    readonly crash?: CrashInfo;
    /** Aggregate counts for the narrative/summary (cheap, computed during parse). */
    readonly slowQueryCount: number;
    readonly repeatBatchCount: number;
    readonly lastClock?: string;
}
