# L1: Extension-Aware Staleness Message

## Status: Implemented (2026-03-15)

## Summary

When `violations.json` is stale (>24 hours), the "Known Lint Issues" section in bug reports currently says:

> Lint data may be stale (analyzed 2 days ago). Run `dart run custom_lint` to refresh.

This is wrong for users who use the Saropa Lints VS Code extension — they should be told to "Run analysis in Saropa Lints" instead. The CLI command `dart run custom_lint` is deprecated for extension users (I4 in the extension BUILD_LIST).

## Current Behavior

**File:** `src/modules/bug-report/bug-report-lint-section.ts` — `formatStaleness()`

```typescript
function formatStaleness(timestamp: string): string {
    const ms = Date.parse(timestamp);
    if (isNaN(ms)) { return '> Lint data may be stale. Run `dart run custom_lint` to refresh.'; }
    const days = Math.floor((Date.now() - ms) / 86_400_000);
    const age = days === 1 ? '1 day ago' : `${days} days ago`;
    return `> Lint data may be stale (analyzed ${age}). Run \`dart run custom_lint\` to refresh.`;
}
```

The staleness threshold is `24 * 60 * 60 * 1000` (24 hours), defined in `lint-violation-reader.ts`.

## Detection Strategy

The extension writes reports to `reports/YYYYMMDD/YYYYMMDD_HHMMSS_saropa_extension.md`. If **any** file matching `*_saropa_extension.md` exists under `reports/`, the user has the extension installed and active. This is the cheapest reliable detection — no config reads, no extension API calls, no settings.

**Alternative considered:** Check for `.vscode/extensions.json` or `settings.json` for `saropaLints.enabled`. Rejected — `.vscode/` is often gitignored and settings may not be committed. The extension report file is a definitive signal that the extension is installed and has been used.

**Alternative considered:** Check if `violations.json` was written by the extension vs CLI. The file is identical regardless of source (same writer in the Dart plugin). The extension report file is the only distinguishing artifact.

## Proposed Changes

### 1. Add extension detection to `lint-violation-reader.ts`

Add a field to `LintReportData`:

```typescript
export interface LintReportData {
    readonly matches: readonly LintViolation[];
    readonly totalInExport: number;
    readonly tier: string;
    readonly version?: string;
    readonly timestamp: string;
    readonly isStale: boolean;
    readonly hasExtension: boolean;  // NEW: true if extension report files exist
}
```

Add a detection function:

```typescript
/** Check if the Saropa Lints extension has been used (extension report files exist). */
async function detectExtension(wsRoot: vscode.Uri): Promise<boolean> {
    const reportsUri = vscode.Uri.joinPath(wsRoot, 'reports');
    try {
        const entries = await vscode.workspace.fs.readDirectory(reportsUri);
        // Look for date directories (YYYYMMDD) that may contain extension reports.
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.Directory || !/^\d{8}$/.test(name)) continue;
            const dirUri = vscode.Uri.joinPath(reportsUri, name);
            const files = await vscode.workspace.fs.readDirectory(dirUri);
            if (files.some(([f]) => f.endsWith('_saropa_extension.md'))) return true;
        }
    } catch { /* reports/ doesn't exist or can't be read */ }
    return false;
}
```

Call `detectExtension(wsRoot)` in `findLintMatches()` and pass the result to `buildResult()`.

### 2. Update staleness message in `bug-report-lint-section.ts`

```typescript
function formatStaleness(timestamp: string, hasExtension: boolean): string {
    const refreshHint = hasExtension
        ? 'Run analysis in Saropa Lints to refresh.'
        : 'Run `dart run custom_lint` to refresh.';
    const ms = Date.parse(timestamp);
    if (isNaN(ms)) { return `> Lint data may be stale. ${refreshHint}`; }
    const days = Math.floor((Date.now() - ms) / 86_400_000);
    const age = days === 1 ? '1 day ago' : `${days} days ago`;
    return `> Lint data may be stale (analyzed ${age}). ${refreshHint}`;
}
```

Update `formatLintSection()` to pass `data.hasExtension` to `formatStaleness()`.

### 3. Update `formatSource()` for consistency

The source line currently says `dart run custom_lint`. When the extension is detected, omit the CLI reference or keep it neutral:

```
> Source: saropa_lints v4.14.0, comprehensive tier, analyzed 2026-02-09T14:30Z
```

No change needed — `formatSource()` doesn't mention CLI commands. Only the staleness message changes.

## Files Changed

| File | Change |
|------|--------|
| `src/modules/misc/lint-violation-reader.ts` | Add `hasExtension` to `LintReportData`, add `detectExtension()`, call in `findLintMatches()` |
| `src/modules/bug-report/bug-report-lint-section.ts` | Update `formatStaleness()` to accept `hasExtension`, update `formatLintSection()` call |

## Tests

| Test | Description |
|------|-------------|
| `hasExtension true` | When extension report exists, staleness message says "Run analysis in Saropa Lints" |
| `hasExtension false` | When no extension report exists, staleness message says "Run `dart run custom_lint`" |
| `no reports dir` | `detectExtension` returns false gracefully |
| `empty reports dir` | `detectExtension` returns false |
| `extension report in nested date dir` | `detectExtension` finds `reports/20260315/..._saropa_extension.md` |

## Estimated Size

~30 lines new code (detection function + message change). 2 files modified. 5 new test cases.

## Dependencies

None. This is a self-contained change to the Log Capture codebase. The detection relies on the extension report writer pattern already implemented in Saropa Lints (committed `4a459a7b`).
