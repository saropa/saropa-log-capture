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

/** Controller = the day's tree root (the workspace's own session); peripherals nest under it. */
export type SessionRole = 'controller' | 'peripheral';

/** Inputs the role classifier reads. Adds the user's `role` override to the kind inputs. */
export interface SessionRoleInput extends SessionKindInput {
    /** Explicit Controller/Peripheral override from `SessionMeta.role`. */
    readonly role?: SessionRole;
}

/** True when a candidate name (header `Project:` or displayName) matches the workspace folder name. */
function matchesWorkspaceFolder(candidate: string | undefined, workspaceFolderName: string | undefined): boolean {
    if (!workspaceFolderName || !candidate) { return false; }
    return normalize(candidate) === normalize(workspaceFolderName);
}

/**
 * Decide whether a session is the day's Controller (the workspace's own app/debug session that
 * peripheral tool logs nest beneath) or a Peripheral.
 *
 * Rule order matters — earlier wins:
 *   1. Explicit `role` override (user's manual decision via context menu).
 *   2. displayName appears in the user's `controllerNames` list → controller.
 *   3. header `Project:` OR displayName matches the workspace folder name → controller.
 *      (This is what makes the "Contacts" log a controller but "Contacts Drift Advisor" — whose
 *      displayName differs and whose header project is the analysed project — a peripheral.)
 *   4. Default → peripheral. Fail-safe: an unmatched log nests rather than becoming a stray root,
 *      so a misclassification can only ever demote, never spawn a spurious top-level controller.
 *      This default subsumes the "report ⇒ peripheral" case (a `kind: 'report'` log never matches
 *      the controller rules above), so no separate kind check is needed.
 *
 * @param controllerNames Normalized-on-read list of displayName strings the user pinned as controllers.
 * @param workspaceFolderName Active workspace folder name for the header/displayName match.
 */
export function classifySessionRole(
    input: SessionRoleInput,
    controllerNames: readonly string[],
    workspaceFolderName?: string,
): SessionRole {
    if (input.role === 'controller' || input.role === 'peripheral') {
        return input.role;
    }
    const name = input.displayName;
    if (typeof name === 'string' && name.length > 0) {
        const normalizedName = normalize(name);
        if (controllerNames.some(c => normalize(c) === normalizedName)) { return 'controller'; }
    }
    if (matchesWorkspaceFolder(input.project, workspaceFolderName)
        || matchesWorkspaceFolder(input.displayName, workspaceFolderName)) {
        return 'controller';
    }
    return 'peripheral';
}
