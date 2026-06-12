/**
 * Pure helper for the local issue-archive set. The Play Reporting API is read-only, so "archive" is a
 * local view filter (hide an issue you've triaged), not an upstream close. Kept free of `vscode` so it
 * is unit-testable; the file read/write that persists the set lives in `crashlytics-io.ts`.
 */

/** Add or remove an id from the archived list (no duplicates). Pure. */
export function toggleArchivedId(ids: readonly string[], id: string, archived: boolean): string[] {
    const without = ids.filter(x => x !== id);
    return archived ? [...without, id] : without;
}
