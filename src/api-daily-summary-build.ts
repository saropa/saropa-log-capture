/**
 * Presentation helpers for the suite daily-summary API: severity totals, the
 * plain-language headline, and the failure-only Trouble items.
 *
 * The headline is composed as literal English (not l10n) to match the existing
 * Executive Summary generators it reuses the style of — flow-map-report.ts builds
 * its narrative the same way (local `plural` helper, hardcoded prose). This payload
 * is a cross-tool data contract keyed by `tool: 'saropa-log-capture'` alongside
 * stable English command ids; the consuming sibling owns final presentation.
 */

import * as vscode from 'vscode';
import type { LoadedMeta } from './modules/session/metadata-loader';
import type { RecurringSignalEntry } from './modules/misc/recurring-signal-builder';
import type { SaropaDailyTroubleItem } from './api-types';
import { countSeveritiesChunked, extractBody } from './ui/session/session-severity-counts';

/** Total error + warning lines across a day's logs. */
export interface DaySeverityTotals {
    readonly errors: number;
    readonly warnings: number;
}

/**
 * Sum error/warning line counts for the day. Prefers the cached counts on each
 * `meta` (the V2 cache gate is `debugCount !== undefined`); for a file whose cache
 * was never populated — common for an old day never listed in the panel this
 * install — it scans the body on demand so the totals are real, not silently zero.
 */
export async function sumSeverities(
    logDir: vscode.Uri,
    metas: readonly LoadedMeta[],
): Promise<DaySeverityTotals> {
    let errors = 0;
    let warnings = 0;
    for (const { filename, meta } of metas) {
        if (meta.debugCount !== undefined) {
            errors += meta.errorCount ?? 0;
            warnings += meta.warningCount ?? 0;
            continue;
        }
        const scanned = await scanFileSeverities(logDir, filename);
        errors += scanned.errors;
        warnings += scanned.warnings;
    }
    return { errors, warnings };
}

/**
 * Same 25 MiB ceiling the deferred severity scan uses (session-severity-scan.ts). An
 * oversized report deliberately never gets a cached count (to avoid a huge readFile); the
 * on-demand fallback must honor the same guard or it would re-introduce that extension-host
 * memory blowup here. Kept as a local const, matching the pattern already duplicated across
 * session-severity-scan.ts / session-pin.ts / loaded-file-metadata.ts.
 */
const maxSeverityScanBytes = 25 * 1024 * 1024;

/** Read one log file and count its error/warning lines. Oversized/missing/unreadable → zeros. */
async function scanFileSeverities(logDir: vscode.Uri, filename: string): Promise<DaySeverityTotals> {
    try {
        const uri = vscode.Uri.joinPath(logDir, filename);
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.size > maxSeverityScanBytes) { return { errors: 0, warnings: 0 }; }
        const bytes = await vscode.workspace.fs.readFile(uri);
        const body = extractBody(new TextDecoder().decode(bytes));
        const counts = await countSeveritiesChunked(body);
        return { errors: counts.errors, warnings: counts.warnings };
    } catch {
        return { errors: 0, warnings: 0 };
    }
}

/** `3 errors` / `1 warning` — hardcoded English pluralization, matching flow-map-report.ts. */
function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** One plain-language sentence summarizing the day for a caller's executive summary. */
export function buildHeadline(
    sessions: number,
    totals: DaySeverityTotals,
    topSignal: RecurringSignalEntry | undefined,
): string {
    const sessionText = plural(sessions, 'log session');
    if (totals.errors === 0 && totals.warnings === 0) {
        return `${sessionText} with no errors or warnings.`;
    }
    // Only name the non-zero severities so a warnings-only day doesn't read "0 errors and …".
    const issues: string[] = [];
    if (totals.errors > 0) { issues.push(plural(totals.errors, 'error')); }
    if (totals.warnings > 0) { issues.push(plural(totals.warnings, 'warning')); }
    let headline = `${sessionText} with ${issues.join(' and ')}`;
    // Name the highest-impact recurring signal so the caller's one-liner points somewhere.
    if (topSignal) {
        headline += `. Top issue: ${topSignal.label}`;
    }
    return `${headline}.`;
}

/** Cap on Trouble items — a caller's section is a short list, not the full signal table. */
const maxTroubleItems = 10;

/**
 * Failure-only items for the caller's Trouble section: the day's critical/high signals,
 * each carrying a deep-link into Log Capture's Signal panel. `openSignal` expects the
 * `${kind}:${fingerprint}` id documented in commands-suite.ts.
 */
export function buildTrouble(signals: readonly RecurringSignalEntry[]): SaropaDailyTroubleItem[] {
    return signals
        .filter((s) => s.severity === 'critical' || s.severity === 'high')
        .slice(0, maxTroubleItems)
        .map((s) => ({
            label: s.label,
            detail: s.detail ?? `${plural(s.totalOccurrences, 'occurrence')} across ${plural(s.sessionCount, 'log')}`,
            command: 'saropaLogCapture.openSignal',
            args: { id: `${s.kind}:${s.fingerprint}` },
        }));
}
