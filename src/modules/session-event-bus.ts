/**
 * Types and early-output buffer for session event dispatching.
 * Extracted from session-manager.ts for line-count management.
 */

import * as vscode from 'vscode';
import { DapOutputBody } from './tracker';

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
}

/** Callback for lines written to the log file (used by the viewer). */
export type LineListener = (data: LineData) => void;

/** Callback for split events (used to update viewer breadcrumb). */
export type SplitListener = (newUri: vscode.Uri, partNumber: number, totalParts: number) => void;

/** Buffers DAP output events arriving before async session init completes. */
export class EarlyOutputBuffer {
    private readonly buffer = new Map<string, DapOutputBody[]>();

    /** Buffer an event for a session not yet initialized. */
    add(sessionId: string, body: DapOutputBody): void {
        let buf = this.buffer.get(sessionId);
        if (!buf) { buf = []; this.buffer.set(sessionId, buf); }
        if (buf.length < maxEarlyBuffer) { buf.push(body); }
    }

    /** Drain and return all buffered events for a session. */
    drain(sessionId: string): DapOutputBody[] {
        const buffered = this.buffer.get(sessionId);
        this.buffer.delete(sessionId);
        return buffered ?? [];
    }

    /** Remove buffered events for a session. */
    delete(sessionId: string): void {
        this.buffer.delete(sessionId);
    }

    /** Clear all buffers. */
    clear(): void {
        this.buffer.clear();
    }
}
