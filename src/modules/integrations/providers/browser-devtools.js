"use strict";
/**
 * Browser / DevTools integration: captures browser console events and writes
 * them to a sidecar file. Supports two modes:
 * - **file**: reads an exported browser log at session end
 * - **cdp**: connects to Chrome DevTools Protocol via WebSocket during the session
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserDevtoolsProvider = void 0;
exports.toBrowserEvent = toBrowserEvent;
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
const browser_cdp_capture_1 = require("./browser-cdp-capture");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('browser');
}
/** Parse a JSONL string into an array of raw objects, skipping invalid lines. */
function parseJsonlRaw(raw, maxLines) {
    const items = [];
    for (const line of raw.split(/\r?\n/).filter(Boolean).slice(-maxLines)) {
        try {
            items.push(JSON.parse(line));
        }
        catch { /* skip */ }
    }
    return items;
}
/**
 * Normalize a raw parsed object to BrowserEvent shape.
 * Returns undefined if the object has no usable text content.
 * The timeline parser will separately drop events without timestamps.
 */
function toBrowserEvent(raw) {
    if (typeof raw !== 'object' || raw === null) {
        return undefined;
    }
    const obj = raw;
    const message = asString(obj['message']) ?? asString(obj['text']);
    if (!message) {
        return undefined;
    }
    const event = { message };
    const ts = asNumber(obj['timestamp']);
    if (ts !== undefined) {
        event.timestamp = ts;
    }
    const time = asString(obj['time']);
    if (time) {
        event.time = time;
    }
    const level = asString(obj['level']) ?? asString(obj['type']);
    if (level) {
        event.level = level;
    }
    const url = asString(obj['url']);
    if (url) {
        event.url = url;
    }
    const lineNumber = asNumber(obj['lineNumber']);
    if (lineNumber !== undefined) {
        event.lineNumber = lineNumber;
    }
    return event;
}
function asString(v) {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asNumber(v) {
    return typeof v === 'number' && isFinite(v) ? v : undefined;
}
/** Finalize CDP capture: stop, normalize events, write sidecar. */
async function endCdpCapture(context) {
    if (!(0, browser_cdp_capture_1.isCdpCaptureActive)()) {
        return undefined;
    }
    const raw = (0, browser_cdp_capture_1.stopCdpCapture)();
    const events = [];
    let dropped = 0;
    for (const item of raw) {
        const event = toBrowserEvent(item);
        if (event) {
            events.push(event);
        }
        else {
            dropped++;
        }
    }
    if (dropped > 0) {
        context.outputChannel.appendLine(`[browser] CDP: dropped ${dropped} event(s) with no usable text`);
    }
    if (events.length === 0) {
        return undefined;
    }
    const filename = `${context.baseFileName}.browser.json`;
    return [
        { kind: 'meta', key: 'browser', payload: { source: 'cdp', sidecar: filename, count: events.length, dropped } },
        { kind: 'sidecar', filename, content: JSON.stringify(events, null, 2), contentType: 'json' },
    ];
}
exports.browserDevtoolsProvider = {
    id: 'browser',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionStartAsync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const cfg = context.config.integrationsBrowser;
        if (cfg.mode !== 'cdp' || !cfg.cdpUrl) {
            return undefined;
        }
        try {
            await (0, browser_cdp_capture_1.startCdpCapture)(cfg.cdpUrl, cfg.maxEvents, cfg.includeNetwork, msg => context.outputChannel.appendLine(msg));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[browser] CDP connect failed: ${msg}`);
        }
        return undefined;
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const cfg = context.config.integrationsBrowser;
        if (cfg.mode === 'cdp') {
            return endCdpCapture(context);
        }
        if (cfg.mode !== 'file' || !cfg.browserLogPath) {
            return undefined;
        }
        try {
            const uri = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, cfg.browserLogPath);
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            let rawItems = [];
            if (cfg.browserLogFormat === 'jsonl') {
                rawItems = parseJsonlRaw(raw, cfg.maxEvents);
            }
            else {
                try {
                    const parsed = JSON.parse(raw);
                    const list = Array.isArray(parsed) ? parsed : [parsed];
                    rawItems = list.slice(-cfg.maxEvents);
                }
                catch {
                    return undefined;
                }
            }
            const events = [];
            let dropped = 0;
            for (const item of rawItems) {
                const event = toBrowserEvent(item);
                if (event) {
                    events.push(event);
                }
                else {
                    dropped++;
                }
            }
            if (dropped > 0) {
                context.outputChannel.appendLine(`[browser] Dropped ${dropped} event(s) with no usable text`);
            }
            if (events.length === 0) {
                return undefined;
            }
            const sidecarContent = JSON.stringify(events, null, 2);
            const filename = `${context.baseFileName}.browser.json`;
            return [
                { kind: 'meta', key: 'browser', payload: { sidecar: filename, count: events.length, dropped } },
                { kind: 'sidecar', filename, content: sidecarContent, contentType: 'json' },
            ];
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[browser] Browser log read failed: ${msg}`);
            return undefined;
        }
    },
};
//# sourceMappingURL=browser-devtools.js.map