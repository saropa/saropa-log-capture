import * as vscode from 'vscode';

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

    onDidSendMessage(message: unknown): void {
        const msg = message as { type?: string; event?: string; body?: DapOutputBody };
        if (msg.type === 'event' && msg.event === 'output' && msg.body?.output) {
            this.manager.onOutputEvent(this.session.id, msg.body);
        }
    }

    onError(error: Error): void {
        console.error('[SaropaLogCapture] Tracker error:', error.message);
    }
}
