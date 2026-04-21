/**
 * Session-group anchoring state machine.
 *
 * Implements the three-window model described in
 * bugs/auto-group-related-sessions.md:
 *
 *   - **Before window** (`beforeSeconds`): at DAP-session start, claim every
 *     ungrouped file whose mtime falls inside this many seconds before the
 *     start event.
 *   - **During window**: every file written while the session is active is
 *     eligible; picked up by the immediate end-sweep.
 *   - **After window** (`afterSeconds`): at DAP-session end, schedule a
 *     delayed sweep that fires `afterSeconds` later and claims any late
 *     file (e.g. `.logcat.log` flushed by `adb-logcat.ts:onSessionEnd` after
 *     the DAP event already fired). The delayed sweep enforces an upper
 *     bound on mtime so it cannot steal files written deep into a later
 *     session.
 *
 * Conflict resolution is **first-claim-wins**: a file already carrying a
 * different `groupId` is never re-claimed automatically. Users override
 * via the `groupSelectedSessions` / `ungroupSession` commands.
 *
 * Standalone grouping (no DAP session) is not wired in this iteration \u2014
 * no integration provider currently runs outside a DAP session.
 */

import * as vscode from 'vscode';
import type { SessionMetadataStore } from './session-metadata';
import type { SessionGroupsConfig } from '../config/config-types';
import { generateGroupId } from './session-groups';

/** Settings shape consumed by the tracker \u2014 kept minimal for easy test injection. */
export type TrackerSettings = Pick<SessionGroupsConfig, 'enabled' | 'beforeSeconds' | 'afterSeconds'>;

/** Injected dependencies \u2014 makes the tracker unit-testable without activating a real extension. */
export interface SessionGroupTrackerDeps {
    /** Metadata store used to stamp `groupId` fields. */
    readonly metaStore: SessionMetadataStore;
    /** Read current settings fresh each time (users can change them mid-session). */
    readonly getSettings: () => TrackerSettings;
    /** Output-channel logger. Never throws. */
    readonly log: (message: string) => void;
    /** Override for listing a directory (test seam). Defaults to `vscode.workspace.fs`. */
    readonly readDirectory?: (uri: vscode.Uri) => Promise<[string, vscode.FileType][]>;
    /** Override for stat-ing a file (test seam). Defaults to `vscode.workspace.fs.stat`. */
    readonly stat?: (uri: vscode.Uri) => Promise<vscode.FileStat>;
    /**
     * Override for scheduling the delayed after-window sweep. Defaults to
     * `setTimeout`. Tests pass a synchronous fake that invokes the callback
     * immediately (or after manually advancing a mock clock).
     */
    readonly scheduleAfterSweep?: (callback: () => void, delayMs: number) => void;
}

/**
 * Anchor state while a DAP session is live. When `active` is `undefined` the
 * tracker is idle \u2014 either no DAP session ever started, or the current one
 * already ran its immediate end-sweep.
 */
interface ActiveAnchor {
    readonly groupId: string;
    readonly startMs: number;
    readonly logDir: vscode.Uri;
}

export class SessionGroupTracker {
    private active?: ActiveAnchor;

    constructor(private readonly deps: SessionGroupTrackerDeps) {}

    /** Return the active groupId if a DAP session is anchoring a group, else undefined. */
    getActiveGroupId(): string | undefined {
        return this.active?.groupId;
    }

    /**
     * Mint a group on DAP session start and run the **before-sweep**.
     *
     * Called from `extension-lifecycle.ts` after `sessionManager.startSession()`
     * resolves, so the main log file URI is valid. No-op when the feature is
     * disabled. Silent on failure \u2014 grouping is best-effort and must not
     * break session startup.
     */
    async onDapSessionStart(mainLogUri: vscode.Uri, startMs: number): Promise<void> {
        try {
            const settings = this.deps.getSettings();
            if (!settings.enabled) { return; }
            const logDir = parentDir(mainLogUri);
            const groupId = generateGroupId();
            this.active = { groupId, startMs, logDir };
            const claimed = await this.sweepAndStamp({
                logDir, startMs, beforeSeconds: settings.beforeSeconds, groupId, upperBoundMs: undefined,
            });
            this.deps.log(
                `session-group: opened ${groupId.slice(0, 8)}\u2026 anchored on ${mainLogUri.fsPath} ` +
                `(before-sweep claimed ${claimed} file${claimed === 1 ? '' : 's'})`,
            );
        } catch (err) {
            this.deps.log(`session-group: start-claim failed: ${errorMessage(err)}`);
        }
    }

