"use strict";
/**
 * Optional Phase 4 artifact: writes `basename.unified.jsonl` next to the main session log
 * after integrations have written sidecars. Each line is JSON: { "source": "debug"|"terminal"|"external:label", "text": "..." }.
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
exports.UNIFIED_SESSION_LOG_SUFFIX = void 0;
exports.writeUnifiedSessionLogIfEnabled = writeUnifiedSessionLogIfEnabled;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
/** Filename suffix for the merged session artifact (same folder as main `.log`). */
exports.UNIFIED_SESSION_LOG_SUFFIX = '.unified.jsonl';
function recordToJsonl(rec) {
    return `${JSON.stringify({ source: rec.source, text: rec.text })}\n`;
}
function findHeaderEnd(lines) {
    const limit = Math.min(lines.length, 50);
    for (let i = 0; i < limit; i++) {
        if (/^={10,}$/.test(lines[i].trim())) {
            const next = i + 1;
            if (next < lines.length && lines[next].trim() === '') {
                return next + 1;
            }
            return next;
        }
    }
    return 0;
}
/**
 * Read the last `maxLines` lines from a file without loading the entire file.
 * This writer is an optional artifact; performance stays predictable by tailing from disk.
 */
function readLastLinesFromDisk(filePath, maxLines) {
    let stat;
    try {
        stat = fs.statSync(filePath);
    }
    catch {
        return [];
    }
    if (stat.size === 0) {
        return [''];
    }
    const chunkBytes = 64 * 1024;
    let pos = stat.size;
    let text = '';
    while (pos > 0) {
        const readBytes = Math.min(chunkBytes, pos);
        pos -= readBytes;
        const buf = Buffer.alloc(readBytes);
        const fd = fs.openSync(filePath, 'r');
        try {
            fs.readSync(fd, buf, 0, readBytes, pos);
        }
        finally {
            fs.closeSync(fd);
        }
        text = buf.toString('utf-8') + text;
        const parts = text.split(/\r?\n/);
        if (parts.length >= maxLines + 1) {
            return parts.slice(-maxLines);
        }
    }
    const parts = text.split(/\r?\n/);
    return parts.length > maxLines ? parts.slice(-maxLines) : parts;
}
/**
 * Write unified JSONL if `integrations.unifiedLog.writeAtSessionEnd` is true.
 * Reads main log (full file), then terminal and external sidecars from disk (same order as viewer).
 */
async function writeUnifiedSessionLogIfEnabled(mainLogUri, baseFileName, config, outputChannel) {
    const ul = config.integrationsUnifiedLog;
    if (!ul.writeAtSessionEnd) {
        return;
    }
    const dirUri = vscode.Uri.joinPath(mainLogUri, '..');
    const cap = Math.max(1000, Math.min(500_000, ul.maxLinesPerSource));
    // Keep the optional artifact bounded when many external sources are configured.
    const maxTotalLines = cap * 4;
    let totalWrittenLines = 0;
    const jsonlParts = [];
    const pushLines = (source, lines) => {
        for (const line of lines) {
            if (totalWrittenLines >= maxTotalLines) {
                return;
            }
            jsonlParts.push(recordToJsonl({ source, text: line }));
            totalWrittenLines += 1;
        }
    };
    try {
        const mainTail = readLastLinesFromDisk(mainLogUri.fsPath, cap + 200);
        const headerEnd = findHeaderEnd(mainTail);
        pushLines('debug', mainTail.slice(headerEnd));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[unifiedLog] Could not read main log: ${msg}`);
        return;
    }
    const terminalUri = vscode.Uri.joinPath(dirUri, `${baseFileName}.terminal.log`);
    try {
        await vscode.workspace.fs.stat(terminalUri);
        const terminalTail = readLastLinesFromDisk(terminalUri.fsPath, cap);
        pushLines('terminal', terminalTail);
    }
    catch {
        // no terminal sidecar
    }
    try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        const prefix = `${baseFileName}.`;
        const terminalName = `${baseFileName}.terminal.log`;
        const externalNames = entries
            .filter(([name, type]) => type === vscode.FileType.File
            && name.startsWith(prefix)
            && name.endsWith('.log')
            && name !== terminalName
            && !name.toLowerCase().endsWith(exports.UNIFIED_SESSION_LOG_SUFFIX.toLowerCase()))
            .map(([name]) => name)
            .sort((a, b) => a.localeCompare(b));
        for (const name of externalNames) {
            const label = name.startsWith(prefix) && name.endsWith('.log')
                ? name.slice(prefix.length, -4)
                : 'external';
            const sourceId = `external:${label}`;
            try {
                const eUri = vscode.Uri.joinPath(dirUri, name);
                const externalTail = readLastLinesFromDisk(eUri.fsPath, cap);
                pushLines(sourceId, externalTail);
            }
            catch {
                // skip
            }
        }
    }
    catch {
        // directory read failed
    }
    const outUri = vscode.Uri.joinPath(dirUri, `${baseFileName}${exports.UNIFIED_SESSION_LOG_SUFFIX}`);
    try {
        const body = jsonlParts.join('');
        await vscode.workspace.fs.writeFile(outUri, Buffer.from(body, 'utf-8'));
        outputChannel.appendLine(`[unifiedLog] Wrote ${totalWrittenLines} line(s) to ${path.basename(outUri.fsPath)}`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[unifiedLog] Write failed: ${msg}`);
    }
}
//# sourceMappingURL=unified-session-log-writer.js.map