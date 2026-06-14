/**
 * Types and early-output buffer for session event dispatching.
 * LineData and LineListener/SplitListener are used by extension-activation to wire
 * SessionManager → ViewerBroadcaster and SessionHistoryProvider. EarlyOutputBuffer
 * exists because DAP can emit output before initializeSession() completes; events
 * are buffered and replayed after startSession().
 */

import * as vscode from 'vscode';
import { DapOutputBody } from '../capture/tracker';

const maxEarlyBuffer = 500;

/** Data object passed to line listeners for each log line. */
export interface LineData {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: Date;
    readonly sourcePath?: string;
    readonly sourceLine?: number;
    readonly watchHits?: string[];
    /**
     * Absolute path of the .log file this line was written to. Carried so the
     * cumulative cross-session viewer can group lines by origin file and assign
     * per-file letter codes (A, B, …) — the global display index alone matches no
     * single file. Set from the appending session's current fileUri (changes on
     * mid-session split, so it is stamped per line, not once per session).
     */
    readonly logFileUri?: string;
}

/** Callback for lines written to the log file (used by the viewer). */
export type LineListener = (data: LineData) => void;

/** Callback for split events (used to update viewer breadcrumb). */
export type SplitListener = (newUri: vscode.Uri, partNumber: number, totalParts: number) => void;

/** Buffers DAP output events for a sessionId until startSession completes; then replayed by SessionManager. */
export class EarlyOutputBuffer {
    private readonly buffer = new Map<string, DapOutputBody[]>();
    // Count of events dropped per session once the cap is hit. The cap bounds memory when a debug
    // adapter spews output but initializeSession never completes; we still must not lose the fact
    // silently, so the count is replayed as a visible notice line at drain time (M2).
    private readonly droppedCount = new Map<string, number>();

    /** Buffer an event for a session not yet initialized; count overflow past the cap (M2). */
    add(sessionId: string, body: DapOutputBody): void {
        let buf = this.buffer.get(sessionId);
        if (!buf) { buf = []; this.buffer.set(sessionId, buf); }
        if (buf.length < maxEarlyBuffer) { buf.push(body); return; }
        this.droppedCount.set(sessionId, (this.droppedCount.get(sessionId) ?? 0) + 1);
    }

    /** Drain and return all buffered events for a session, with a trailing drop notice if any were lost. */
    drain(sessionId: string): DapOutputBody[] {
        const buffered = this.buffer.get(sessionId) ?? [];
        this.buffer.delete(sessionId);
        return this.appendDropNotice(sessionId, buffered);
    }

    /** Drain and return all buffered events for every session (and clear the buffer). Use when creating the first log session so no early output is lost. */
    drainAll(): Map<string, DapOutputBody[]> {
        const out = new Map<string, DapOutputBody[]>();
        for (const [sid, bodies] of this.buffer) { out.set(sid, this.appendDropNotice(sid, bodies)); }
        this.buffer.clear();
        return out;
    }

    /**
     * Append a synthetic notice as the last replayed event when output was dropped for this session.
     * Placed after the kept events because the cap keeps the EARLIEST events and drops later ones, so
     * the gap sits between the buffered prefix and the start of normal capture. Returns the array as-is
     * when nothing was dropped. Clears the per-session counter so the notice is emitted once.
     */
    private appendDropNotice(sessionId: string, bodies: DapOutputBody[]): DapOutputBody[] {
        const dropped = this.droppedCount.get(sessionId) ?? 0;
        this.droppedCount.delete(sessionId);
        if (dropped === 0) { return bodies; }
        const noun = dropped === 1 ? 'line' : 'lines';
        // Log-content marker (English, like the SESSION END footer) — a technical artifact, not UI chrome.
        const output = `[Saropa Log Capture] ${dropped} early output ${noun} dropped before capture started `
            + `(pre-session buffer cap ${maxEarlyBuffer} reached).`;
        return [...bodies, { output, category: 'console' }];
    }

    /** Remove buffered events for a session. */
    delete(sessionId: string): void {
        this.buffer.delete(sessionId);
        this.droppedCount.delete(sessionId);
    }

    /** Clear all buffers. */
    clear(): void {
        this.buffer.clear();
        this.droppedCount.clear();
    }
}
