/**
 * Write scheduling for the screenshot sidecar. Split out of `screenshot-store.ts`, which had grown
 * to own four things at once — PNG files, metadata, suppression counting, and when to write.
 *
 * Everything here exists because the sidecar is rewritten WHOLE by more than one caller:
 *
 * - **Serialization.** `save()` and a debounced count flush rewrite the same file from the same
 *   in-memory state. Two overlapping whole-file writes let the last writer win with a stale
 *   snapshot. The capturer's in-flight guard serializes CAPTURES; a flush is not a capture, so it
 *   is not covered by it. Every write goes through one chain here instead.
 * - **Debouncing.** A skipped capture costs nothing but a decision, so skips arrive in bursts, and
 *   the count they update is not read until a report is generated. Writing per skip would put that
 *   burst of whole-file writes between the capturer and a live log.
 *
 * The payload is built at WRITE time, not at schedule time, by the callback the store supplies —
 * so a write queued behind another always persists current state rather than a stale snapshot.
 */

import * as vscode from 'vscode';
import type { ScreenshotMetaEntry } from './screenshot-store-types';

/** The whole sidecar document, as it will be serialized. */
export interface SidecarPayload {
    readonly version: 1;
    readonly screenshots: ScreenshotMetaEntry[];
    readonly suppressed: number;
}

/**
 * How long a pending count waits before its write. Long enough that a burst of skips costs one
 * write; short enough that an abrupt exit loses at most a few seconds of counting.
 */
const FLUSH_DELAY_MS = 3000;

/**
 * Pending skips that force an immediate write regardless of the timer. A long burst would otherwise
 * hold an ever-larger number in memory for the whole burst, and lose all of it to an abrupt exit —
 * the delay is meant to coalesce a handful of writes, not to defer an unbounded count indefinitely.
 */
const FLUSH_AFTER_PENDING = 25;

/**
 * Rounds `dispose()` repeats its flush. Only the final flush drains: a normal one can leave work for
 * the next timer, but dispose has no successor, so what it leaves is lost. Bounded because shutdown
 * must terminate — a permanently failing write must not hold the window open.
 */
const DRAIN_ROUNDS = 3;

/** Serializes and schedules sidecar writes. One per store. */
export class SidecarWriter {
    /** log base → log path, for documents whose state changed since the last write. */
    private readonly dirty = new Map<string, string>();
    /** log base → its sidecar URI, remembered so a flush needs no path arithmetic. */
    private readonly uris = new Map<string, vscode.Uri>();
    /**
     * Change counter per log base, bumped by every `markDirty`. A flush compares the value it wrote
     * against the current one to tell whether its write is still the latest word — see `writePending`.
     */
    private readonly generation = new Map<string, number>();
    /**
     * The flush currently running, if any. Held rather than a boolean so a concurrent caller can
     * AWAIT the in-flight flush instead of being told "someone else is doing it" and returning
     * before the write it asked for has landed.
     */
    private active: Promise<void> | undefined;
    /** Pending changes since the last write, across all logs — drives the burst cutoff. */
    private pendingCount = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    /**
     * Tail of the write queue. ALWAYS resolved, never rejected: callers get their own promise from
     * `write()`, and a chain that could reject would surface a caller's ignored failure as an
     * unhandled rejection in the extension host rather than as anything anyone sees.
     */
    private chain: Promise<void> = Promise.resolve();

    /**
     * @param build Produces the document for a log AT WRITE TIME.
     * @param baseOf Maps a log path to the identity used for de-duplicating dirty entries.
     * @param onError Reports a failed write; without it a wrong count is undiagnosable.
     */
    constructor(
        private readonly build: (logFsPath: string) => SidecarPayload,
        private readonly baseOf: (logFsPath: string) => string,
        private readonly onError?: (message: string) => void,
    ) { }

    /** True when something is counted but not yet on disk. */
    get hasPending(): boolean { return this.dirty.size > 0; }

