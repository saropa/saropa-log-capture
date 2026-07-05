/**
 * Live error snackbar notifier.
 *
 * When the `showErrorSnackbars` setting is on, each newly detected error line during
 * capture pops a non-modal VS Code notification with "Open Log" (jump to the error line)
 * and "Error Report" actions. Registered as a LineListener on the SessionManager fan-out.
 *
 * Coalescing is deliberate: a busy log emits errors in bursts, and VS Code stacks
 * notifications, so a raw one-per-line policy would flood (and auto-dismiss) the corner.
 * We suppress by error fingerprint (variations of the same error — different ports, ids,
 * timestamps — normalize to one hash) AND enforce a cooldown between snackbars.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { isErrorLine } from './error-rate-alert';
import { normalizeLine, hashFingerprint } from '../analysis/error-fingerprint-pure';
import { stripAnsi } from '../capture/ansi';
import { logExtensionWarn } from '../misc/extension-logger';
import type { LineData } from '../session/session-event-bus';

/** Minimum gap between snackbars, so even distinct errors cannot stack faster than this. */
const COOLDOWN_MS = 4000;

/** Cap on remembered fingerprints — bounds memory on a long-running noisy session. */
const MAX_SEEN = 500;

/** Longest error text shown inline; non-modal messages have no `detail` line to overflow into. */
const MAX_TEXT_LEN = 120;

/**
 * Actions the notifier invokes when the user clicks a button. Injected so this module stays
 * free of viewer/command coupling and is unit-testable without the extension host wired up.
 */
export interface ErrorSnackbarDeps {
    /**
     * Whether the feature is on. Read fresh per line (the caller wires this to
     * `getConfig().showErrorSnackbars`) so toggling the setting takes effect without a reload.
     */
    isEnabled(): boolean;
    /** Open the Log Viewer on `logFileUri` and scroll to `line` (1-based). */
    openLogAtLine(logFileUri: string, line: number): Promise<void> | void;
    /** Open the error/bug report for `text` at `lineIndex` (0-based) in `logFileUri`. */
    openReport(text: string, lineIndex: number, logFileUri: string): Promise<void> | void;
    /** Clock override for deterministic cooldown tests; defaults to `Date.now`. */
    now?(): number;
}

/** Shows coalesced, cooldown-limited error notifications for live-captured lines. */
export class ErrorSnackbarNotifier {
    private readonly seenHashes = new Set<string>();
    private lastShownAt = 0;
    private readonly now: () => number;

    constructor(private readonly deps: ErrorSnackbarDeps) {
        this.now = deps.now ?? ((): number => Date.now());
    }

    /** LineListener entry point — called for every captured line. */
    onLine(data: LineData): void {
        // Markers are synthetic UI chrome, never real output; skip before any work.
        if (data.isMarker) { return; }
        // Read the setting fresh so toggling it takes effect without a reload.
        if (!this.deps.isEnabled()) { return; }
        // Need a file to point the buttons at; lines without an origin file can't be focused.
        if (!data.logFileUri) { return; }

        // Classify and fingerprint on ANSI-free text. Captured lines keep their color escapes, and an
        // SGR code's trailing letter fuses with the following word (e.g. "…[31mError"), which breaks
        // isErrorLine's `\b` word-boundary match and would silently miss colored error lines.
        const text = stripAnsi(data.text);
        if (!isErrorLine(text, data.category)) { return; }

        // Coalesce: one snackbar per unique error signature for the window lifetime.
        const hash = hashFingerprint(normalizeLine(text));
        if (this.seenHashes.has(hash)) { return; }

        // Cooldown: drop (do not queue) errors arriving too soon after the last snackbar.
        const now = this.now();
        if (now - this.lastShownAt < COOLDOWN_MS) { return; }

        this.rememberHash(hash);
        this.lastShownAt = now;
        // Capture the values now — the active session may change before the user clicks. A button
        // action (loadFromFile / showBugReport) can reject; catch here so a failed click never
        // surfaces as an unhandled rejection from this fire-and-forget call (line listeners must not throw).
        this.showSnackbar(text, data.lineCount, data.logFileUri).catch((err) => {
            logExtensionWarn('errorSnackbar', err instanceof Error ? err.message : String(err));
        });
    }

    /** Record a fingerprint, evicting the oldest once the cap is reached. */
    private rememberHash(hash: string): void {
        if (this.seenHashes.size >= MAX_SEEN) {
            const oldest = this.seenHashes.values().next().value;
            if (oldest !== undefined) { this.seenHashes.delete(oldest); }
        }
        this.seenHashes.add(hash);
    }

    /** Show the non-modal notification and route the chosen action. */
    private async showSnackbar(text: string, lineCount: number, logFileUri: string): Promise<void> {
        const openLog = t('action.openLog');
        const report = t('action.errorReport');
        const pick = await vscode.window.showWarningMessage(
            t('msg.errorSnackbar', cleanForDisplay(text, MAX_TEXT_LEN)),
            openLog,
            report,
        );
        if (pick === openLog) {
            // lineCount is 1-based, matching what scrollToLine / the go-to-line input expect.
            await this.deps.openLogAtLine(logFileUri, lineCount);
        } else if (pick === report) {
            // showBugReport wants a 0-based line index.
            await this.deps.openReport(text, lineCount - 1, logFileUri);
        }
    }
}

/**
 * Prepare an error line for a one-line notification: strip ANSI color codes (a notification renders
 * them as literal garbage) and collapse internal newlines/whitespace (captured text keeps internal
 * `\n`; only the trailing newline is stripped upstream), then truncate with an ellipsis. We do NOT
 * use `normalizeLine` here — that also masks numbers/paths/ids for fingerprinting, which would hide
 * the actual error detail the user needs to read.
 */
export function cleanForDisplay(text: string, max: number): string {
    const flattened = stripAnsi(text).replace(/\s+/g, ' ').trim();
    return flattened.length <= max ? flattened : `${flattened.slice(0, max - 1)}…`;
}
