/**
 * Shared line-count cap for the session-end scanners (error/warning fingerprint,
 * related-lines, general-signal, correlation-tag). Extracted so the cap value and
 * its truncation warning live in exactly one place (single source of truth) instead
 * of being copy-pasted into five modules.
 *
 * bug_007: the cap was previously 5,000 with no warning — errors/signals past that
 * line were silently invisible to every scanner. Raised to 50,000 (10x headroom for
 * very large sessions) and every cap hit now logs to the output channel so truncation
 * is visible instead of silent.
 */

import { logExtensionWarn } from '../misc/extension-logger';

/** Maximum lines any session-end scanner reads from a log file in one pass. */
export const MAX_SCAN_LINES = 50_000;

/**
 * Log a warning to the "Saropa Log Capture" output channel when a scan was
 * truncated by MAX_SCAN_LINES, so content past the cap is a visible, diagnosable
 * condition rather than a silent gap in fingerprints/signals/tags.
 */
export function warnIfScanCapped(scannerName: string, totalLines: number, scanLimit: number): void {
    if (totalLines <= scanLimit) { return; }
    logExtensionWarn(
        'Analysis',
        `${scannerName}: log has ${totalLines} lines, scan capped at ${scanLimit} — content past this line was not scanned.`,
    );
}
