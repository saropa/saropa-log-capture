/**
 * Suite daily-summary aggregation
 * (plan: plans/history/2026.07/2026.07.16/PLAN_suite_daily_summary_api.md).
 *
 * Backs {@link SaropaLogCaptureApi.getDailySummary}. A thin read-only projection of
 * one calendar day of the reports store — sessions, severity totals, and cross-session
 * signals — for a sibling suite tool's consolidated daily report. Built lazily from
 * disk on each call so activation is never slowed. Everything reads from persisted
 * metadata (`.session-metadata.json`) plus, only when a file's severity cache is
 * missing, the log body itself; it never needs the active session or a loaded viewer.
 */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from './modules/config/config';
import {
    listMetaFiles,
    loadMetasForPaths,
    parseSessionDate,
    type LoadedMeta,
} from './modules/session/metadata-loader';
import { buildSignalsFromMetas } from './modules/misc/cross-session-aggregator';
import type { SaropaDailySummary } from './api-types';
import { sumSeverities, buildHeadline, buildTrouble } from './api-daily-summary-build';

/** Local-time epoch-ms half-open window `[start, end)` for one calendar day. */
interface DayBounds {
    readonly start: number;
    readonly end: number;
}

/**
 * Parse `YYYY-MM-DD` to a local-day window. Local (not UTC) to match
 * `parseSessionDate`, which reads the filename stamp with the local `Date`
 * constructor. `end` is next-day local midnight so month/DST boundaries normalize.
 */
function dayBounds(date: string): DayBounds | undefined {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) { return undefined; }
    const start = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    if (Number.isNaN(start)) { return undefined; }
    const end = new Date(+m[1], +m[2] - 1, +m[3] + 1).getTime();
    return { start, end };
}

/** Load non-trashed session metadata whose filename timestamp falls within the day. */
async function dayMetas(logDir: vscode.Uri, bounds: DayBounds): Promise<readonly LoadedMeta[]> {
    const all = await listMetaFiles(logDir);
    // Filter by the filename stamp (works regardless of day-subfolder nesting;
    // parseSessionDate strips any path prefix). Unparseable names return 0 and drop out.
    const dayFiles = all.filter((f) => {
        const t = parseSessionDate(f);
        return t >= bounds.start && t < bounds.end;
    });
    const metas = await loadMetasForPaths(logDir, dayFiles);
    return metas.filter((m) => !m.meta.trashed);
}

/**
 * Count logical Sessions, not files: files sharing a `groupId` are one Session
 * (split parts, controller+peripheral). Ungrouped files each count once.
 */
function countLogicalSessions(metas: readonly LoadedMeta[]): number {
    const groups = new Set<string>();
    let ungrouped = 0;
    for (const { meta } of metas) {
        if (meta.groupId) { groups.add(meta.groupId); }
        else { ungrouped++; }
    }
    return groups.size + ungrouped;
}

/** Aggregate one calendar day into a suite summary, or `undefined` if the day has no logs. */
export async function getDailySummary(date: string): Promise<SaropaDailySummary | undefined> {
    const bounds = dayBounds(date);
    if (!bounds) { return undefined; }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }

    const logDir = getLogDirectoryUri(folder);
    const metas = await dayMetas(logDir, bounds);
    if (metas.length === 0) { return undefined; }

    // allSignals unifies error/warning/perf/SQL fingerprints and count-only signal
    // types (network, memory, …) from metadata alone — no log re-read needed.
    const signals = buildSignalsFromMetas(metas).allSignals;
    const totals = await sumSeverities(logDir, metas);
    const sessions = countLogicalSessions(metas);

    return {
        tool: 'saropa-log-capture',
        date,
        headline: buildHeadline(sessions, totals, signals[0]),
        counts: { sessions, errors: totals.errors, warnings: totals.warnings, signals: signals.length },
        trouble: buildTrouble(signals),
        // No-arg focus command — the honest "Open in Log Capture" entry point.
        openCommand: 'saropaLogCapture.logViewer.focus',
    };
}
