"use strict";
/**
 * Chrome DevTools Protocol (CDP) live capture.
 *
 * Connects via WebSocket to a running Chrome/Edge browser (localhost only),
 * subscribes to Runtime.consoleAPICalled and optionally Network.responseReceived,
 * buffers events as BrowserEvent[], and flushes on stop.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocalhostUrl = isLocalhostUrl;
exports.resolveWsUrl = resolveWsUrl;
exports.mapConsoleEvent = mapConsoleEvent;
exports.mapNetworkEvent = mapNetworkEvent;
exports.startCdpCapture = startCdpCapture;
exports.stopCdpCapture = stopCdpCapture;
exports.isCdpCaptureActive = isCdpCaptureActive;
const ws_1 = __importDefault(require("ws"));
let capture;
const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
/** Validate that URL is localhost-only (security gate). */
function isLocalhostUrl(url) {
    try {
        return localhostHosts.has(new URL(url).hostname);
    }
    catch {
        return false;
    }
}
/** Discover first inspectable page via CDP HTTP endpoint. */
async function discoverPageWsUrl(baseUrl) {
    const httpUrl = baseUrl.replace(/^ws/, 'http') + '/json';
    const resp = await fetch(httpUrl);
    if (!resp.ok) {
        throw new Error(`CDP discovery failed: HTTP ${resp.status}`);
    }
    const pages = (await resp.json());
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
async function resolveWsUrl(cdpUrl) {
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
function mapConsoleEvent(params) {
    const args = params.args;
    if (!args || args.length === 0) {
        return undefined;
    }
    const message = args
        .map(a => a.value !== undefined ? String(a.value) : (a.description || ''))
        .filter(Boolean)
        .join(' ');
    if (!message) {
        return undefined;
    }
    const event = {
        message,
        level: String(params.type || 'log'),
        timestamp: typeof params.timestamp === 'number' ? params.timestamp * 1000 : Date.now(),
    };
    const stackTrace = params.stackTrace;
    const frame = stackTrace?.callFrames?.[0];
    if (frame?.url) {
        event.url = frame.url;
    }
    if (typeof frame?.lineNumber === 'number') {
        event.lineNumber = frame.lineNumber;
    }
    return event;
}
/** Map Network.responseReceived params to BrowserEvent. */
function mapNetworkEvent(params) {
    const response = params.response;
    if (!response?.url) {
        return undefined;
    }
    const status = typeof response.status === 'number' ? response.status : 0;
    return {
        message: `HTTP ${status} ${response.url}`,
        level: status >= 400 ? 'error' : 'info',
        timestamp: typeof params.timestamp === 'number' ? params.timestamp * 1000 : Date.now(),
        url: response.url,
    };
}
/** Handle a raw CDP WebSocket message: parse, map, and buffer. */
function handleCdpMessage(ws, data) {
    if (!capture || capture.ws !== ws) {
        return;
    }
    if (capture.events.length >= capture.maxEvents) {
        return;
    }
    try {
        const msg = JSON.parse(data);
        if (!msg.method || !msg.params) {
            return;
        }
        let event;
        if (msg.method === 'Runtime.consoleAPICalled') {
            event = mapConsoleEvent(msg.params);
        }
        else if (msg.method === 'Network.responseReceived' && capture.includeNetwork) {
            event = mapNetworkEvent(msg.params);
        }
        if (event) {
            capture.events.push(event);
        }
    }
    catch { /* skip malformed */ }
}
/** Send a CDP JSON-RPC command. */
function cdpSend(method) {
    if (!capture) {
        return;
    }
    capture.ws.send(JSON.stringify({ id: capture.nextId++, method }));
}
/** Connect to CDP WebSocket and start capturing events. */
async function startCdpCapture(cdpUrl, maxEvents, includeNetwork, log) {
    if (capture) {
        stopCdpCapture();
    }
    const wsUrl = await resolveWsUrl(cdpUrl);
    const ws = new ws_1.default(wsUrl);
    capture = { ws, events: [], maxEvents, nextId: 1, includeNetwork, log };
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { capture = undefined; ws.close(); reject(new Error('CDP connection timed out')); }, 10_000);
        ws.on('open', () => {
            clearTimeout(timeout);
            cdpSend('Runtime.enable');
            if (includeNetwork) {
                cdpSend('Network.enable');
            }
            log('[browser] CDP connected');
            resolve();
        });
        ws.on('message', (raw) => handleCdpMessage(ws, String(raw)));
        ws.on('error', (err) => { log(`[browser] CDP error: ${err.message}`); clearTimeout(timeout); reject(err); });
        ws.on('close', () => log('[browser] CDP disconnected'));
    });
}
/** Stop CDP capture, close WebSocket, return buffered events. */
function stopCdpCapture() {
    if (!capture) {
        return [];
    }
    const events = [...capture.events];
    try {
        capture.ws.close();
    }
    catch { /* already closed */ }
    capture = undefined;
    return events;
}
/** Check if CDP capture is currently active. */
function isCdpCaptureActive() {
    return capture !== undefined;
}
//# sourceMappingURL=browser-cdp-capture.js.map