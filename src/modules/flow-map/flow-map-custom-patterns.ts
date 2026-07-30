/**
 * User-configurable flow-map capture patterns (plan 117, Phase D).
 *
 * The breadcrumb/issue heuristics in `flow-map-breadcrumbs.ts` and `flow-map-issues.ts` target one
 * app's log dialect (the `[flowmap]` tag family plus a handful of contacts-app-shaped text patterns).
 * Any other project's log gets an empty map unless it adopts those exact tags. These two settings —
 * `saropaLogCapture.flowMap.customBreadcrumbs` and `saropaLogCapture.flowMap.customIssues` — let a
 * project map its OWN log lines to nodes/actions/issues without a code change.
 *
 * Kept as a pure module (no vscode import) so the command layer can compile the raw settings values
 * once per report and thread the result into `parseLog`, keeping the parser itself free of the
 * `vscode.workspace.getConfiguration` dependency.
 */

import type { IssueEvent, IssueSeverity, NodeKind, TimelineEvent } from './flow-map-model';

/** Raw shape of one `saropaLogCapture.flowMap.customBreadcrumbs` entry (validated on compile). */
export interface CustomBreadcrumbDef {
    readonly pattern: string;
    readonly kind?: 'nav' | 'action' | 'viewed' | 'handoff';
    readonly nodeKind?: 'screen' | 'tab' | 'dialog' | 'inline' | 'external';
    readonly label?: string;
}

/** Raw shape of one `saropaLogCapture.flowMap.customIssues` entry (validated on compile). */
export interface CustomIssueDef {
    readonly pattern: string;
    readonly category: string;
    readonly severity?: 'warn' | 'perf' | 'error';
    readonly detail?: string;
}

/** One compiled, validated breadcrumb matcher — ready for `matchCustomBreadcrumb` to consult. */
interface CompiledBreadcrumb {
    readonly re: RegExp;
    readonly kind: 'nav' | 'action' | 'viewed' | 'handoff';
    readonly nodeKind?: NodeKind;
    readonly label: string;
}

/** One compiled, validated issue matcher — ready for `matchCustomIssue` to consult. */
interface CompiledIssue {
    readonly re: RegExp;
    readonly category: string;
    readonly severity: IssueSeverity;
    readonly detail: string;
}

/** Compiled custom capture patterns for one report generation. */
export interface CustomPatterns {
    readonly breadcrumbs: readonly CompiledBreadcrumb[];
    readonly issues: readonly CompiledIssue[];
}

const BREADCRUMB_KINDS = new Set(['nav', 'action', 'viewed', 'handoff']);
const NODE_KINDS = new Set(['screen', 'tab', 'dialog', 'inline', 'external']);
const ISSUE_SEVERITIES = new Set(['warn', 'perf', 'error']);

