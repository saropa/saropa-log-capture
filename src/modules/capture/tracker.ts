import * as vscode from 'vscode';
import { DapDirection } from './dap-formatter';

/** Shape of a DAP output event body. */
export interface DapOutputBody {
    readonly output: string;
    readonly category?: string;
    readonly source?: { name?: string; path?: string };
    readonly line?: number;
    readonly column?: number;
}

/** Interface for the object that receives captured output events. */
export interface SessionManager {
    onOutputEvent(sessionId: string, body: DapOutputBody): void;
    /** Optional handler for all raw DAP protocol messages (verbose mode). */
    onDapMessage?(sessionId: string, msg: unknown, direction: DapDirection): void;
}

export class SaropaTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    constructor(private readonly sessionManager: SessionManager) {}

    createDebugAdapterTracker(
        session: vscode.DebugSession
    ): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new SaropaTracker(session, this.sessionManager);
    }
}

class SaropaTracker implements vscode.DebugAdapterTracker {
    constructor(
        private readonly session: vscode.DebugSession,
        private readonly manager: SessionManager
    ) {}

    /** Intercept messages sent from VS Code to the debug adapter (outgoing). */
    onWillSendMessage(message: unknown): void {
        this.manager.onDapMessage?.(this.session.id, message, 'outgoing');
    }

    /** Intercept messages received from the debug adapter (incoming). */
    onDidSendMessage(message: unknown): void {
        const msg = message as { type?: string; event?: string; body?: DapOutputBody };
        if (msg.type === 'event' && msg.event === 'output' && msg.body?.output) {
            this.manager.onOutputEvent(this.session.id, msg.body);
            return; // Output events handled by onOutputEvent — skip onDapMessage
        }
        this.manager.onDapMessage?.(this.session.id, message, 'incoming');
    }

    onError(error: Error): void {
        console.error('[SaropaLogCapture] Tracker error:', error.message);
    }
}
