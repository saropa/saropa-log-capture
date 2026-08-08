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
import { classifyLogLine } from '../analysis/stack-parser';
import { LogcatCrashGate } from './logcat-crash-gate';
import { RecentShotSignatures, duplicateVerdict } from './screenshot-similarity';
import { classifyBreadcrumb } from '../flow-map/flow-map-breadcrumbs';
import { stripAnsi } from '../capture/ansi';
import type { LineData } from '../session/session-event-bus';
import type { ScreenshotStore, ScreenshotSaveResult, ScreenshotTrigger } from './screenshot-store';

/** Cap on remembered fingerprints — bounds memory on a long noisy session. */
const MAX_SEEN = 500;

/**
 * Consecutive capture failures before auto-triggers stop for the current VM Service.
 * Without this, a broken endpoint (e.g. `_flutter.screenshot` removed in a Flutter
 * upgrade) costs a 5s socket timeout per distinct error for the whole session. The
 * breaker resets when a DIFFERENT VM Service URI appears (new run) and never blocks
 * the manual command — an explicit user action is the right probe for recovery.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Longest matched-line text persisted in metadata (the gallery shows an excerpt, not the log). */
const MAX_TEXT_LEN = 300;

/** Per-trigger settings, read fresh per candidate line. */
export interface ScreenshotTriggerSettings {
    readonly onError: boolean;
    readonly onWarning: boolean;
    readonly onNavigation: boolean;
    readonly cooldownMs: number;
    readonly maxPerLog: number;
    /**
     * Skip a capture that looks like a recent one (`skipNearDuplicates`). Off by default: this is
     * the only setting in the group that DISCARDS a capture the user would otherwise have, so it
     * has to be asked for.
     */
    readonly skipNearDuplicates: boolean;
    /** Similarity at or above which a capture counts as a duplicate, 0-1. */
    readonly duplicateSimilarity: number;
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

/** What `captureAndSave` did with one admitted capture. */
type CaptureOutcome = 'saved' | 'skipped' | 'capFull';

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
    readonly skipNearDuplicates: boolean;
    readonly duplicateSimilarity: number;
}

/** Watches captured lines and saves VM Service screenshots on matching triggers. */
export class ScreenshotCapturer {
    private readonly seenFingerprints = new Set<string>();
    /** Live-vs-replay decision for the logcat feed; stateful per session (see its module doc). */
    private readonly logcatGate = new LogcatCrashGate();
    /** Recent captures' picture signatures, for near-duplicate skipping. Bounded (see its class). */
    private readonly recentShots = new RecentShotSignatures();
    /**
     * Log the signature ring currently describes. The capturer lives for the whole extension host,
     * not for one session, so without this a new run's first screenshots would be compared against
     * the PREVIOUS run's last ones and could be skipped as duplicates before the new log has a
     * single capture. A new session writes a new log file, which is the signal.
     */
    private dedupLogFsPath = '';
    /** One-time notice that captures cannot be read for comparison — never repeated per capture. */
    private warnedUnreadableShot = false;
    /** Running count of captures dropped as near-duplicates, for the report's gallery note. */
    private suppressedShots = 0;
    private lastCaptureAt = 0;
    private inFlight = false;
    private warnedCapFull = false;
    private consecutiveFailures = 0;
    /** URI the failure streak was counted against — a different URI resets the breaker. */
    private breakerUri = '';
    /** One-time "captures idle" notice — the no-URI state must not be silent forever. */
    private warnedNoUri = false;
    private readonly now: () => number;

    constructor(private readonly deps: ScreenshotCapturerDeps) {
        this.now = deps.now ?? ((): number => Date.now());
    }

