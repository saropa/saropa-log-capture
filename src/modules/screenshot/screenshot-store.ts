/**
 * Screenshot sidecar storage (plan 114, workstream A).
 *
 * Screenshots live beside their log file: `<base>.screenshots/NNN_trigger_epochms.png`
 * plus a `<base>.screenshots.json` metadata sidecar (one entry per image: trigger,
 * timestamp, log line, matched text, fingerprint). Filenames encode sequence, trigger,
 * and time so a directory listing sorts chronologically without parsing metadata.
 *
 * The per-log cap bounds disk use on pathological sessions; once hit, saves are refused
 * and the caller logs one warning.
 *
 * Metadata is kept in memory per log base and rewritten WHOLE by three paths: `save()`, the
 * debounced suppressed-count flush, and `dispose()`. Those writes are serialized by `writeChain`,
 * NOT by the capturer's in-flight guard — that guard serializes captures, and a flush is not a
 * capture. Any new writer must go through `writeSidecar` for the same reason.
 *
 * save() is separately a read-modify-write (seq number from entries.length across two awaits) and is
 * NOT safe under concurrent CAPTURES — the capturer's in-flight guard on every capture path (auto
 * AND manual) is what protects that; do not add a caller that bypasses it.
 */

import * as vscode from 'vscode';

import { SidecarWriter, type SidecarPayload } from './screenshot-sidecar-writer';
export type { ScreenshotMetaEntry, ScreenshotTrigger } from './screenshot-store-types';
import type { ScreenshotMetaEntry, ScreenshotTrigger } from './screenshot-store-types';

/**
 * Sidecar JSON as READ from disk. Every field is optional-by-suspicion because the file outlives the
 * process that wrote it: `suppressed` is absent from every sidecar written before near-duplicate
 * skipping existed, and a reader that demanded it would reject all of them.
 */
interface ScreenshotSidecar {
    readonly version: 1;
    readonly screenshots: ScreenshotMetaEntry[];
    readonly suppressed?: number;
}

/** A log's capture history: what was kept, and how much was dropped as near-duplicate. */
export interface ScreenshotSummary {
    readonly entries: ScreenshotMetaEntry[];
    /** Captures the near-duplicate rule dropped. 0 when the feature is off or nothing matched. */
    readonly suppressed: number;
}

/** Result of a successful save: where the PNG landed and the running count for that log. */
export interface ScreenshotSaveResult {
    readonly entry: ScreenshotMetaEntry;
    readonly pngUri: vscode.Uri;
    readonly totalForLog: number;
}

/** Strip the trailing `.log` so `foo.log` → sidecars `foo.screenshots/` + `foo.screenshots.json`. */
export function screenshotBaseFromLogPath(logFsPath: string): string {
    return logFsPath.replace(/\.log$/i, '');
}

/** Directory URI holding the PNGs for a given log file. */
export function screenshotDirUri(logFsPath: string): vscode.Uri {
    return vscode.Uri.file(`${screenshotBaseFromLogPath(logFsPath)}.screenshots`);
}

/** Metadata sidecar URI for a given log file. */
export function screenshotSidecarUri(logFsPath: string): vscode.Uri {
    return vscode.Uri.file(`${screenshotBaseFromLogPath(logFsPath)}.screenshots.json`);
}

/** Saves PNGs + metadata beside the log. One instance per extension activation. */
export class ScreenshotStore {
    /** log base fsPath → entries written this process (authoritative during a session). */
    private readonly entriesByBase = new Map<string, ScreenshotMetaEntry[]>();
    /** log base fsPath → captures dropped as near-duplicates this process. */
    private readonly suppressedByBase = new Map<string, number>();
    /** Owns WHEN and IN WHAT ORDER the sidecar is written; see its module doc. */
    private readonly writer: SidecarWriter;

    /**
     * @param onError Reports a failed sidecar write. Optional so tests and the many call sites that
     * only read do not have to supply one, but the extension always does: a write that fails
     * silently makes a wrong suppressed count undiagnosable.
     */
    constructor(onError?: (message: string) => void) {
        // The payload is built HERE, at write time, from live state — so a write queued behind
        // another never persists a snapshot taken before the one in front of it changed things.
        this.writer = new SidecarWriter(
            (logFsPath): SidecarPayload => ({
                version: 1,
                screenshots: [...this.entriesForLog(logFsPath)],
                suppressed: this.suppressedByBase.get(screenshotBaseFromLogPath(logFsPath)) ?? 0,
            }),
            screenshotBaseFromLogPath,
            onError,
        );
    }

    /** Count of screenshots recorded for a log (0 when none). */
    countForLog(logFsPath: string): number {
        return this.entriesByBase.get(screenshotBaseFromLogPath(logFsPath))?.length ?? 0;
    }

    /** In-memory entries for a log (empty array when none captured this process). */
    entriesForLog(logFsPath: string): readonly ScreenshotMetaEntry[] {
        return this.entriesByBase.get(screenshotBaseFromLogPath(logFsPath)) ?? [];
    }

