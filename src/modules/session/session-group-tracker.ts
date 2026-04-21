/**
 * Session-group anchoring state machine.
 *
 * Wires the two grouping triggers described in bugs/auto-group-related-sessions.md:
 *
 *   - **DAP-anchored:** when a debug session starts, mint a groupId, claim every
 *     pre-existing ungrouped file in the log directory whose mtime falls inside
 *     the lookback window, then do a second claim pass at debug-session end to
 *     stamp any sidecar files that integration providers wrote during the session
 *     (e.g. `.logcat.log` written by `adb-logcat.ts:onSessionEnd`).
 *
 *   - **Standalone:** currently a no-op. Public integration-provider plumbing
 *     doesn't yet expose "new provider file created" events — when it does, wire
 *     that through `onIntegrationFileCreated()`.
 *
 * One active group at a time. A file already carrying a different `groupId` is
 * never re-claimed (enforced inside `stampGroupIdBatch`).
 */

import * as vscode from 'vscode';
import type { SessionMetadataStore } from './session-metadata';
import type { SessionGroupsConfig } from '../config/config-types';
import { generateGroupId } from './session-groups';

/** Settings shape consumed by the tracker \u2014 kept minimal for easy test injection. */
export type TrackerSettings = Pick<SessionGroupsConfig, 'enabled' | 'lookbackSeconds'>;

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
}

/**
 * Anchor state for the currently active group.
 *
 * `activeGroupId` is undefined when no DAP session is in flight. When it is
 * defined, `startMs` records when the anchor fired (used to reject files whose
 * mtime is older than `startMs - lookbackSeconds * 1000`).
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
     * Mint a group on DAP session start and stamp lookback-eligible files.
     *
     * Called from `extension-lifecycle.ts` after `sessionManager.startSession()`
     * so the main log file URI is already valid.
     *
     * No-op when the feature is disabled. Silent on failure \u2014 grouping is
     * best-effort and must not break session startup.
     */
    async onDapSessionStart(mainLogUri: vscode.Uri, startMs: number): Promise<void> {
        try {
            const settings = this.deps.getSettings();
            if (!settings.enabled) { return; }
            const logDir = parentDir(mainLogUri);
            const groupId = generateGroupId();
            this.active = { groupId, startMs, logDir };
            const claimed = await this.sweepAndStamp(logDir, startMs, settings.lookbackSeconds, groupId);
            this.deps.log(
                `session-group: opened ${groupId.slice(0, 8)}\u2026 anchored on ${mainLogUri.fsPath} ` +
                `(claimed ${claimed} file${claimed === 1 ? '' : 's'} in the lookback window)`,
            );
        } catch (err) {
            this.deps.log(`session-group: start-claim failed: ${errorMessage(err)}`);
        }
    }

    /**
     * Close the active group on DAP session end, running a final sweep to claim
     * any sidecar files integration providers produced during the session.
     *
     * The sweep window is `startMs - lookbackSeconds*1000` through `now`, so any
     * file whose mtime is at least as recent as the lookback bound is eligible \u2014
     * the "during-session" files all have mtime \u2265 startMs and are covered.
     */
    async onDapSessionEnd(mainLogUri: vscode.Uri): Promise<void> {
        try {
            if (!this.active) { return; }
            const { groupId, startMs, logDir } = this.active;
            const settings = this.deps.getSettings();
            if (settings.enabled) {
                const claimed = await this.sweepAndStamp(logDir, startMs, settings.lookbackSeconds, groupId);
                this.deps.log(
                    `session-group: closed ${groupId.slice(0, 8)}\u2026 ` +
                    `(final sweep claimed ${claimed} additional file${claimed === 1 ? '' : 's'})`,
                );
            }
            // Always clear state even if settings flipped mid-session \u2014 the anchor is gone.
            this.active = undefined;
            // Silence the unused-param warning; logUri is kept in the signature because future
            // standalone-mode wiring will rely on it.
            void mainLogUri;
        } catch (err) {
            this.deps.log(`session-group: end-claim failed: ${errorMessage(err)}`);
            this.active = undefined;
        }
    }

    /**
     * Scan `logDir`, find files whose mtime falls inside the claim window and
     * whose metadata is ungrouped, and stamp them with `groupId`.
     *
     * Returns the count of files actually stamped.
     */
    private async sweepAndStamp(
        logDir: vscode.Uri,
        startMs: number,
        lookbackSeconds: number,
        groupId: string,
    ): Promise<number> {
        // vscode.workspace.fs returns Thenables (no .catch), so wrap in Promise and guard with try/catch.
        const readDir = this.deps.readDirectory
            ?? ((uri: vscode.Uri): Promise<[string, vscode.FileType][]> => Promise.resolve(vscode.workspace.fs.readDirectory(uri)));
        const statFn = this.deps.stat
            ?? ((uri: vscode.Uri): Promise<vscode.FileStat> => Promise.resolve(vscode.workspace.fs.stat(uri)));
        const windowStartMs = startMs - Math.max(0, lookbackSeconds) * 1000;
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
