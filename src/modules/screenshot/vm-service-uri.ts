/**
 * Tracks the Dart VM Service URI per debug session (plan 114).
 *
 * The Dart debug adapter announces its VM Service endpoint via the custom DAP event
 * `dart.debuggerUris` (body.vmServiceUri). We record it per session id and drop it on
 * terminate, so the screenshot capturer can reach the VM Service of whichever Flutter
 * session is currently running without polling or spawning `flutter` CLI processes.
 */

import * as vscode from 'vscode';

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
            }
        }),
        vscode.debug.onDidTerminateDebugSession((session) => { forgetVmServiceUri(session.id); }),
    );
}
