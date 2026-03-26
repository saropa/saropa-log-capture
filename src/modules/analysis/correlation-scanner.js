"use strict";
/**
 * Correlation scanner: extract semantic tags from log file content.
 * Scans a log file for source file references and error class names,
 * returning frequency-ranked tags like `file:handler.dart` or `error:SocketException`.
 * Called from session-lifecycle finalizeSession and from the rescanTags command.
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
exports.scanForCorrelationTags = scanForCorrelationTags;
const vscode = __importStar(require("vscode"));
const line_analyzer_1 = require("./line-analyzer");
const maxScanLines = 5000;
const maxTags = 20;
const correlationTypes = new Set(['source-file', 'error-class']);
/** Scan a log file and return frequency-ranked correlation tags. */
async function scanForCorrelationTags(fileUri) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    const freq = new Map();
    for (let i = 0; i < scanLimit; i++) {
        collectTokens(lines[i], freq);
    }
    return rankTags(freq);
}
/** Extract correlation tokens from a line and update frequency map. */
function collectTokens(line, freq) {
    for (const token of (0, line_analyzer_1.extractAnalysisTokens)(line)) {
        if (!correlationTypes.has(token.type)) {
            continue;
        }
        const prefix = token.type === 'source-file' ? 'file' : 'error';
        const tag = `${prefix}:${token.value}`;
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
}
/** Sort tags by frequency descending, return top N sorted alphabetically. */
function rankTags(freq) {
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxTags)
        .map(([tag]) => tag)
        .sort();
}
//# sourceMappingURL=correlation-scanner.js.map