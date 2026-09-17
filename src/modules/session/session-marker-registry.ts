/**
 * In-memory registry of marker ids created by {@link SessionManagerImpl.insertMarker}.
 *
 * Backs the public `getSignalDelta` API (PLAN 119 / bugs/119_plan-run-scoped-signal-correlation-api.md):
 * a marker id must be resolvable back to "which log file part, at which physical line" so a later
 * call can read the file directly and diff signals before/after it. Kept in memory only — like the
 * rest of the live-session state this module's siblings track, it does not survive an extension
 * host restart, and callers should treat a marker id as valid only within the VS Code window that
 * created it.
 */

import type * as vscode from 'vscode';

/** One recorded marker: where it landed in the session's log file part. */
export interface MarkerRecord {
    readonly id: string;
    /** Debug session id (`vscode.debug.activeDebugSession.id` at insertion time) that owns this marker. */
    readonly sessionKey: string;
    /** Base file name (no `.log`/`_NNN.log` suffix) — stable across splits, see `LogSession.baseFileName`. */
    readonly baseFileName: string;
    /** Directory the session's log files live in. */
    readonly logDirUri: vscode.Uri;
    /** Part number the marker landed in (0 = `<base>.log`, 1+ = `<base>_00N.log`). */
    readonly partNumber: number;
    /** Physical line count of that part *before* the marker line was queued — the split point:
     *  lines `[0, physicalLineIndex)` are "before", the marker itself and everything after start "after". */
    readonly physicalLineIndex: number;
    readonly timestampMs: number;
}

/** Records marker ids and resolves them back to a file position. */
export class MarkerRegistry {
    private readonly markers = new Map<string, MarkerRecord>();
    private seq = 0;

    /** Record a new marker and return its opaque id. */
    record(fields: Omit<MarkerRecord, 'id' | 'timestampMs'>): string {
        const id = `mk_${Date.now().toString(36)}_${(++this.seq).toString(36)}`;
        this.markers.set(id, { ...fields, id, timestampMs: Date.now() });
        return id;
    }

    /** Resolve a marker id back to its file position, or `undefined` if unknown. */
    resolve(id: string): MarkerRecord | undefined {
        return this.markers.get(id);
    }
}
