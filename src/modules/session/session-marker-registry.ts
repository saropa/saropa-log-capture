/**
 * In-memory registry of marker ids created by {@link SessionManagerImpl.insertMarker}.
 *
 * Backs the public `getSignalDelta` API (PLAN 119 / plans/history/2026.09/2026.09.17/119_plan-run-scoped-signal-correlation-api.md):
 * a marker id must be resolvable back to "which log file part, at which physical line" so a later
 * call can read the file directly and diff signals before/after it. Kept in memory only — like the
 * rest of the live-session state this module's siblings track, it does not survive an extension
 * host restart, and callers should treat a marker id as valid only within the VS Code window that
 * created it.
 *
 * A marker is recorded in TWO steps, because `LogSession.appendMarker` only *enqueues* the write:
 * `record()` reserves the id the caller needs synchronously, and `settle()` fills in the position
 * once the append queue actually reaches the marker. Anything that reads a position must go
 * through {@link MarkerRegistry.waitForPosition} rather than assuming one is already there.
 */

import type * as vscode from 'vscode';

/** Where a marker physically landed in the session's log files. */
export interface MarkerPosition {
    /** Part number the marker line was written to (0 = `<base>.log`, 1+ = `<base>_00N.log`). */
    readonly partNumber: number;
    /** Physical line count of that part immediately before the marker block — the split point:
     *  lines `[0, physicalLineIndex)` are "before", the marker and everything after are "after". */
    readonly physicalLineIndex: number;
}

/** One recorded marker: who owns it, and (once written) where it landed. */
export interface MarkerRecord {
    readonly id: string;
    /** Debug session id (`vscode.debug.activeDebugSession.id` at insertion time) that owns this marker. */
    readonly sessionKey: string;
    /** Base file name (no `.log`/`_NNN.log` suffix) — stable across splits, see `LogSession.baseFileName`. */
    readonly baseFileName: string;
    /** Directory the session's log files live in. */
    readonly logDirUri: vscode.Uri;
    readonly timestampMs: number;
    /**
     * `undefined` until the queued marker write actually reaches the file. Capturing a position at
     * `record()` time would be wrong by the whole append-queue backlog — and by a whole part
     * number if the queue splits the file before the marker lands.
     */
    readonly position?: MarkerPosition;
}

/**
 * Oldest-first eviction cap. Every `insertMarker` — the public API, the palette command, and the
 * viewer action — adds an entry, so an unbounded map would grow for the lifetime of the extension
 * host; a command-catalog caller bracketing every run adds two per run. Markers are consumed
 * within seconds of being created, so a few hundred is far more history than any caller needs.
 */
const maxMarkers = 500;

/** Records marker ids and resolves them back to a file position. */
export class MarkerRegistry {
    private readonly markers = new Map<string, MarkerRecord>();
    /** Callbacks waiting for a pending marker to settle, keyed by marker id. */
    private readonly waiters = new Map<string, Array<() => void>>();
    private seq = 0;

    /** Number of markers currently retained (eviction cap is internal; exposed for tests). */
    get size(): number { return this.markers.size; }

    /** Reserve a new marker id. Its position stays `undefined` until {@link settle}. */
    record(fields: Omit<MarkerRecord, 'id' | 'timestampMs' | 'position'>): string {
        this.evictOldest();
        const id = `mk_${Date.now().toString(36)}_${(++this.seq).toString(36)}`;
        this.markers.set(id, { ...fields, id, timestampMs: Date.now() });
        return id;
    }

    /** Record where a previously reserved marker actually landed, and release any waiters. */
    settle(id: string, position: MarkerPosition): void {
        const existing = this.markers.get(id);
        if (!existing) { return; }
        this.markers.set(id, { ...existing, position });
        this.releaseWaiters(id);
    }

    /** Drop a reserved marker that will never be written (e.g. the append was refused). */
    discard(id: string): void {
        this.markers.delete(id);
        this.releaseWaiters(id);
    }

    /** Resolve a marker id, or `undefined` if unknown. The result may still be unsettled. */
    resolve(id: string): MarkerRecord | undefined {
        return this.markers.get(id);
    }

    /**
     * Resolve a marker id, waiting up to `timeoutMs` for a still-pending write to land. Returns
     * the record either way — a caller that needs a position must still check for one, since a
     * marker queued behind paused captured lines may never be written at all.
     */
    async waitForPosition(id: string, timeoutMs: number): Promise<MarkerRecord | undefined> {
        const existing = this.resolve(id);
        if (!existing || existing.position) { return existing; }
        await new Promise<void>((resolveWait) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (): void => {
                if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
                // Drop this waiter on the way out. The settle/discard paths clear the whole list,
                // but a timeout does not, and a marker that is never written would otherwise leave
                // its callback parked until the entry is eventually evicted.
                this.dropWaiter(id, finish);
                resolveWait();
            };
            timer = setTimeout(finish, timeoutMs);
            const pending = this.waiters.get(id) ?? [];
            pending.push(finish);
            this.waiters.set(id, pending);
        });
        return this.resolve(id);
    }

    /** Remove one waiter, and the list entry entirely once it is empty. */
    private dropWaiter(id: string, waiter: () => void): void {
        const pending = this.waiters.get(id);
        if (!pending) { return; }
        const at = pending.indexOf(waiter);
        if (at >= 0) { pending.splice(at, 1); }
        if (pending.length === 0) { this.waiters.delete(id); }
    }

    /** Run and clear every waiter registered for `id`. */
    private releaseWaiters(id: string): void {
        const pending = this.waiters.get(id);
        if (!pending) { return; }
        this.waiters.delete(id);
        for (const finish of pending) { finish(); }
    }

    /** Drop the oldest entry when the map is at capacity (Map preserves insertion order). */
    private evictOldest(): void {
        while (this.markers.size >= maxMarkers) {
            const oldest = this.markers.keys().next();
            if (oldest.done) { return; }
            this.discard(oldest.value);
        }
    }
}
