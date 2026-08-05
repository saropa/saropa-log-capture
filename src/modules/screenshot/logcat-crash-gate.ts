/**
 * Decides which logcat lines are worth a screenshot (plan 114 follow-up).
 *
 * WHY this exists: profile-mode Flutter runs emit no console exception banners, so the
 * device's own crash line is the only error signal a profile session produces. But the
 * logcat feed replays the entire device buffer at session start — days-old crashes stream
 * past on every launch and must never fire a capture.
 *
 * WHY NOT compare the device timestamp to the host clock: logcat stamps are DEVICE-local
 * with no timezone and no year. A device on a different timezone than the workstation
 * (UTC device, EDT host — routine) shifts every stamp by hours, so an absolute
 * "within N minutes of now" test rejects genuinely fresh crashes and the feature silently
 * does nothing. Verified: a 4-hour offset reads as a 240-minute delta.
 *
 * The gate is therefore timezone-immune — it never compares device time to host time:
 *   1. REPLAY-DRAIN DETECTION — the startup buffer dump arrives as one continuous flood
 *      (728 lines inside 2ms in a real capture); nothing triggers until the feed first
 *      PAUSES. This covers the initial dump, whose stamps climb chronologically and would
 *      otherwise each look "current" relative to the running watermark. Watching for the
 *      pause rather than waiting a fixed interval is what keeps a slow device or an
 *      oversized buffer from expiring the window mid-dump.
 *   2. DEVICE-CLOCK WATERMARK — a line must be within STALE_WINDOW_MS of the newest device
 *      stamp seen. Both sides come from the same parser, so the timezone offset cancels
 *      exactly. This covers a MID-SESSION re-dump (logcat respawn after a device
 *      reconnect), where the watermark already sits at live time and replayed history
 *      falls far below it.
 *   3. CATCH-UP RATE — a line whose device-time jump outruns the elapsed arrival time is
 *      the feed fast-forwarding through history, not the app running. This is what holds
 *      when a host stall mid-dump fakes the pause in (1); without it, replayed crashes
 *      arriving after the false pause read as live (proved by test, not assumed).
 */

import { getDeviceTier } from '../analysis/device-tag-tiers';
import { parseLogcatLine } from '../integrations/adb-logcat-parser';

/**
 * Fields of the canonical parser's `timestamp` string (`MM-DD HH:MM:SS.mmm`). The line
 * shape itself is NOT re-parsed here — `parseLogcatLine` owns that, so the two cannot
 * drift on a format change.
 */
const stampFields = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

/**
 * Arrival gap that marks the startup dump as drained. The buffer replay arrives as a
 * continuous flood (728 lines inside 2ms in a real capture); live output always has
 * human-scale pauses between lines. Detecting the PAUSE rather than waiting a fixed
 * interval keeps the gate correct on a slow device or a huge buffer, where a fixed
 * window would expire mid-dump and let replayed history through.
 */
const BURST_GAP_MS = 750;

/**
 * Backstop for a device that never pauses (a genuinely chatty feed): after this much
 * arrival time the dump is treated as drained regardless. Chosen well above any observed
 * drain and below the point where a user would reasonably expect captures to work.
 */
const BURST_MAX_MS = 30_000;

/** How far behind the newest device stamp a line may sit and still count as live. */
const STALE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Device-time advance allowed to exceed the elapsed arrival time before a line is judged
 * to be buffer catch-up rather than live output. Live output advances both clocks together
 * (a quiet minute on the device is a quiet minute on the wire); replay fast-forwards
 * through hours of history in milliseconds. This is the defence that survives a FALSE
 * pause — a host stall mid-dump that looks like the feed going quiet — where the burst
 * latch opens early and every following replayed line would otherwise sit within the
 * stale window of the watermark it just advanced.
 */
const CATCHUP_SLACK_MS = 5000;

/** A device stamp is treated as the PREVIOUS year when it sits this far ahead of the watermark. */
const YEAR_ROLLOVER_GUARD_MS = 180 * 24 * 60 * 60 * 1000;

/** One parsed logcat line. `stampMs` is only ever compared to other `stampMs` values. */
export interface LogcatLineFacts {
    readonly level: string;
    readonly tag: string;
    /**
     * Device timestamp as epoch ms, built in HOST-local time from device-local fields.
     * The resulting absolute value is meaningless on its own — the timezone offset is
     * baked in — but is exact for device-to-device comparison, which is all this gate does.
     */
    readonly stampMs: number;
}