    /**
     * Queue a write of this log's sidecar and resolve when THIS write has landed.
     *
     * `onBuild` fires synchronously at the instant the payload is composed — which is when the write
     * actually captures state, not when it was queued. A caller comparing "what did I write" against
     * "what is current" has to sample at that instant or it reports every queued write as stale.
     */
    write(logFsPath: string, sidecarUri: vscode.Uri, onBuild?: () => void): Promise<void> {
        const run = async (): Promise<void> => {
            onBuild?.();
            const bytes = new TextEncoder().encode(JSON.stringify(this.build(logFsPath), null, 2));
            await vscode.workspace.fs.writeFile(sidecarUri, bytes);
        };
        // The caller's promise is separate from the chain: the chain must keep flowing past a
        // failure, while the caller still learns its own write failed.
        const mine = this.chain.then(run, run);
        this.chain = mine.catch(() => { /* kept alive for the next writer; see `chain` */ });
        // Attached HERE, not left to the caller: this promise may legitimately be ignored
        // (`void writer.write(...)`), and an ignored rejection becomes an unhandled-rejection
        // warning in the extension host rather than anything a person sees. Callers that DO await
        // still observe the failure through `mine`.
        mine.catch(() => { /* observed by whoever awaited, or deliberately dropped */ });
        return mine;
    }

    /** Note that a log's counts changed, scheduling a write without performing one. */
    markDirty(logFsPath: string, sidecarUri: vscode.Uri): void {
        const base = this.baseOf(logFsPath);
        this.dirty.set(base, logFsPath);
        this.uris.set(base, sidecarUri);
        // Bumped on EVERY change, so a flush can tell whether what it wrote is still current.
        this.generation.set(base, (this.generation.get(base) ?? 0) + 1);
        this.pendingCount++;
        if (this.pendingCount >= FLUSH_AFTER_PENDING) {
            // Cancel the pending timer instead of leaving it to fire into a SECOND flush: two
            // concurrent flushes would write the same files twice and race each other's bookkeeping.
            if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
            void this.flush();
            return;
        }
        if (this.timer) { return; }
        this.timer = setTimeout(() => {
            this.timer = undefined;
            void this.flush();
        }, FLUSH_DELAY_MS);
        // A pending timer must never hold the extension host open past deactivate.
        this.timer.unref?.();
    }

    /**
     * Write every pending document now.
     *
     * ONE pass, deliberately. Anything marked dirty while this runs — including a log whose write
     * just failed — stays dirty, and `markDirty` arms a fresh timer for it because this flush has
     * already cleared its own. Re-checking in a loop here was a second mechanism doing the same job,
     * and it was where two of the three defects in this class came from.
     */
    async flush(): Promise<void> {
        // Join the flush already running rather than starting a second one: two concurrent flushes
        // would write the same files twice and race each other's bookkeeping. Joining (not
        // returning early) means a caller still waits for the write it asked for.
        if (this.active) { return this.active; }
        this.pendingCount = 0;
        this.active = this.writePending().finally(() => { this.active = undefined; });
        return this.active;
    }

    /** One pass over everything currently dirty. */
    private async writePending(): Promise<void> {
        for (const [base, logFsPath] of [...this.dirty]) {
            await this.writeOne(base, logFsPath);
        }
    }

    /**
     * Write one dirty log. It is cleared from the dirty set only when the write LANDED and nothing
     * changed while it was in flight — a count that arrived mid-write is not on disk, and clearing
     * here would lose it. A failed write leaves it dirty for the same reason.
     */
    private async writeOne(base: string, logFsPath: string): Promise<void> {
        const uri = this.uris.get(base);
        if (!uri) { this.dirty.delete(base); return; }
        // Sampled when the payload is BUILT, not now: this write may sit behind others, and anything
        // that changed before it composed its document is already in that document.
        let wrote = 0;
        try {
            await this.write(logFsPath, uri, () => { wrote = this.generation.get(base) ?? 0; });
        } catch (err) {
            this.onError?.(`screenshot: could not record the suppressed count for ${logFsPath} (${err instanceof Error ? err.message : String(err)})`);
            return;
        }
        if ((this.generation.get(base) ?? 0) === wrote) { this.dirty.delete(base); }
    }

    /**
     * Stop the timer and DRAIN, rather than take the single pass a normal flush takes.
     *
     * A normal flush can leave work behind safely: a log marked dirty while it ran arms a fresh
     * timer, and a failed write is retried by the next one. Dispose has no next one — whatever it
     * leaves is gone — so it repeats until nothing is pending, bounded so a permanently failing
     * write cannot hold shutdown open.
     */
    async dispose(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        // Bounded because SHUTDOWN MUST TERMINATE — not as a tuning choice. Each round writes
        // everything pending when it starts, so a second round covers whatever arrived during the
        // first, and a third covers the same for it. A write that keeps failing stays pending and
        // simply exhausts the rounds rather than holding the window open.
        for (let round = 0; round < DRAIN_ROUNDS && this.hasPending; round++) {
            await this.flush();
        }
    }
}
