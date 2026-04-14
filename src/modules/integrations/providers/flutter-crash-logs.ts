/**
 * Flutter crash logs integration: at session end, scans both the workspace root
 * AND the reports directory for flutter crash logs whose mtime falls in the
 * session time range.
 *
 * Returns a header line noting the crash and meta with the exception summary,
 * linking the Flutter CLI crash to the debug session that was running when it happened.
 *
 * Scans both locations because the standalone watcher (flutter-crash-watcher.ts)
 * may have already moved the file from workspace root to reports before the
 * session ends. Without checking both, crash logs imported mid-session would be
 * invisible to the provider.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    IntegrationProvider,
    IntegrationContext,
    IntegrationEndContext,
    Contribution,
} from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { getLogDirectoryUri } from '../../config/config';

/** Max flutter crash logs to report per session (sanity cap). */
const maxCrashLogs = 20;

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('flutterCrashLogs');
}

/**
 * Parse the `## exception` section from a Flutter crash log to get a one-line summary.
 * Returns the first non-empty line of the exception section, or undefined if not found.
 */
export function parseExceptionSummary(content: string): string | undefined {
    const marker = '## exception';
    const idx = content.indexOf(marker);
    if (idx < 0) { return undefined; }

    // Skip past the marker line and find the first non-empty line.
    const afterMarker = content.slice(idx + marker.length);
    const lines = afterMarker.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('```')) {
            // Cap at 200 chars to keep header lines readable.
            return trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed;
        }
    }
    return undefined;
}

/** Parse the `## command` section to extract which Flutter command crashed. */
export function parseCommand(content: string): string | undefined {
    const marker = '## command';
    const idx = content.indexOf(marker);
    if (idx < 0) { return undefined; }

    const afterMarker = content.slice(idx + marker.length);
    const lines = afterMarker.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        // Stop at the next section heading.
        if (trimmed.startsWith('## ')) { break; }
        if (trimmed.length > 0) { return trimmed; }
    }
    return undefined;
}

interface CrashLogEntry {
    readonly filename: string;
    readonly mtime: number;
    readonly command: string | undefined;
    readonly exception: string | undefined;
}

export const flutterCrashLogsProvider: IntegrationProvider = {
    id: 'flutterCrashLogs',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }

        const { workspaceFolder, sessionStartTime, sessionEndTime } = context;
        const cfg = context.config.integrationsFlutterCrashLogs;
        const leadMs = cfg.leadMinutes * 60 * 1000;
        const lagMs = cfg.lagMinutes * 60 * 1000;
        const fromMs = sessionStartTime - leadMs;
        const toMs = sessionEndTime + lagMs;

        // Scan workspace root for originals, and reports directory for already-imported
        // copies (the watcher may have moved the file before session end).
        const rootPath = resolveWorkspaceFileUri(workspaceFolder, '.').fsPath;
        const reportsPath = getLogDirectoryUri(workspaceFolder).fsPath;
        const rootEntries = scanFlutterCrashLogs(rootPath, fromMs, toMs);
        const reportsEntries = scanFlutterCrashLogs(reportsPath, fromMs, toMs);

        // Deduplicate: a file in reports named "flutter-crash_flutter_01.log" matches
        // a workspace root file named "flutter_01.log". Keep the reports entry if both exist.
        const seen = new Set(reportsEntries.map(e => e.filename));
        const uniqueRootEntries = rootEntries.filter(e => {
            const importedName = `flutter-crash_${e.filename}`;
            return !seen.has(importedName);
        });
        const entries = [...reportsEntries, ...uniqueRootEntries];

        if (entries.length === 0) { return undefined; }

        // Build header lines: one per crash log found.
        const headerLines: string[] = [];
        for (const entry of entries) {
            const exSummary = entry.exception ?? 'unknown error';
            const cmdPart = entry.command ? ` (${entry.command})` : '';
            headerLines.push(`\u26A0 Flutter CLI crash${cmdPart}: ${exSummary}`);
        }

        const payload = {
            count: entries.length,
            files: entries.map(e => ({
                filename: e.filename,
                mtime: e.mtime,
                command: e.command,
                exception: e.exception,
            })),
        };

        return [
            { kind: 'header', lines: headerLines },
            { kind: 'meta', key: 'flutterCrashLogs', payload },
        ];
    },
};

/** Matches original flutter crash logs: flutter_01.log, flutter_12.log, etc. */
const originalPattern = /^flutter_\d+\.log$/;

/** Matches imported flutter crash logs: flutter-crash_flutter_01.log, etc. */
const importedPattern = /^flutter-crash_flutter_\d+\.log$/;

/**
 * Scan a directory (non-recursive) for flutter crash log files with mtime in range.
 * Checks both original (flutter_XX.log) and imported (flutter-crash_flutter_XX.log) names.
 * Reads each matching file to extract exception summary and command.
 */
function scanFlutterCrashLogs(
    dir: string,
    fromMs: number,
    toMs: number,
): CrashLogEntry[] {
    let dirEntries: fs.Dirent[];
    try {
        dirEntries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    const results: CrashLogEntry[] = [];

    for (const entry of dirEntries) {
        if (results.length >= maxCrashLogs) { break; }
        if (!entry.isFile()) { continue; }
        if (!originalPattern.test(entry.name) && !importedPattern.test(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);
        let stat: fs.Stats;
        try {
            stat = fs.statSync(fullPath);
        } catch {
            continue;
        }

        // Only include files whose mtime falls in the session time window.
        if (stat.mtimeMs < fromMs || stat.mtimeMs > toMs) { continue; }

        // Read file content to extract crash details.
        let content = '';
        try {
            content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
            // If we can't read it, still report the file exists.
        }

        results.push({
            filename: entry.name,
            mtime: stat.mtimeMs,
            command: parseCommand(content),
            exception: parseExceptionSummary(content),
        });
    }

    return results;
}