/** Parse a threadtime logcat line; undefined when the line is not in that format. */
export function parseLogcatThreadtime(text: string, referenceYear: number): LogcatLineFacts | undefined {
    const parsed = parseLogcatLine(text);
    if (!parsed) { return undefined; }
    const m = stampFields.exec(parsed.timestamp);
    if (!m) { return undefined; }
    const stampMs = new Date(
        referenceYear, Number(m[1]) - 1, Number(m[2]),
        Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]),
    ).getTime();
    return { level: parsed.level, tag: parsed.tag, stampMs };
}

/**
 * Per-session gate. One instance per capturer; state is the feed's first-arrival anchor
 * and the newest device stamp observed.
 */
export class LogcatCrashGate {
    private firstArrivalMs = 0;
    private lastArrivalMs = 0;
    private drained = false;
    private watermarkMs = 0;
    private suppressedCrashes = 0;

    /**
     * How many capture-worthy crash lines were rejected as replay. The thresholds here are
     * reasoned from one observed device; this counter is how a WRONG threshold becomes
     * visible instead of looking like "the feature does nothing" — the caller reports it
     * when a session ends having captured nothing.
     */
    get suppressedCrashCount(): number { return this.suppressedCrashes; }

    /**
     * Observe one logcat line and report whether it is a capture-worthy crash:
     * error-or-worse level, a device-critical tag (AndroidRuntime/ART/lowmemorykiller —
     * not the W-level binder chatter that dominates the feed), past the replay-drain
     * grace window, and current against the device-clock watermark.
     *
     * MUST be called for every logcat line, including non-crash ones — the watermark is
     * what makes a mid-session re-dump distinguishable from live output.
     */
    observe(text: string, arrivalMs: number, referenceYear: number): boolean {
        const facts = parseLogcatThreadtime(text, referenceYear);
        if (!facts) { return false; }

        // Year inference: a stamp far AHEAD of the watermark is last year's (Dec seen
        // after Jan rolled over), so pull it back a year before it can poison the mark.
        let stampMs = facts.stampMs;
        if (this.watermarkMs > 0 && stampMs - this.watermarkMs > YEAR_ROLLOVER_GUARD_MS) {
            stampMs = new Date(new Date(stampMs).setFullYear(referenceYear - 1)).getTime();
        }

        if (this.firstArrivalMs === 0) { this.firstArrivalMs = arrivalMs; }
        // The dump is drained once the feed pauses, or the backstop expires. Latched: once
        // live, a later quiet spell must not re-arm burst state (the watermark, not this
        // flag, is what rejects a mid-session re-dump). Parenthesised explicitly rather than
        // leaning on && binding tighter than || — this predicate decides whether replayed
        // crashes can fire, so it must read unambiguously.
        const sawPause = this.lastArrivalMs > 0 && (arrivalMs - this.lastArrivalMs) >= BURST_GAP_MS;
        const hitBackstop = (arrivalMs - this.firstArrivalMs) >= BURST_MAX_MS;
        if (!this.drained && (sawPause || hitBackstop)) { this.drained = true; }
        // Catch-up detection, evaluated against the PREVIOUS line: how far device time jumped
        // versus how long the wire actually took. Independent of the burst latch, so it still
        // holds when a host stall fakes the drain signal mid-dump.
        const catchingUp = this.watermarkMs > 0 && this.lastArrivalMs > 0
            && (stampMs - this.watermarkMs) > (arrivalMs - this.lastArrivalMs) + CATCHUP_SLACK_MS;
        // Monotonic guard: a clock adjustment or out-of-order delivery must not manufacture a
        // pause on the NEXT line by leaving lastArrivalMs in the future.
        this.lastArrivalMs = Math.max(this.lastArrivalMs, arrivalMs);
        const isCurrent = this.watermarkMs > 0 && stampMs >= this.watermarkMs - STALE_WINDOW_MS;
        if (stampMs > this.watermarkMs) { this.watermarkMs = stampMs; }

        // Level/tag first so the suppression counter only tallies lines that WOULD have
        // captured — a count of rejected noise would say nothing about threshold accuracy.
        if (facts.level !== 'E' && facts.level !== 'F' && facts.level !== 'A') { return false; }
        if (getDeviceTier(facts.tag) !== 'device-critical') { return false; }
        if (!this.drained || !isCurrent || catchingUp) {
            this.suppressedCrashes++;
            return false;
        }
        return true;
    }
}