    /** LineListener entry point — must never throw (line listeners run on the capture path). */
    onLine(data: LineData): void {
        if (data.isMarker || !data.logFileUri) { return; }
        // The logcat gate observes EVERY logcat line, ahead of the URI/enabled/breaker gates:
        // its replay-drain detection and device-clock watermark describe the FEED, and the
        // startup dump arrives before the VM Service is announced. Observing only post-URI
        // lines would anchor the burst detection mid-feed and mis-read a re-dump. Cost is one
        // regex per logcat line (guarded by the cheap category compare) — paid so the gate is
        // never reasoning from a partial view of its own input.
        const logcatCrash = data.category === 'logcat'
            && this.logcatGate.observe(data.text, data.timestamp.getTime(), data.timestamp.getFullYear());
        const wsUri = this.deps.getVmServiceWsUri();
        if (!wsUri) {
            // The no-URI state was invisible: error lines streamed past and nothing said why
            // captures stayed idle. Warn ONCE — but only for a line that would REALLY have been
            // a trigger. An unfiltered isErrorLine check fires on the startup logcat replay
            // burst (device noise, days-old crashes) during every healthy session, which turns
            // the diagnostic into routine false alarm. Mirror classifyTrigger's console-path
            // gating: skip the logcat feed (its own gate owns that decision) and device-other
            // noise. The flag is tested first, so the classifier cost is paid at most once.
            if (!this.warnedNoUri && data.category !== 'logcat') {
                const plain = stripAnsi(data.text);
                if (isErrorLine(plain, data.category) && classifyLogLine(plain) !== 'device-other') {
                    this.warnedNoUri = true;
                    this.deps.log('screenshot: app error seen but no VM Service address is known — captures stay idle until the debug adapter announces one or the console banner appears');
                }
            }
            return;
        }
        if (this.breakerTripped(wsUri)) { return; }
        if (!this.deps.isEnabled()) { return; }

        const settings = this.deps.triggerSettings();
        const text = stripAnsi(data.text);
        const trigger = classifyTrigger(text, data, settings, logcatCrash);
        if (!trigger) { return; }

        if (!this.passesCoalescing(text, trigger, settings.cooldownMs)) { return; }
        this.captureAndSave({
            wsUri, logFsPath: data.logFileUri, trigger, text, logLine: data.lineCount,
            maxPerLog: settings.maxPerLog,
            skipNearDuplicates: settings.skipNearDuplicates,
            duplicateSimilarity: settings.duplicateSimilarity,
        }).catch((err) => this.recordFailure(wsUri, err));
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
            // skipNearDuplicates false regardless of the setting: an explicit capture request is
            // never a duplicate to refuse (isNearDuplicate also excludes 'manual' — belt and braces,
            // because this path must not depend on that classification staying put).
            const outcome = await this.captureAndSave({
                wsUri, logFsPath, trigger: 'manual', text: '', logLine, maxPerLog,
                skipNearDuplicates: false, duplicateSimilarity: 1,
            });
            // 'skipped' is unreachable here (skipNearDuplicates is false on this path), but mapping
            // it to 'saved' would be a lie if that ever changed — report the cap instead of guessing.
            return outcome === 'saved' ? 'saved' : 'capFull';
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

    /**
     * Fetch the PNG and persist it. Names the three outcomes rather than returning a boolean: a
     * capture skipped as a near-duplicate is NOT a save, and a caller that read `true` as "persisted"
     * would misreport a discarded capture.
     */
    private async captureAndSave(req: CaptureRequest): Promise<CaptureOutcome> {
        this.inFlight = true;
        try {
            const png = await this.deps.capturePng(req.wsUri);
            if (this.isNearDuplicate(png, req)) { return 'skipped'; }
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
                return 'capFull';
            }
            this.deps.onSaved?.(req.logFsPath, result);
            return 'saved';
        } finally {
            this.inFlight = false;
        }
    }

    /**
     * Whether this capture is near-identical to a recent one and should not be saved.
     *
     * Answers the field report "many of your screenshots are identical except for the phone's
     * clock": the existing fingerprint dedup keys off the LOG LINE that triggered a capture, so two
     * navigation captures of one screen are both kept however alike the pictures are. The comparison
     * excludes the status-bar strip, which is the only region that differs between them.
     *
     * A skip is LOGGED with its similarity, never silent. A dropped capture is invisible by nature,
     * and a threshold that turns out to be wrong has to be diagnosable from the output channel
     * rather than from a reader wondering where their screenshots went.
     */
    private isNearDuplicate(png: Uint8Array, req: CaptureRequest): boolean {
        if (!req.skipNearDuplicates) { return false; }
        // Reset before comparing, never after: the first capture of a new log must be judged against
        // an empty history, not against the log that came before it.
        if (req.logFsPath !== this.dedupLogFsPath) {
            this.recentShots.clear();
            this.dedupLogFsPath = req.logFsPath;
        }
        // A manual capture is an explicit request for THIS moment; deduping it would refuse a
        // direct instruction. Fault captures are kept for the same reason the capturer already
        // fingerprints them — the picture at the moment of an error is the report's whole point.
        if (req.trigger === 'manual' || req.trigger === 'error' || req.trigger === 'warning') { return false; }
        const verdict = duplicateVerdict({
            png: Buffer.from(png), recent: this.recentShots, threshold: req.duplicateSimilarity,
        });
        if (!verdict.duplicate) {
            // "Cannot read it" is indistinguishable from "keep it" by design, which would make a
            // capture format this reader does not handle look like a setting that quietly stopped
            // working. Say it ONCE — the format will not change mid-session.
            if (verdict.unreadable && !this.warnedUnreadableShot) {
                this.warnedUnreadableShot = true;
                this.deps.log('screenshot: near-duplicate skipping is on, but this capture\'s image could not be read (unsupported PNG form) — every capture will be kept');
            }
            return false;
        }
        const pct = (verdict.similarity * 100).toFixed(1);
        this.deps.log(`screenshot: skipped a ${pct}% match of a recent capture (${req.trigger}, line ${req.logLine})`);
        this.suppressedShots++;
        // Persist so a report built from this log LATER — after the session ended, in another
        // process — can still say what was dropped. Non-fatal: a failed count write must never cost
        // the capture pipeline, which is why this is fire-and-forget with a logged failure.
        this.deps.store.noteSuppressed(req.logFsPath)
            .catch((err) => this.deps.log(`screenshot: could not record the suppressed count (${err instanceof Error ? err.message : String(err)})`));
        return true;
    }

