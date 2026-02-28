/**
 * Per-run summary for the viewer: start/end time, duration, severity counts.
 * Used to render run separators in the list view.
 */

export interface RunSummary {
    readonly startLineIndex: number;
    readonly endLineIndex: number;
    readonly startTime: number;
    readonly endTime: number;
    readonly durationMs: number;
    readonly errors: number;
    readonly warnings: number;
    readonly perfs: number;
    readonly infos: number;
}

export interface SeveritySlice {
    readonly errors: number;
    readonly warnings: number;
    readonly perfs: number;
    readonly infos: number;
}

/**
 * Build one summary per run (segment between run starts).
 * getTimestampForLine and countSeveritiesForSlice are provided by the caller.
 */
export function getRunSummaries(
    contentLines: readonly string[],
    runStartIndices: number[],
    getTimestampForLine: (rawLine: string) => number,
    countSeveritiesForSlice: (lines: string[]) => SeveritySlice,
): RunSummary[] {
    if (runStartIndices.length === 0) { return []; }
    const result: RunSummary[] = [];
    for (let i = 0; i < runStartIndices.length; i++) {
        const startLineIndex = runStartIndices[i];
        const endLineIndex = i + 1 < runStartIndices.length
            ? runStartIndices[i + 1] - 1
            : contentLines.length - 1;
        const slice = contentLines.slice(startLineIndex, Math.min(endLineIndex + 1, contentLines.length));
        const startTime = slice.length > 0 ? getTimestampForLine(contentLines[startLineIndex]) : 0;
        const endTime = slice.length > 0 ? getTimestampForLine(contentLines[endLineIndex]) : 0;
        const durationMs = endTime >= startTime ? endTime - startTime : 0;
        const counts = countSeveritiesForSlice(slice);
        result.push({
            startLineIndex,
            endLineIndex,
            startTime,
            endTime,
            durationMs,
            errors: counts.errors,
            warnings: counts.warnings,
            perfs: counts.perfs,
            infos: counts.infos,
        });
    }
    return result;
}
