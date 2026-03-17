/**
 * Shared type definitions for the code quality metrics integration.
 * Used by the lint reader, comment scanner, and codeQuality provider.
 */

/** Per-file quality metrics assembled by the codeQuality provider. */
export interface FileQualityMetrics {
    /** Line coverage percentage (0–100), or undefined if no coverage data. */
    readonly linePercent?: number;
    /** Lint warning count. */
    readonly lintWarnings?: number;
    /** Lint error count. */
    readonly lintErrors?: number;
    /** Top lint messages (first 3). */
    readonly lintTopMessages?: readonly string[];
    /** Comment-to-code ratio (0.0–1.0). */
    readonly commentRatio?: number;
    /** Number of exported symbols with doc comments. */
    readonly documentedExports?: number;
    /** Total exported symbols. */
    readonly totalExports?: number;
}

/** Payload for the codeQuality MetaContribution and sidecar. */
export interface CodeQualityPayload {
    /** Per-file quality metrics, keyed by workspace-relative path. */
    readonly files: Record<string, FileQualityMetrics>;
    /** Aggregate summary of referenced files. */
    readonly summary: CodeQualitySummary;
}

/** Aggregate summary across all referenced files. */
export interface CodeQualitySummary {
    readonly filesAnalyzed: number;
    readonly avgLineCoverage?: number;
    readonly totalLintWarnings: number;
    readonly totalLintErrors: number;
    readonly lowestCoverageFiles: readonly LowCoverageEntry[];
}

/** Entry for the lowest-coverage referenced files list. */
export interface LowCoverageEntry {
    readonly path: string;
    readonly linePercent: number;
}

/** Per-file lint data returned by the lint reader. */
export interface FileLintData {
    readonly warnings: number;
    readonly errors: number;
    readonly topMessages: readonly string[];
}

/** Per-file comment density data returned by the comment scanner. */
export interface FileCommentData {
    readonly commentRatio: number;
    readonly documentedExports: number;
    readonly totalExports: number;
}

/** Normalize a file path for consistent map lookups (forward slashes, lowercase, strip drive/leading slash). */
export function normalizeForLookup(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase().replace(/^[a-z]:\//i, '').replace(/^\//, '');
}
