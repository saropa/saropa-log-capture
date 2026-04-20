/**
 * Session summary generation for end-of-session statistics.
 * Aggregates metrics captured during the debug session.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';

/** Statistics collected during a debug session. */
export interface SessionStats {
    readonly lineCount: number;
    readonly bytesWritten: number;
    readonly durationMs: number;
    readonly partCount: number;
    readonly categoryCounts: Record<string, number>;
    readonly watchHitCounts: Record<string, number>;
    readonly floodSuppressedCount: number;
    readonly exclusionsApplied: number;
}

/** Formatted session summary for display. */
export interface SessionSummary {
    readonly title: string;
    readonly lines: string[];
    readonly stats: SessionStats;
    /** When present, "Open Log" opens this URI instead of relying on active session. */
    readonly logUri?: vscode.Uri;
}

/**
 * Generate a formatted session summary.
 */
export function generateSummary(
    filename: string,
    stats: SessionStats,
): SessionSummary {
    const lines: string[] = [];

    // Duration
    const duration = formatDuration(stats.durationMs);
    lines.push(`Duration: ${duration}`);

    // Line count
    lines.push(`Lines captured: ${stats.lineCount.toLocaleString()}`);

    // File size
    const sizeStr = formatBytes(stats.bytesWritten);
    lines.push(`File size: ${sizeStr}`);

    // Parts
    if (stats.partCount > 1) {
        lines.push(`Split into ${stats.partCount} parts`);
    }

    // Category breakdown
    const categories = Object.entries(stats.categoryCounts);
    if (categories.length > 0) {
        const catStr = categories
            .filter(([, count]) => count > 0)
            .map(([cat, count]) => `${cat}: ${count}`)
            .join(', ');
        if (catStr) {
            lines.push(`Categories: ${catStr}`);
        }
    }

    // Watch hits
    const watchHits = Object.entries(stats.watchHitCounts);
    if (watchHits.length > 0) {
        const hitStr = watchHits
            .filter(([, count]) => count > 0)
            .map(([keyword, count]) => `"${keyword}": ${count}`)
            .join(', ');
        if (hitStr) {
            lines.push(`Watch hits: ${hitStr}`);
        }
    }

    // Suppressed
    if (stats.floodSuppressedCount > 0) {
        lines.push(`Flood-suppressed: ${stats.floodSuppressedCount} messages`);
    }

    if (stats.exclusionsApplied > 0) {
        lines.push(`Exclusions applied: ${stats.exclusionsApplied}`);
    }

    // Title uses "Log Captured" per TERMINOLOGY.md — "session" is banned in
    // user-facing text. The internal concept stays "session" in code (see
    // SessionSummary/SessionStats); only the displayed title is renamed.
    return {
        title: `Log Captured: ${filename}`,
        lines,
        stats,
    };
}

/** Add logUri to a summary so "Open Log" can open the file when the session is no longer active. */
export function withLogUri(summary: SessionSummary, logUri: vscode.Uri): SessionSummary {
    return { ...summary, logUri };
}

/**
 * Format duration in a human-readable way.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
}

/**
 * Format bytes in a human-readable way.
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
}

/**
 * Show a session summary notification with Open Log and Copy Log Path buttons.
 */
export function showSummaryNotification(summary: SessionSummary): void {
    const message = `${summary.title}\n${summary.lines.join(' | ')}`;
    const openLabel = t('action.openLog');
    const copyLabel = t('action.copyLogPath');

    vscode.window.showInformationMessage(
        message,
        copyLabel,
        openLabel,
    ).then((selection) => {
        if (selection === openLabel) {
            // After finalize there is no active session; open the finalized log when we have its URI.
            if (summary.logUri) {
                void vscode.window.showTextDocument(summary.logUri);
            } else {
                void vscode.commands.executeCommand('saropaLogCapture.open');
            }
        } else if (selection === copyLabel) {
            // Copy the log file path to the clipboard for external use.
            if (summary.logUri) {
                void vscode.env.clipboard.writeText(summary.logUri.fsPath);
            }
        }
    });
}

/**
 * Create default (empty) session stats.
 */
export function defaultSessionStats(): SessionStats {
    return {
        lineCount: 0,
        bytesWritten: 0,
        durationMs: 0,
        partCount: 1,
        categoryCounts: {},
        watchHitCounts: {},
        floodSuppressedCount: 0,
        exclusionsApplied: 0,
    };
}
