/**
 * Screenshot trigger pipeline (plan 114, workstream B).
 *
 * A LineListener on the SessionManager fan-out, following the ErrorSnackbarNotifier
 * pattern: dependencies are injected so the class is unit-testable without the
 * extension host, and every setting is read fresh per line so toggles apply without
 * a reload. Captures fire on error lines (default on), warning lines and flow-map
 * navigation entries (both default off), plus a manual command.
 *
 * Coalescing: fingerprint dedup (one capture per unique error signature), a global
 * cooldown between any two captures, and a single-in-flight guard. There is no pending
 * queue — a capture requested while one is in flight is dropped, because the screen
 * state it would record is the same frame the in-flight capture is already fetching.
 */

import { isErrorLine, isWarningLine } from '../features/error-rate-alert';
import { normalizeLine, hashFingerprint } from '../analysis/error-fingerprint-pure';
import { classifyBreadcrumb } from '../flow-map/flow-map-breadcrumbs';
import { stripAnsi } from '../capture/ansi';
import type { LineData } from '../session/session-event-bus';
import type { ScreenshotStore, ScreenshotSaveResult, ScreenshotTrigger } from './screenshot-store';

/** Cap on remembered fingerprints — bounds memory on a long noisy session. */
const MAX_SEEN = 500;

/** Longest matched-line text persisted in metadata (the gallery shows an excerpt, not the log). */
const MAX_TEXT_LEN = 300;

/** Per-trigger settings, read fresh per candidate line. */
export interface ScreenshotTriggerSettings {
    readonly onError: boolean;
    readonly onWarning: boolean;
    readonly onNavigation: boolean;
    readonly cooldownMs: number;
    readonly maxPerLog: number;
}

/** Injected dependencies — see module doc for why these are not imported directly. */
export interface ScreenshotCapturerDeps {
    /** Master toggle (`integrations.screenshots.enabled`), read fresh per line. */
    isEnabled(): boolean;
    triggerSettings(): ScreenshotTriggerSettings;
    /** WebSocket URI of the live Flutter VM Service, or undefined outside Flutter sessions. */
    getVmServiceWsUri(): string | undefined;
    capturePng(wsUri: string): Promise<Uint8Array>;
    store: ScreenshotStore;
    /** Fired after each successful save — UI surfaces (footer counter, viewer) hang off this. */
    onSaved?(logFsPath: string, result: ScreenshotSaveResult): void;
    log(message: string): void;
    /** Clock override for deterministic cooldown tests; defaults to Date.now. */
    now?(): number;
}

/** Outcome of a manual capture, mapped to user-facing toasts by the command layer. */
export type ManualCaptureOutcome = 'saved' | 'disabled' | 'noVmService' | 'capFull' | 'busy' | 'failed';

/** One admitted capture, bundled so captureAndSave stays within the parameter limit. */
interface CaptureRequest {
    readonly wsUri: string;
    readonly logFsPath: string;
    readonly trigger: ScreenshotTrigger;
    readonly text: string;
    readonly logLine: number;
    readonly maxPerLog: number;
}

/** Watches captured lines and saves VM Service screenshots on matching triggers. */
export class ScreenshotCapturer {
    private readonly seenFingerprints = new Set<string>();
    private lastCaptureAt = 0;
    private inFlight = false;
    private warnedCapFull = false;
    private readonly now: () => number;

    constructor(private readonly deps: ScreenshotCapturerDeps) {
        this.now = deps.now ?? ((): number => Date.now());
    }

    /** LineListener entry point — must never throw (line listeners run on the capture path). */
    onLine(data: LineData): void {
        if (data.isMarker || !data.logFileUri) { return; }
        if (!this.deps.isEnabled()) { return; }
        const wsUri = this.deps.getVmServiceWsUri();
        if (!wsUri) { return; }

        const settings = this.deps.triggerSettings();
        const text = stripAnsi(data.text);
        const trigger = classifyTrigger(text, data, settings);
        if (!trigger) { return; }

        if (!this.passesCoalescing(text, trigger, settings.cooldownMs)) { return; }
        this.captureAndSave({ wsUri, logFsPath: data.logFileUri, trigger, text, logLine: data.lineCount, maxPerLog: settings.maxPerLog })
            .catch((err) => this.deps.log(`screenshot: ${err instanceof Error ? err.message : String(err)}`));
    }

