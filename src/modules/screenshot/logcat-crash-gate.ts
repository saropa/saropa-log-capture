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
 *   1. REPLAY-DRAIN GRACE — the startup buffer dump arrives in one tight burst (728 lines
 *      inside 2ms in a real capture), so nothing within GRACE_MS of the feed's first line
 *      can trigger. This covers the initial dump, whose stamps climb chronologically and
 *      would otherwise each look "current" relative to the running watermark.
 *   2. DEVICE-CLOCK WATERMARK — after the grace window, a line must be within
 *      STALE_WINDOW_MS of the newest device stamp seen. Both sides come from the same
 *      parser, so the timezone offset cancels exactly. This covers a MID-SESSION re-dump
 *      (logcat respawn after a device reconnect), where the watermark already sits at live
 *      time and replayed history falls far below it.
 */

import { getDeviceTier } from '../analysis/device-tag-tiers';
import { parseLogcatLine } from '../integrations/adb-logcat-parser';

/**
 * Fields of the canonical parser's `timestamp` string (`MM-DD HH:MM:SS.mmm`). The line
 * shape itself is NOT re-parsed here — `parseLogcatLine` owns that, so the two cannot
 * drift on a format change.
 */
const stampFields = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

/** Nothing captures until the startup buffer dump has drained (it arrives in milliseconds). */
const GRACE_MS = 5000;

/** How far behind the newest device stamp a line may sit and still count as live. */
const STALE_WINDOW_MS = 2 * 60 * 1000;

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
    private watermarkMs = 0;

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

        const isFirst = this.firstArrivalMs === 0;
        if (isFirst) { this.firstArrivalMs = arrivalMs; }
        const withinGrace = arrivalMs - this.firstArrivalMs < GRACE_MS;
        const isCurrent = this.watermarkMs > 0 && stampMs >= this.watermarkMs - STALE_WINDOW_MS;
        if (stampMs > this.watermarkMs) { this.watermarkMs = stampMs; }

        if (withinGrace || !isCurrent) { return false; }
        if (facts.level !== 'E' && facts.level !== 'F' && facts.level !== 'A') { return false; }
        return getDeviceTier(facts.tag) === 'device-critical';
    }
}
