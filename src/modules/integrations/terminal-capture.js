"use strict";
/**
 * Captures Integrated Terminal output during a session. Buffer is read by the
 * terminal provider at session end. Uses VS Code terminal API when available.
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
exports.startTerminalCapture = startTerminalCapture;
exports.stopTerminalCapture = stopTerminalCapture;
exports.getTerminalCaptureBuffer = getTerminalCaptureBuffer;
const vscode = __importStar(require("vscode"));
const lines = [];
let maxLinesCap = 50_000;
let disposables = [];
let prefixTimestamp = true;
let activeTerminalId;
function append(data, terminalName) {
    const t = prefixTimestamp ? `[${new Date().toISOString().slice(11, 23)}] ` : '';
    const prefixed = data.split(/\r?\n/).map((line) => (line ? t + `[${terminalName}] ${line}` : ''));
    for (const line of prefixed) {
        if (line) {
            lines.push(line);
            if (lines.length > maxLinesCap) {
                lines.shift();
            }
        }
    }
}
/** Start capturing terminal output. Call when session starts. */
function startTerminalCapture(options) {
    stopTerminalCapture();
    lines.length = 0;
    maxLinesCap = Math.max(1000, Math.min(500000, options.maxLines));
    prefixTimestamp = options.prefixTimestamp;
    activeTerminalId = undefined;
    if (options.whichTerminals === 'active' && vscode.window.activeTerminal) {
        const t = vscode.window.activeTerminal;
        activeTerminalId = t._id ?? t.name ?? 'active';
    }
    /* terminalDataWriteEvent is a proposed API; skip terminal capture when unavailable or not allowed. */
    try {
        const win = vscode.window;
        if (typeof win.onDidWriteTerminalData !== 'function') {
            return;
        }
        const which = options.whichTerminals;
        const linked = options.linkedTerminalIds ?? new Set();
        const sub = win.onDidWriteTerminalData((e) => {
            const term = e.terminal;
            const id = term._id ?? term.name ?? 'terminal';
            const name = term.name ?? id;
            if (which === 'linked' && !linked.has(String(id))) {
                return;
            }
            if (which === 'active' && activeTerminalId !== undefined && String(id) !== activeTerminalId) {
                return;
            }
            append(e.data, name);
        });
        if (sub && typeof sub.dispose === 'function') {
            disposables.push(sub);
        }
    }
    catch {
        /* Proposed API not allowed (e.g. marketplace build). Terminal capture skipped. */
    }
}
/** Stop capturing and clear disposables. */
function stopTerminalCapture() {
    for (const d of disposables) {
        try {
            d.dispose();
        }
        catch { /* ignore */ }
    }
    disposables = [];
}
/** Get buffered lines (consumed by terminal provider at session end). */
function getTerminalCaptureBuffer() {
    return [...lines];
}
//# sourceMappingURL=terminal-capture.js.map