    /**
     * Manual capture command path: no dedup, no cooldown — an explicit user action always
     * tries. Still refused when the feature toggle is off, no VM Service is live, or a
     * capture is already in flight (the in-flight guard must hold on EVERY path: two
     * concurrent captureAndSave calls would race ScreenshotStore's read-modify-write
     * sequence numbering and could collide filenames).
     */
    async captureManual(logFsPath: string, logLine: number): Promise<ManualCaptureOutcome> {
        if (!this.deps.isEnabled()) { return 'disabled'; }
        const wsUri = this.deps.getVmServiceWsUri();
        if (!wsUri) { return 'noVmService'; }
        if (this.inFlight) { return 'busy'; }
        const { maxPerLog } = this.deps.triggerSettings();
        try {
            const saved = await this.captureAndSave({ wsUri, logFsPath, trigger: 'manual', text: '', logLine, maxPerLog });
            return saved ? 'saved' : 'capFull';
        } catch (err) {
            this.deps.log(`screenshot (manual): ${err instanceof Error ? err.message : String(err)}`);
            return 'failed';
        }
    }

    /** Dedup + cooldown + in-flight gate. Mutates state only when the capture is admitted. */
    private passesCoalescing(text: string, trigger: ScreenshotTrigger, cooldownMs: number): boolean {
        if (this.inFlight) { return false; }
        const now = this.now();
        if (now - this.lastCaptureAt < cooldownMs) { return false; }
        // Nav entries have no error signature — same screen name legitimately recurs, so
        // only the cooldown limits them. Error/warning dedup by normalized fingerprint.
        if (trigger === 'error' || trigger === 'warning') {
            const hash = hashFingerprint(normalizeLine(text));
            if (this.seenFingerprints.has(hash)) { return false; }
            this.rememberFingerprint(hash);
        }
        this.lastCaptureAt = now;
        return true;
    }

    /** Fetch the PNG and persist it; resolves false when the per-log cap refused the save. */
    private async captureAndSave(req: CaptureRequest): Promise<boolean> {
        this.inFlight = true;
        try {
            const png = await this.deps.capturePng(req.wsUri);
            const entry = {
                trigger: req.trigger,
                timestamp: this.now(),
                logLine: req.logLine,
                text: req.text.length > MAX_TEXT_LEN ? `${req.text.slice(0, MAX_TEXT_LEN - 1)}…` : req.text,
                fingerprint: req.trigger === 'error' || req.trigger === 'warning' ? hashFingerprint(normalizeLine(req.text)) : '',
            };
            const result = await this.deps.store.save(req.logFsPath, png, entry, req.maxPerLog);
            if (!result) {
                this.warnCapFullOnce(req.logFsPath, req.maxPerLog);
                return false;
            }
            this.deps.onSaved?.(req.logFsPath, result);
            return true;
        } finally {
            this.inFlight = false;
        }
    }

    /** One output-channel warning per log when the cap stops captures — not one per line. */
    private warnCapFullOnce(logFsPath: string, maxPerLog: number): void {
        if (this.warnedCapFull) { return; }
        this.warnedCapFull = true;
        this.deps.log(`screenshot: per-log cap (${maxPerLog}) reached for ${logFsPath}; further captures skipped`);
    }

    /** Record a fingerprint, evicting the oldest once the cap is reached. */
    private rememberFingerprint(hash: string): void {
        if (this.seenFingerprints.size >= MAX_SEEN) {
            const oldest = this.seenFingerprints.values().next().value;
            if (oldest !== undefined) { this.seenFingerprints.delete(oldest); }
        }
        this.seenFingerprints.add(hash);
    }
}

/** Decide which enabled trigger (if any) a line fires. Error wins over warning over nav. */
function classifyTrigger(
    text: string,
    data: LineData,
    settings: ScreenshotTriggerSettings,
): ScreenshotTrigger | undefined {
    if (settings.onError && isErrorLine(text, data.category)) { return 'error'; }
    if (settings.onWarning && isWarningLine(text)) { return 'warning'; }
    // classifyBreadcrumb runs several regexes — only pay for it when the nav trigger is on.
    if (settings.onNavigation
        && classifyBreadcrumb(text, data.timestamp.getTime(), '', data.lineCount)?.kind === 'nav') {
        return 'nav';
    }
    return undefined;
}
