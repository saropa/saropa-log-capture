/**
 * Caller-graph matching (cross-session-analysis idea #4).
 *
 * Answers the reverse-import question: does a candidate file import a given target file? The
 * forward direction (what a file imports) is handled by import-extractor; this matches an import
 * module path back to a target by comparing the path's final segment, extension-insensitively, so
 * `../payment/payment_handler.dart`, `package:app/payment_handler.dart`, and `./payment_handler`
 * all match the target `payment_handler.dart`.
 *
 * Pure (no vscode import) so the matching rule is unit-testable under `node --test`. The host
 * (find-callers.ts) supplies each candidate's already-extracted import module strings.
 */

/** Strip a trailing file extension from a single path segment ("a.dart" → "a", "a" → "a"). */
function stripExtension(segment: string): string {
    const dot = segment.lastIndexOf('.');
    return dot > 0 ? segment.slice(0, dot) : segment;
}

/** The final path segment of a module specifier, separator-agnostic. */
function lastSegment(modulePath: string): string {
    const parts = modulePath.split(/[/\\]/);
    return parts[parts.length - 1] || modulePath;
}

/**
 * Return the import module that references `targetFilename`, or undefined when none do. Matching
 * compares the module's last segment to the target's basename with extensions removed, so a
 * relative, package, or extensionless import all resolve to the same target. The comparison is
 * case-insensitive to tolerate case-preserving filesystems.
 */
export function findImportOfTarget(
    modules: readonly string[],
    targetFilename: string,
): string | undefined {
    const targetStem = stripExtension(lastSegment(targetFilename)).toLowerCase();
    if (!targetStem) { return undefined; }
    for (const module of modules) {
        if (stripExtension(lastSegment(module)).toLowerCase() === targetStem) {
            return module;
        }
    }
    return undefined;
}
