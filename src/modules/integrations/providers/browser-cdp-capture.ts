/**
 * Chrome DevTools Protocol (CDP) live capture.
 *
 * Connects via WebSocket to a running Chrome/Edge browser (localhost only),
 * subscribes to Runtime.consoleAPICalled and optionally Network.responseReceived,
 * buffers events as BrowserEvent[], and flushes on stop.
 */

import WebSocket from 'ws';
import type { BrowserEvent } from '../../timeline/event-types';

interface CdpState {
    ws: WebSocket;
    events: BrowserEvent[];
    maxEvents: number;
    nextId: number;
    includeNetwork: boolean;
    log: (msg: string) => void;
}

let capture: CdpState | undefined;

const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Validate that URL is localhost-only (security gate). */
export function isLocalhostUrl(url: string): boolean {
    try {
        return localhostHosts.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

/** Discover first inspectable page via CDP HTTP endpoint. */
async function discoverPageWsUrl(baseUrl: string): Promise<string> {
    const httpUrl = baseUrl.replace(/^ws/, 'http') + '/json';
    const resp = await fetch(httpUrl);
    if (!resp.ok) { throw new Error(`CDP discovery failed: HTTP ${resp.status}`); }
    const pages = (await resp.json()) as { webSocketDebuggerUrl?: string }[];
    const page = pages.find(p => typeof p.webSocketDebuggerUrl === 'string');
    if (!page?.webSocketDebuggerUrl) {
        throw new Error('No inspectable page found at CDP endpoint');
    }
    return page.webSocketDebuggerUrl;
}

/**
 * Resolve a user-provided CDP URL to a connectable WebSocket URL.
 * Bare host (e.g. ws://localhost:9222) → auto-discover first page.
 * Full path (e.g. ws://localhost:9222/devtools/page/ABC) → use directly.
 */
export async function resolveWsUrl(cdpUrl: string): Promise<string> {
    if (!isLocalhostUrl(cdpUrl)) {
        throw new Error('CDP connections are restricted to localhost for security');
    }
    const url = new URL(cdpUrl);
    if (url.pathname === '/' || url.pathname === '') {
        return discoverPageWsUrl(cdpUrl);
    }
    return cdpUrl.replace(/^http/, 'ws');
}

/** Map Runtime.consoleAPICalled params to BrowserEvent. */
export function mapConsoleEvent(params: Record<string, unknown>): BrowserEvent | undefined {
    const args = params.args as { value?: unknown; description?: string }[] | undefined;
    if (!args || args.length === 0) { return undefined; }
    const message = args
        .map(a => a.value !== undefined ? String(a.value) : (a.description || ''))
        .filter(Boolean)
        .join(' ');
    if (!message) { return undefined; }
    const event: BrowserEvent = {
        message,
        level: String(params.type || 'log'),
        timestamp: typeof params.timestamp === 'number' ? params.timestamp * 1000 : Date.now(),
    };
    const stackTrace = params.stackTrace as { callFrames?: { url?: string; lineNumber?: number }[] } | undefined;
    const frame = stackTrace?.callFrames?.[0];
    if (frame?.url) { event.url = frame.url; }
    if (typeof frame?.lineNumber === 'number') { event.lineNumber = frame.lineNumber; }
    return event;
}

/** Map Network.responseReceived params to BrowserEvent. */
export function mapNetworkEvent(params: Record<string, unknown>): BrowserEvent | undefined {
    const response = params.response as { url?: string; status?: number } | undefined;
    if (!response?.url) { return undefined; }
    const status = typeof response.status === 'number' ? response.status : 0;
    return {
        message: `HTTP ${status} ${response.url}`,
        level: status >= 400 ? 'error' : 'info',
        timestamp: typeof params.timestamp === 'number' ? params.timestamp * 1000 : Date.now(),
        url: response.url,
    };
}

/** Handle a raw CDP WebSocket message: parse, map, and buffer. */
function handleCdpMessage(ws: WebSocket, data: string): void {
    if (!capture || capture.ws !== ws) { return; }
    if (capture.events.length >= capture.maxEvents) { return; }
    try {
        const msg = JSON.parse(data) as { method?: string; params?: Record<string, unknown> };
        if (!msg.method || !msg.params) { return; }
        let event: BrowserEvent | undefined;
        if (msg.method === 'Runtime.consoleAPICalled') {
            event = mapConsoleEvent(msg.params);
        } else if (msg.method === 'Network.responseReceived' && capture.includeNetwork) {
            event = mapNetworkEvent(msg.params);
        }
        if (event) { capture.events.push(event); }
    } catch { /* skip malformed */ }
}

/** Send a CDP JSON-RPC command. */
function cdpSend(method: string): void {
    if (!capture) { return; }
    capture.ws.send(JSON.stringify({ id: capture.nextId++, method }));
}

/** Connect to CDP WebSocket and start capturing events. */
export async function startCdpCapture(
    cdpUrl: string,
    maxEvents: number,
    includeNetwork: boolean,
    log: (msg: string) => void,
): Promise<void> {
    if (capture) { stopCdpCapture(); }
    const wsUrl = await resolveWsUrl(cdpUrl);
    const ws = new WebSocket(wsUrl);
    capture = { ws, events: [], maxEvents, nextId: 1, includeNetwork, log };
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { capture = undefined; ws.close(); reject(new Error('CDP connection timed out')); }, 10_000);
        ws.on('open', () => {
            clearTimeout(timeout);
            cdpSend('Runtime.enable');
            if (includeNetwork) { cdpSend('Network.enable'); }
            log('[browser] CDP connected');
            resolve();
        });
        ws.on('message', (raw) => handleCdpMessage(ws, String(raw)));
        ws.on('error', (err) => { log(`[browser] CDP error: ${err.message}`); clearTimeout(timeout); reject(err); });
        ws.on('close', () => log('[browser] CDP disconnected'));
    });
}

/** Stop CDP capture, close WebSocket, return buffered events. */
export function stopCdpCapture(): BrowserEvent[] {
    if (!capture) { return []; }
    const events = [...capture.events];
    try { capture.ws.close(); } catch { /* already closed */ }
    capture = undefined;
    return events;
}

/** Check if CDP capture is currently active. */
export function isCdpCaptureActive(): boolean {
    return capture !== undefined;
}
