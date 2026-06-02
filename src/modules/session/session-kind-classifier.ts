/**
 * Classify a captured log as `project` (debug-session / app code) or `report`
 * (auxiliary lint / audit / bundle output). Drives the Logs panel's
 * Reports-bucket grouping — see [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
 *
 * Pure function. No I/O. Called per-row during tree refresh.
 *
 * Rule order matters — earlier wins:
 *   1. Explicit `kind` override on metadata (user's manual decision).
 *   2. `debugAdapterType` set → `project` (it was a DAP debug session).
 *   3. Header `Project:` matches the workspace-folder name → `project`
 *      (an external tool captured against THIS project — still project work).
 *   4. `displayName` matches a configured report-name pattern → `report`.
 *   5. Default → `project` (fail-open; never silently bucket the unknown).
 */
export type SessionKind = 'project' | 'report';

/** Inputs the classifier reads. Mirrors `SessionMetadata` shape without coupling to it. */
export interface SessionKindInput {
    /** Explicit override from `SessionMeta.kind`. */
    readonly kind?: SessionKind;
    /** Set when the capture came from a DAP debug session. */
    readonly debugAdapterType?: string;
    /** Parsed header `Project:` line, when present. */
    readonly project?: string;
    /** User-set displayName from `SessionMeta.displayName`. */
    readonly displayName?: string;
}

/**
 * Default report-name patterns. Covers the user's observed cases without
 * needing per-provider wiring. Users can extend via the
 * `saropaLogCapture.reportsKindPatterns` setting.
 *
 * Patterns are matched case-insensitively as JavaScript regular expressions
 * against `displayName`. Anchored examples (`^Json Bundle`) protect against
 * substring collisions in custom names.
 */
export const defaultReportsKindPatterns: readonly string[] = [
    '^Saropa Lint Report\\b',
    '^Json Bundle\\b',
    '^Lint Report\\b',
    '^Audit Matrix\\b',
];

/**
 * Compile a list of pattern strings into RegExp objects. Invalid patterns
 * are dropped silently — the classifier must never throw on bad user input.
 *
 * Why exported: `classifySessionKind` accepts pre-compiled patterns so a
 * tree refresh that classifies hundreds of rows compiles each pattern once,
 * not once per row.
 */
export function compileReportPatterns(patterns: readonly string[]): RegExp[] {
    const compiled: RegExp[] = [];
    for (const p of patterns) {
        try {
            compiled.push(new RegExp(p, 'i'));
        } catch {
            // Bad regex — skip. We never throw here because the classifier
            // is called during tree render and one user typo must not blank
            // the whole panel.
        }
    }
    return compiled;
}

function normalize(s: string | undefined): string {
    return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Apply the classifier rules in order.
 *
 * @param input Fields read from `SessionMeta` plus the parsed header project.
 * @param patterns Pre-compiled report-name patterns (see `compileReportPatterns`).
 * @param workspaceFolderName Optional workspace-folder name for header match.
 */
export function classifySessionKind(
    input: SessionKindInput,
    patterns: readonly RegExp[],
    workspaceFolderName?: string,
): SessionKind {
    if (input.kind === 'project' || input.kind === 'report') {
        return input.kind;
    }
    if (typeof input.debugAdapterType === 'string' && input.debugAdapterType.length > 0) {
        return 'project';
    }
    if (workspaceFolderName && input.project) {
        if (normalize(input.project) === normalize(workspaceFolderName)) {
            return 'project';
        }
    }
    const name = input.displayName;
    if (typeof name === 'string' && name.length > 0) {
        for (const re of patterns) {
            if (re.test(name)) { return 'report'; }
        }
    }
    return 'project';
}