    /** Captures dropped as near-duplicates this session — surfaced in the flow map's gallery. */
    get suppressedShotCount(): number { return this.suppressedShots; }

    /**
     * Crash lines the logcat gate rejected as replay. Reported at session end when nothing
     * was captured: the replay thresholds are reasoned from one observed device, and this is
     * how a wrong threshold shows up as a number rather than as silence.
     */
    get suppressedLogcatCrashes(): number { return this.logcatGate.suppressedCrashCount; }

    /** True when auto-triggers are suspended for this URI after repeated failures. */
    private breakerTripped(wsUri: string): boolean {
        if (this.breakerUri !== wsUri) {
            // New VM Service (new run / hot restart with a new port) — clean slate.
            this.breakerUri = wsUri;
            this.consecutiveFailures = 0;
        }
        return this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
    }

    /** Count a failed capture toward the breaker; log the trip exactly once per URI. */
    private recordFailure(wsUri: string, err: unknown): void {
        this.deps.log(`screenshot: ${err instanceof Error ? err.message : String(err)}`);
        if (this.breakerUri !== wsUri) { return; }
        this.consecutiveFailures++;
        if (this.consecutiveFailures === MAX_CONSECUTIVE_FAILURES) {
            this.deps.log(`screenshot: ${MAX_CONSECUTIVE_FAILURES} consecutive capture failures — automatic captures paused for this session (the manual command still tries)`);
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
    logcatCrash: boolean,
): ScreenshotTrigger | undefined {
    // Nothing enabled → skip the classifier regexes entirely (they are the priciest step here).
    if (!settings.onError && !settings.onWarning && !settings.onNavigation) { return undefined; }
    // Framework noise never triggers a capture. isErrorLine matches ANY logcat E/ line and any
    // "failed" text, but device-other errors are routinely benign (E/Gralloc4 allocation probes,
    // E/Badge init — see the 2026-07-28 contacts startup log): each would burn a VM round-trip +
    // PNG + disk to photograph a screen showing nothing wrong. For console/stdout relays the
    // tier classifier rules: 'device-other' is suppressed, while 'device-critical'
    // (AndroidRuntime crashes, lowmemorykiller — "real app problems, always visible" per
    // device-tag-tiers.ts) stays capturable — a FATAL EXCEPTION relay is exactly the frame
    // worth photographing.
    //
    // The logcat feed needs its own narrow gate rather than a wholesale exclusion: PROFILE-mode
    // runs (the 2026-08 contacts sessions) emit almost no console output — the framework's
    // exception banners are debug-mode only — so the logcat crash line IS the only error signal
    // a profile session produces. The verdict is computed by the gate in onLine (which sees
    // every logcat line, including the pre-URI startup dump); this branch only applies the
    // user's onError preference to it.
    if (data.category === 'logcat') {
        return logcatCrash && settings.onError ? 'error' : undefined;
    }
    const tier = classifyLogLine(text);
    if (tier === 'device-other') { return undefined; }
    if (settings.onError && isErrorLine(text, data.category)) { return 'error'; }
    if (settings.onWarning && isWarningLine(text)) { return 'warning'; }
    // classifyBreadcrumb runs several regexes — only pay for it when the nav trigger is on.
    if (settings.onNavigation
        && classifyBreadcrumb(text, data.timestamp.getTime(), '', data.lineCount)?.kind === 'nav') {
        return 'nav';
    }
    return undefined;
}
