/**
 * Shared shapes for the screenshot sidecar. Their own module so `screenshot-sidecar-writer.ts` can
 * name the payload it serializes without importing `screenshot-store.ts`, which imports the writer —
 * a cycle that would otherwise exist purely to share two interfaces.
 */

/** What fired a capture. Mirrors the trigger settings + the manual command. */
export type ScreenshotTrigger = 'error' | 'warning' | 'nav' | 'manual';

/** One saved screenshot as recorded in the `.screenshots.json` sidecar. */
export interface ScreenshotMetaEntry {
    /** PNG filename inside the `.screenshots/` directory. */
    readonly file: string;
    readonly trigger: ScreenshotTrigger;
    /** Capture time, epoch ms. */
    readonly timestamp: number;
    /** 1-based line number in the log the capture is anchored to (0 = no anchor, manual capture). */
    readonly logLine: number;
    /** The matched log line text (ANSI-stripped, truncated) — the "why" shown in the gallery. */
    readonly text: string;
    /** Normalized error fingerprint hash (dedup key); empty for nav/manual triggers. */
    readonly fingerprint: string;
}
