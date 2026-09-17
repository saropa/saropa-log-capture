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
 * Per-call overrides for the line scanners' two caps, for callers whose needs differ from the
 * session-end default.
 *
 * Both defaults exist for PRESENTATION — a sidecar stores a session's headline signals, and a
 * panel shows a short list. A caller that DIFFS two scans (`getSignalDelta`) needs neither: a
 * fingerprint dropped by the rank cap is missing from the "before" set, so it reads as newly
 * introduced the next time it occurs, and a line past the scan cap is invisible to the "before"
 * side of a comparison it did in fact appear in. Both turn into confident false positives, which
 * is worse than a short list.
 */
export interface LineScanOptions {
    /** Max fingerprints returned. Defaults to the scanner's own presentation cap. */
    readonly maxFingerprints?: number;
    /** Max lines read. Defaults to the scanner's own cap ({@link MAX_SCAN_LINES} for most). */
    readonly maxScanLines?: number;
}

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
