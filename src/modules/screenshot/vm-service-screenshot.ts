/**
 * One-shot Flutter screenshot over the VM Service WebSocket (plan 114, workstream A).
 *
 * Calls the `_flutter.screenshot` service extension — the same endpoint the
 * `flutter screenshot` CLI uses — and returns the decoded PNG bytes. The extension is
 * private API (`_` prefix) but has been stable for years; every failure path here is
 * soft (rejects with a message, never throws synchronously) because a screenshot is
 * evidence, never worth disturbing the debug session for.
 *
 * A short-lived connection per capture is deliberate: captures are cooldown-limited
 * (seconds apart at most), so connection reuse would buy little and cost reconnect /
 * dropped-socket state management. One socket, one JSON-RPC call, close.
 */

import WebSocket from 'ws';

/** Abort a capture whose socket cannot connect or whose reply never arrives. */
const CAPTURE_TIMEOUT_MS = 5000;

interface VmServiceScreenshotResponse {
    readonly id?: unknown;
    readonly result?: { readonly screenshot?: unknown };
    readonly error?: { readonly message?: unknown };
}

/**
 * Capture one screenshot from the Flutter app behind `wsUri`.
 * Resolves with PNG bytes, or rejects with a reason suitable for the output channel.
 */
export function captureVmServiceScreenshot(wsUri: string): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
        let settled = false;
        const ws = new WebSocket(wsUri);

        const finish = (err: Error | undefined, png?: Uint8Array): void => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            // Terminate, not close: we are done either way and a lingering half-open
            // socket would keep the extension host event loop pinned.
            try { ws.terminate(); } catch { /* already dead */ }
            if (err) { reject(err); } else { resolve(png!); }
        };

        const timer = setTimeout(
            () => finish(new Error(`VM Service screenshot timed out after ${CAPTURE_TIMEOUT_MS}ms`)),
            CAPTURE_TIMEOUT_MS,
        );

        ws.on('open', () => {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: '1', method: '_flutter.screenshot', params: {} }));
        });
        ws.on('message', (data: unknown) => {
            const [err, png, isOurs] = parseScreenshotReply(String(data));
            // The VM Service can interleave stream events; only settle on the reply to OUR id.
            if (isOurs) { finish(err, png); }
        });
        ws.on('error', (err: Error) => finish(new Error(`VM Service connect failed: ${err.message}`)));
        ws.on('close', () => finish(new Error('VM Service socket closed before the screenshot reply')));
    });
}

/**
 * Parse one JSON-RPC message into [error, png, isOurs]. `isOurs` is false for stream
 * events or replies to other ids — the caller keeps waiting. Split out so the response
 * contract (base64 `result.screenshot` under id '1') is unit-testable without a live VM Service.
 */
export function parseScreenshotReply(raw: string): [Error | undefined, Uint8Array | undefined, boolean] {
    let msg: VmServiceScreenshotResponse;
    try {
        msg = JSON.parse(raw) as VmServiceScreenshotResponse;
    } catch {
        // Non-JSON on a JSON-RPC socket means the endpoint is not a VM Service — settle now.
        return [new Error('VM Service sent a non-JSON screenshot reply'), undefined, true];
    }
    if (msg.id !== '1') { return [undefined, undefined, false]; }
    if (msg.error) {
        const detail = typeof msg.error.message === 'string' ? msg.error.message : 'unknown error';
        return [new Error(`_flutter.screenshot failed: ${detail}`), undefined, true];
    }
    const b64 = msg.result?.screenshot;
    if (typeof b64 !== 'string' || b64.length === 0) {
        return [new Error('_flutter.screenshot reply had no screenshot payload'), undefined, true];
    }
    return [undefined, new Uint8Array(Buffer.from(b64, 'base64')), true];
}