    /**
     * On DAP session end:
     *   1. Run an **immediate end-sweep** to pick up any during-session file
     *      the before-sweep missed.
     *   2. Schedule a **delayed end-sweep** for `endMs + afterSeconds * 1000`
     *      that catches late-flushed sidecars without the caller needing to
     *      await it. The delayed sweep caps mtime at its upper bound so it
     *      cannot steal files from a later session.
     *
     * After step 1, `this.active` is cleared so a subsequent DAP session can
     * start fresh. The delayed-sweep closure still carries the completed
     * group's groupId + window bounds.
     */
    async onDapSessionEnd(mainLogUri: vscode.Uri): Promise<void> {
        try {
            if (!this.active) { return; }
            const { groupId, startMs, logDir } = this.active;
            // Capture once before clearing \u2014 a new session could overwrite `active` before the delayed sweep fires.
            this.active = undefined;
            const settings = this.deps.getSettings();
            if (!settings.enabled) { return; }
            const endMs = Date.now();
            const immediateClaimed = await this.sweepAndStamp({
                logDir, startMs, beforeSeconds: settings.beforeSeconds, groupId, upperBoundMs: undefined,
            });
            this.deps.log(
                `session-group: immediate end-sweep for ${groupId.slice(0, 8)}\u2026 ` +
                `claimed ${immediateClaimed} additional file${immediateClaimed === 1 ? '' : 's'}`,
            );
            this.scheduleDelayedSweep({ logDir, startMs, endMs, groupId }, settings);
            // Silence the unused-param warning; logUri is kept in the signature because future
            // wiring (collection fan-out, standalone mode) will need it.
            void mainLogUri;
        } catch (err) {
            this.deps.log(`session-group: end-claim failed: ${errorMessage(err)}`);
            this.active = undefined;
        }
    }

    /**
     * Schedule the delayed after-window sweep. Uses `setTimeout` by default;
     * tests inject a synchronous fake via `scheduleAfterSweep`.
     *
     * The sweep's upper bound on mtime (`endMs + afterSeconds * 1000`) is the
     * key guard against stealing files from a later session.
     */
    private scheduleDelayedSweep(
        ctx: { logDir: vscode.Uri; startMs: number; endMs: number; groupId: string },
        settings: TrackerSettings,
    ): void {
        const afterMs = Math.max(0, settings.afterSeconds) * 1000;
        const upperBoundMs = ctx.endMs + afterMs;
        const schedule = this.deps.scheduleAfterSweep ?? ((cb: () => void, ms: number) => { setTimeout(cb, ms).unref?.(); });
        schedule(() => {
            // Settings may have changed between schedule and fire \u2014 re-read rather than close over the old value.
            const live = this.deps.getSettings();
            if (!live.enabled) { return; }
            this.sweepAndStamp({
                logDir: ctx.logDir,
                startMs: ctx.startMs,
                beforeSeconds: live.beforeSeconds,
                groupId: ctx.groupId,
                upperBoundMs,
            })
                .then(count => {
                    if (count > 0) {
                        this.deps.log(
                            `session-group: delayed after-sweep for ${ctx.groupId.slice(0, 8)}\u2026 ` +
                            `claimed ${count} late file${count === 1 ? '' : 's'}`,
                        );
                    }
                })
                .catch(err => this.deps.log(`session-group: delayed sweep failed: ${errorMessage(err)}`));
        }, afterMs);
    }

    /**
     * Scan `args.logDir`, find files whose mtime falls inside the claim window
     * and whose metadata is ungrouped, and stamp them with `args.groupId`.
     *
     * Window: `startMs - beforeSeconds * 1000` \u2264 mtime \u2264 `upperBoundMs` (if
     * provided; otherwise no upper bound). Returns the count of files actually
     * stamped.
     */
    private async sweepAndStamp(args: {
        logDir: vscode.Uri;
        startMs: number;
        beforeSeconds: number;
        groupId: string;
        upperBoundMs: number | undefined;
    }): Promise<number> {
        const { logDir, startMs, beforeSeconds, groupId, upperBoundMs } = args;
        // vscode.workspace.fs returns Thenables (no .catch), so wrap in Promise and guard with try/catch.
        const readDir = this.deps.readDirectory
            ?? ((uri: vscode.Uri): Promise<[string, vscode.FileType][]> => Promise.resolve(vscode.workspace.fs.readDirectory(uri)));
        const statFn = this.deps.stat
            ?? ((uri: vscode.Uri): Promise<vscode.FileStat> => Promise.resolve(vscode.workspace.fs.stat(uri)));
        const windowStartMs = startMs - Math.max(0, beforeSeconds) * 1000;
        let entries: [string, vscode.FileType][];
        try {
            entries = await readDir(logDir);
        } catch {
            return 0;
        }
        // Files to consider: regular files only, excluding the metadata store and hidden files.
        const candidates = entries.filter(
            (entry: [string, vscode.FileType]) => (entry[1] & vscode.FileType.File) !== 0 && !entry[0].startsWith('.'),
        );
        const toStamp: vscode.Uri[] = [];
        for (const [name] of candidates) {
            const uri = vscode.Uri.joinPath(logDir, name);
            // Stat-first: cheap way to decide eligibility without reading the metadata JSON.
            let stat: vscode.FileStat | undefined;
            try { stat = await statFn(uri); } catch { continue; }
            if (stat.mtime < windowStartMs) { continue; }
            if (upperBoundMs !== undefined && stat.mtime > upperBoundMs) { continue; }
            toStamp.push(uri);
        }
        if (toStamp.length === 0) { return 0; }
        const stamped = await this.deps.metaStore.stampGroupIdBatch(toStamp, groupId);
        return stamped.length;
    }
}

/** Return the parent directory of a URI. Handles both file and workspace URIs safely. */
function parentDir(uri: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(uri, '..');
}

/** Extract a human-readable message from an error-like value. Never throws. */
function errorMessage(err: unknown): string {
    if (err instanceof Error) { return err.message; }
    try { return String(err); } catch { return '<unknown>'; }
}
