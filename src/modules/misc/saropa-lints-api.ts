/**
 * Types for the optional Saropa Lints extension API.
 *
 * When the Saropa Lints extension is installed and exposes this API, Log Capture
 * uses it to read violations and health score params without re-reading the file.
 * Fallback: read reports/.saropa_lints/violations.json from disk and use built-in constants.
 *
 * Extension id: saropa.saropa-lints
 * Consumer: getExtension('saropa.saropa-lints') then ext.exports (or await ext.activate()).
 */

/** Shape of the violations export (same as violations.json / extension readViolations). */
export interface SaropaViolationsData {
    readonly schema?: string;
    readonly version?: string;
    readonly timestamp?: string;
    readonly config?: { readonly tier?: string };
    readonly summary?: {
        readonly totalViolations?: number;
        readonly issuesByFile?: Record<string, number>;
        readonly filesAnalyzed?: number;
        readonly byImpact?: Record<string, number>;
    };
    readonly violations?: readonly SaropaViolationItem[];
}

/** Single violation item in the export. */
export interface SaropaViolationItem {
    readonly file?: string;
    readonly line?: number;
    readonly rule?: string;
    readonly message?: string;
    readonly correction?: string;
    readonly severity?: string;
    readonly impact?: string;
    readonly owasp?: { readonly mobile?: readonly string[]; readonly web?: readonly string[] };
}

/** Health score parameters (impact weights and decay rate). Must match saropa_lints healthScore.ts. */
export interface SaropaHealthScoreParams {
    readonly impactWeights: Record<string, number>;
    readonly decayRate: number;
}

/**
 * API exposed by the Saropa Lints extension from activate().
 * Other extensions get it via: getExtension('saropa.saropa-lints') then ext.exports.
 */
export interface SaropaLintsApi {
    /** In-memory/cached violations data for the current workspace. Null if no project or read failed. */
    getViolationsData(): SaropaViolationsData | null;

    /** Workspace-root-relative or absolute path to violations.json. Null if no project root. */
    getViolationsPath(): string | null;

    /** Impact weights and decay rate for health score. Null if not available. */
    getHealthScoreParams(): SaropaHealthScoreParams | null;

    /** Run full analysis (and optionally focus on given files when supported). Returns success. */
    runAnalysis(options?: { files?: string[] }): Promise<boolean>;

    /** Extension or package version for attribution and compatibility. */
    getVersion(): string;
}

/** Extension id for Saropa Lints. Use with vscode.extensions.getExtension(id). */
export const SAROPA_LINTS_EXTENSION_ID = 'saropa.saropa-lints';