/** Empty compiled set — returned whenever the raw settings values are absent or malformed. */
const EMPTY_PATTERNS: CustomPatterns = { breadcrumbs: [], issues: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Read a non-empty string field from a raw settings object, or undefined. */
function stringField(rec: Record<string, unknown>, key: string): string | undefined {
    const v = rec[key];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Compile one user-supplied regex string. Users can paste an invalid pattern (unbalanced group,
 * bad escape); `new RegExp` throws in that case, so this MUST be wrapped — one bad entry must never
 * take down report generation for the other, valid, entries.
 */
function compileRegex(pattern: string | undefined): RegExp | undefined {
    if (!pattern) {
        return undefined;
    }
    try {
        return new RegExp(pattern);
    } catch {
        return undefined;
    }
}

/** Validate + compile one breadcrumb definition, or undefined when the pattern is missing/invalid. */
function compileBreadcrumb(raw: unknown): CompiledBreadcrumb | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const re = compileRegex(stringField(raw, 'pattern'));
    if (!re) {
        return undefined;
    }
    const kindRaw = stringField(raw, 'kind');
    const kind = (kindRaw && BREADCRUMB_KINDS.has(kindRaw) ? kindRaw : 'nav') as CompiledBreadcrumb['kind'];
    const nodeKindRaw = stringField(raw, 'nodeKind');
    const nodeKind = nodeKindRaw && NODE_KINDS.has(nodeKindRaw) ? nodeKindRaw as NodeKind : undefined;
    return { re, kind, nodeKind, label: stringField(raw, 'label') ?? '$1' };
}

/** Validate + compile one issue definition, or undefined when the pattern/category is missing/invalid. */
function compileIssue(raw: unknown): CompiledIssue | undefined {
    if (!isRecord(raw)) {
        return undefined;
    }
    const re = compileRegex(stringField(raw, 'pattern'));
    const category = stringField(raw, 'category');
    if (!re || !category) {
        return undefined;
    }
    const severityRaw = stringField(raw, 'severity');
    const severity = (severityRaw && ISSUE_SEVERITIES.has(severityRaw) ? severityRaw : 'warn') as IssueSeverity;
    return { re, category, severity, detail: stringField(raw, 'detail') ?? category };
}

/**
 * Validate + compile the two `saropaLogCapture.flowMap.*` settings arrays into ready-to-use
 * matchers. Never throws: non-array input yields an empty set, and each entry is validated
 * independently so one malformed rule never discards the rest.
 */
export function compileCustomPatterns(breadcrumbs: unknown, issues: unknown): CustomPatterns {
    if (!Array.isArray(breadcrumbs) && !Array.isArray(issues)) {
        return EMPTY_PATTERNS;
    }
    const breadcrumbList = Array.isArray(breadcrumbs) ? breadcrumbs : [];
    const issueList = Array.isArray(issues) ? issues : [];
    return {
        breadcrumbs: breadcrumbList.map(compileBreadcrumb).filter((v): v is CompiledBreadcrumb => v !== undefined),
        issues: issueList.map(compileIssue).filter((v): v is CompiledIssue => v !== undefined),
    };
}

/**
 * Apply a `$1`..`$9` capture-group template. A pattern with no capture group still needs SOME label,
 * so the template's placeholder falls back to the whole match rather than rendering an empty string.
 */
function applyLabelTemplate(template: string, m: RegExpExecArray): string {
    if (!/\$[1-9]/.test(template)) {
        return template;
    }
    if (m.length <= 1) {
        return m[0];
    }
    return template.replace(/\$([1-9])/g, (_all, n: string) => m[Number(n)] ?? '');
}

/**
 * Try every compiled custom breadcrumb against a (already ANSI-stripped) log line. Returns the
 * timing-free half of a TimelineEvent — the caller (the parser's line scanner) stamps
 * `tsMs`/`clock`/`logLine`, matching how the built-in `classifyBreadcrumb` matchers are consulted.
 */
export function matchCustomBreadcrumb(
    patterns: CustomPatterns, text: string,
): Omit<TimelineEvent, 'tsMs' | 'clock' | 'logLine'> | undefined {
    for (const def of patterns.breadcrumbs) {
        const m = def.re.exec(text);
        if (!m) {
            continue;
        }
        const label = applyLabelTemplate(def.label, m);
        return {
            kind: def.kind,
            label,
            // Handoffs are always off-app leaves unless the author overrode the node kind explicitly.
            nodeKind: def.nodeKind ?? (def.kind === 'handoff' ? 'external' : undefined),
            // Matches the heuristic-matcher convention: an action's label IS its counter category.
            actionCategory: def.kind === 'action' ? label : undefined,
        };
    }
    return undefined;
}

/** Try every compiled custom issue against a log line. Returns the timing-free half of an IssueEvent. */
export function matchCustomIssue(
    patterns: CustomPatterns, text: string,
): Omit<IssueEvent, 'tsMs' | 'clock' | 'logLine'> | undefined {
    for (const def of patterns.issues) {
        if (def.re.test(text)) {
            return { severity: def.severity, category: def.category, detail: def.detail };
        }
    }
    return undefined;
}
