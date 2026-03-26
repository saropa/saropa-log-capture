"use strict";
/**
 * Build context for AI "Explain this error": error line, surrounding lines, stack trace, integration data.
 * Phase 2: stack trace extraction and integration data (perf, HTTP, terminal) from context-loader.
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
exports.extractStackTrace = extractStackTrace;
exports.buildAIContext = buildAIContext;
const vscode = __importStar(require("vscode"));
const viewer_file_loader_1 = require("../../ui/viewer/viewer-file-loader");
const context_loader_1 = require("../context/context-loader");
const session_metadata_1 = require("../session/session-metadata");
const DEFAULT_CONTEXT_LINES = 10;
const CONTEXT_WINDOW_MS = 5000;
/** Patterns that suggest a stack frame line (at, #0, indent + "at ", etc.). */
const STACK_FRAME_PATTERNS = [
    /^\s*at\s+\S/, // "at package.Class.method"
    /^\s*#\d+\s+/, // "#0 ..." (Dart/Flutter)
    /^\s*at\s+/, // "    at "
    /\([^)]+:\d+\)/, // "(file.dart:123)" or "(File.java:42)"
    /^\s*in\s+\S+\s+/, // "in package.Class"
];
function looksLikeStackFrame(line) {
    const t = line.trim();
    if (t.length === 0) {
        return false;
    }
    return STACK_FRAME_PATTERNS.some((re) => re.test(line));
}
/**
 * Extract consecutive stack-frame-like lines from content, starting around the error line.
 * Returns the joined block or undefined if none found.
 */
function extractStackTrace(contentLines, errorLineIndex) {
    const maxFrames = 40;
    const start = Math.max(0, errorLineIndex);
    const lines = [];
    for (let i = start; i < contentLines.length && lines.length < maxFrames; i++) {
        const line = contentLines[i];
        if (line === undefined) {
            break;
        }
        if (looksLikeStackFrame(line)) {
            lines.push(line.trimEnd());
        }
        else if (lines.length > 0) {
            // Stop at first non-frame after we've seen at least one frame (allow one blank)
            const trimmed = line.trim();
            if (trimmed.length > 0) {
                break;
            }
        }
    }
    if (lines.length === 0) {
        return undefined;
    }
    return lines.join('\n');
}
function getSessionCenterTime(integrations) {
    if (!integrations) {
        return 0;
    }
    for (const value of Object.values(integrations)) {
        const data = value;
        if (typeof data.capturedAt === 'number') {
            return data.capturedAt;
        }
        const sw = data.sessionWindow;
        if (sw?.start !== null && sw?.start !== undefined && sw?.end !== null && sw?.end !== undefined) {
            return Math.round((sw.start + sw.end) / 2);
        }
    }
    return 0;
}
function mapContextDataToIntegrationData(data) {
    const out = {};
    if (data.performance && data.performance.length > 0) {
        const p = data.performance[0];
        const mem = `${p.freeMemMb} MB free`;
        const cpu = p.loadAvg1 !== null && p.loadAvg1 !== undefined ? `load ${p.loadAvg1.toFixed(2)}` : 'N/A';
        out.performance = { memory: mem, cpu };
    }
    if (data.http && data.http.length > 0) {
        out.http = data.http.slice(0, 20).map((h) => ({
            url: h.url,
            status: h.status,
            duration: h.durationMs,
        }));
    }
    if (data.terminal && data.terminal.length > 0) {
        out.terminal = data.terminal.slice(0, 30).map((t) => t.line);
    }
    if (Object.keys(out).length === 0) {
        return undefined;
    }
    return out;
}
/**
 * Read log file and build context: surrounding lines, stack trace, session metadata, optional integration data.
 */
async function buildAIContext(logUri, lineIndex, lineText, options = {}) {
    const { lineTimestampMs, includeIntegrationData = true, lineEndIndex, contextLines = DEFAULT_CONTEXT_LINES } = options;
    let rawLines = [];
    const fields = {};
    try {
        const raw = await vscode.workspace.fs.readFile(logUri);
        const text = Buffer.from(raw).toString('utf-8');
        rawLines = text.split(/\r?\n/);
        Object.assign(fields, (0, viewer_file_loader_1.parseHeaderFields)(rawLines));
    }
    catch {
        // Use only lineText and placeholders if file read fails
    }
    const contentStart = (0, viewer_file_loader_1.findHeaderEnd)(rawLines);
    const contentLines = rawLines.slice(contentStart);
    const n = Math.max(0, Math.min(50, contextLines));
    const endLine = lineEndIndex !== null && lineEndIndex !== undefined && lineEndIndex >= lineIndex ? lineEndIndex : lineIndex;
    const lo = Math.max(0, lineIndex - n);
    const hi = Math.min(contentLines.length - 1, endLine + n);
    const surroundingLines = [];
    for (let i = lo; i <= hi; i++) {
        const line = contentLines[i];
        if (line !== undefined) {
            surroundingLines.push(line.trimEnd());
        }
    }
    const stackTrace = extractStackTrace(contentLines, lineIndex);
    let integrationData;
    if (includeIntegrationData) {
        try {
            const store = new session_metadata_1.SessionMetadataStore();
            const meta = await store.loadMetadata(logUri);
            const centerTime = lineTimestampMs && lineTimestampMs > 0
                ? lineTimestampMs
                : getSessionCenterTime(meta.integrations);
            const windowMs = vscode.workspace
                .getConfiguration('saropaLogCapture')
                .get('contextWindowSeconds', 5) * 1000;
            const window = { centerTime, windowMs: windowMs || CONTEXT_WINDOW_MS };
            let contextData = await (0, context_loader_1.loadContextData)(logUri, window);
            if (!contextData.hasData && meta.integrations) {
                const metaContext = await (0, context_loader_1.loadContextFromMeta)(meta.integrations, window);
                contextData = { ...contextData, ...metaContext, hasData: Object.keys(metaContext).length > 0 };
            }
            integrationData = mapContextDataToIntegrationData(contextData);
        }
        catch {
            // Integration data optional; continue without it
        }
    }
    const sessionInfo = {
        debugAdapter: fields['Debug adapter'] ?? fields['Adapter'] ?? 'unknown',
        project: fields['Project'] ?? fields['Workspace'] ?? vscode.workspace.name ?? 'unknown',
        timestamp: fields['Date'] ?? fields['Started'] ?? new Date().toISOString(),
    };
    return {
        errorLine: lineText,
        lineIndex,
        surroundingLines,
        stackTrace,
        integrationData,
        sessionInfo,
    };
}
//# sourceMappingURL=ai-context-builder.js.map