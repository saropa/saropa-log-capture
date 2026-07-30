/**
 * Tracks the Dart VM Service URI per debug session (plan 114).
 *
 * The Dart debug adapter announces its VM Service endpoint via the custom DAP event
 * `dart.debuggerUris` (body.vmServiceUri). We record it per session id and drop it on
 * terminate, so the screenshot capturer can reach the VM Service of whichever Flutter
 * session is currently running without polling or spawning `flutter` CLI processes.
 *
 * KNOWN LIMITATION: getLatestVmServiceWsUri returns the most recently announced URI with
 * no correlation to the log file that produced a trigger. With TWO Flutter sessions live
 * at once, a capture triggered by session A's log line screenshots session B's app.
 * Correlating would need a debug-session-id → LogSession mapping threaded through
 * LineData; deferred until multi-session capture is a real use case (plan 114).
 *
 * Module-level state: `uriBySessionId` is process-local and cleared on deactivation via
 * clearVmServiceUris() (wired in extension.ts deactivate), matching the sanctioned
 * module-level-holder pattern.
 */

import * as vscode from 'vscode';
import { logExtensionInfo } from '../misc/extension-logger';

/** Session id → VM Service WebSocket URI, insertion-ordered (newest last). */
const uriBySessionId = new Map<string, string>();

/**
 * Convert the announced VM Service HTTP URI to its WebSocket form.
 * The adapter reports `http://127.0.0.1:PORT/TOKEN=/`; the JSON-RPC socket lives at
 * the same authority+path with an `ws` suffix and ws(s) scheme. Already-ws URIs pass through.
 */
export function toVmServiceWsUri(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('ws')) { return trimmed; }
    const ws = trimmed.replace(/^http/, 'ws');
    return ws.endsWith('/') ? `${ws}ws` : `${ws}/ws`;
}

/** Most recently announced VM Service WebSocket URI, or undefined when no Dart session is live. */
export function getLatestVmServiceWsUri(): string | undefined {
    let latest: string | undefined;
    for (const uri of uriBySessionId.values()) { latest = uri; }
    return latest;
}

/** Number of sessions currently holding a VM Service URI (exposed for tests/diagnostics). */
export function getVmServiceSessionCount(): number { return uriBySessionId.size; }

/** Record/remove entries directly — exported so unit tests can exercise the registry without DAP. */
export function recordVmServiceUri(sessionId: string, rawUri: string): void {
    uriBySessionId.set(sessionId, toVmServiceWsUri(rawUri));
}

/** Forget a session's URI (called on debug session terminate). */
export function forgetVmServiceUri(sessionId: string): void {
    uriBySessionId.delete(sessionId);
}

/** Drop all recorded URIs — called from deactivate() so no state outlives the extension. */
export function clearVmServiceUris(): void {
    uriBySessionId.clear();
}

/**
 * VM Service address lines seen in real captures. Two families (verified against
 * contacts logs 2026-07-28/29, which emit ONLY the second):
 *   "A Dart VM Service on <device> is available at: http://127.0.0.1:PORT/TOKEN=/"
 *   "Connecting to VM Service at ws://127.0.0.1:PORT/TOKEN=/ws"   (Dart-Code console)
 * Lead-ins are enumerated ("Observatory" covers very old SDKs) and the URL shape is
 * strict — and must accept ws:// as well as http://, since the Dart-Code form is
 * already the WebSocket URI — so ordinary log text can never register a bogus address.
 */
const vmServiceBanner = /(?:(?:VM Service|Observatory)[^\n]*?(?:available at|listening on)|Connecting to VM Service at):?\s*((?:https?|wss?):\/\/[\w.:[\]-]+\/[\w=+/-]*\/?)/;

/**
 * Fallback URI discovery from captured output (called per line ONLY while no URI is known —
 * see the wiring). The `dart.debuggerUris` custom event is the primary source, but its name
 * is Dart-Code convention, not spec; if an adapter version renames or drops it, the console
 * banner still carries the endpoint. Keyed by log path so a later real event can overwrite.
 */
export function recordVmServiceUriFromLogLine(text: string, logFsPath: string): boolean {
    // indexOf fast-path: this runs per line during the pre-URI window, which includes the
    // session-start logcat replay burst (hundreds of lines in one flush) — skip the regex
    // unless the literal lead-in is present.
    if (!text.includes('VM Service') && !text.includes('Observatory')) { return false; }
    const match = vmServiceBanner.exec(text);
    if (!match) { return false; }
    uriBySessionId.set(`log:${logFsPath}`, toVmServiceWsUri(match[1]));
    logExtensionInfo('screenshot', `VM Service URI from console banner (dart.debuggerUris event absent): ${toVmServiceWsUri(match[1])}`);
    return true;
}

/**
 * Wire the VM Service URI registry to the debug lifecycle. Registered once at activation;
 * both listeners land in `context.subscriptions` for disposal.
 */
export function registerVmServiceUriTracking(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.debug.onDidReceiveDebugSessionCustomEvent((e) => {
            if (e.event !== 'dart.debuggerUris') { return; }
            const body = e.body as { vmServiceUri?: unknown } | undefined;
            if (typeof body?.vmServiceUri === 'string' && body.vmServiceUri.length > 0) {
                recordVmServiceUri(e.session.id, body.vmServiceUri);
                // Which discovery path fired is the first question when captures don't work —
                // answer it in the output channel instead of making F5 diagnosis guesswork.
                logExtensionInfo('screenshot', `VM Service URI from dart.debuggerUris event: ${toVmServiceWsUri(body.vmServiceUri)}`);
            }
        }),
        vscode.debug.onDidTerminateDebugSession((session) => {
            forgetVmServiceUri(session.id);
            // Log-derived (banner) entries have no session id to correlate on terminate. Drop
            // them ALL when any session ends: a stale URI (dead socket per capture) is worse
            // than a missing one — the banner re-registers on the next run's first lines.
            for (const key of [...uriBySessionId.keys()]) {
                if (key.startsWith('log:')) { uriBySessionId.delete(key); }
            }
        }),
    );
}