    /**
     * Persist one screenshot. Returns undefined when the per-log cap is already reached
     * (caller decides whether to warn). Directory is created on first save.
     */
    async save(
        logFsPath: string,
        png: Uint8Array,
        entry: Omit<ScreenshotMetaEntry, 'file'>,
        maxPerLog: number,
    ): Promise<ScreenshotSaveResult | undefined> {
        const base = screenshotBaseFromLogPath(logFsPath);
        const entries = this.entriesByBase.get(base) ?? [];
        if (entries.length >= maxPerLog) { return undefined; }

        const seq = String(entries.length + 1).padStart(3, '0');
        const file = `${seq}_${entry.trigger}_${entry.timestamp}.png`;
        const dir = screenshotDirUri(logFsPath);
        await vscode.workspace.fs.createDirectory(dir);
        const pngUri = vscode.Uri.joinPath(dir, file);
        await vscode.workspace.fs.writeFile(pngUri, png);

        const full: ScreenshotMetaEntry = { ...entry, file };
        entries.push(full);
        this.entriesByBase.set(base, entries);
        await this.writeSidecar(logFsPath);
        return { entry: full, pngUri, totalForLog: entries.length };
    }

    /**
     * Record one capture dropped as a near-duplicate.
     *
     * The count is PERSISTED because its whole purpose is to be read later, by a report generated
     * from the log after the session ended — an in-memory counter would show 0 for every log the
     * current process did not itself capture.
     *
     * The write is DEBOUNCED because a skip costs nothing but a decision, so skips arrive in bursts
     * (a chatty navigation session skipping most of what it sees), and writing the whole sidecar per
     * skip would put a burst of file rewrites on the live capture path to record a number nobody
     * reads until the session is over. Counting is immediate; only the write waits.
     */
    noteSuppressed(logFsPath: string): void {
        const base = screenshotBaseFromLogPath(logFsPath);
        this.suppressedByBase.set(base, (this.suppressedByBase.get(base) ?? 0) + 1);
        this.writer.markDirty(logFsPath, screenshotSidecarUri(logFsPath));
    }

    /** Captures dropped as near-duplicates for a log this process (0 when none). */
    suppressedForLog(logFsPath: string): number {
        return this.suppressedByBase.get(screenshotBaseFromLogPath(logFsPath)) ?? 0;
    }

    /**
     * Write out every pending suppressed count now. Called on the debounce timer and at shutdown —
     * a count that only ever existed in memory would be lost exactly when the session it describes
     * is the one being reported on.
     */
    async flushSuppressed(): Promise<void> {
        await this.writer.flush();
    }

    /** Stop the pending timer and write what it was waiting to write. */
    async dispose(): Promise<void> {
        await this.writer.dispose();
    }

    /** True when a suppressed count is counted but not yet on disk. */
    get hasPendingSuppressed(): boolean { return this.writer.hasPending; }

    /** Queue a whole-document rewrite. Ordering and failure handling live in `SidecarWriter`. */
    private writeSidecar(logFsPath: string): Promise<void> {
        return this.writer.write(logFsPath, screenshotSidecarUri(logFsPath));
    }
}

/** The trigger union as a runtime set — a type cannot police a JSON file a user can hand-edit. */
const SCREENSHOT_TRIGGERS: ReadonlySet<string> = new Set<ScreenshotTrigger>(
    ['error', 'warning', 'nav', 'manual'],
);

/**
 * Validate one parsed sidecar record into an entry, or undefined to drop it.
 *
 * `trigger` is checked against the real union rather than `typeof string`, because it is not just
 * data in transit: consumers switch on it to pick a severity tint and to decide which capture
 * represents a screen, so an unknown value from an older or hand-edited sidecar would render as an
 * untinted mystery instead of being rejected at the boundary.
 *
 * The remaining fields are DEFAULTED, not required: a capture with no log anchor (logLine 0) or no
 * fingerprint (nav/manual triggers never have one) is a legitimate record, so demanding them would
 * discard valid history. Only `file`, `timestamp`, and `trigger` identify the capture at all.
 */
function validateEntry(raw: unknown): ScreenshotMetaEntry | undefined {
    if (!raw || typeof raw !== 'object') { return undefined; }
    const s = raw as Partial<ScreenshotMetaEntry>;
    if (typeof s.file !== 'string' || typeof s.timestamp !== 'number') { return undefined; }
    if (typeof s.trigger !== 'string' || !SCREENSHOT_TRIGGERS.has(s.trigger)) { return undefined; }
    return {
        file: s.file,
        trigger: s.trigger,
        timestamp: s.timestamp,
        logLine: typeof s.logLine === 'number' ? s.logLine : 0,
        text: typeof s.text === 'string' ? s.text : '',
        fingerprint: typeof s.fingerprint === 'string' ? s.fingerprint : '',
    };
}

/**
 * Read a `.screenshots.json` sidecar from disk (viewer/timeline/gallery load path for
 * logs captured in an earlier process). Returns [] on missing or malformed sidecars.
 */
export async function readScreenshotSidecar(logFsPath: string): Promise<ScreenshotMetaEntry[]> {
    return (await readScreenshotSummary(logFsPath)).entries;
}

/**
 * Read a sidecar as a whole summary — entries plus the suppressed count. Separate from
 * `readScreenshotSidecar` so the many callers that only want the entries keep their simple shape.
 */
export async function readScreenshotSummary(logFsPath: string): Promise<ScreenshotSummary> {
    const empty: ScreenshotSummary = { entries: [], suppressed: 0 };
    try {
        const bytes = await vscode.workspace.fs.readFile(screenshotSidecarUri(logFsPath));
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ScreenshotSidecar>;
        if (!Array.isArray(parsed.screenshots)) { return empty; }
        const entries = parsed.screenshots
            .map(validateEntry)
            .filter((e): e is ScreenshotMetaEntry => e !== undefined);
        // A negative or non-numeric count is meaningless; report none rather than propagate nonsense.
        const raw = parsed.suppressed;
        const suppressed = typeof raw === 'number' && raw > 0 ? Math.floor(raw) : 0;
        return { entries, suppressed };
    } catch {
        return empty;
    }
}
