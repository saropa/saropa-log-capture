"use strict";
/**
 * Helpers to find session-related files: sidecars and split part logs.
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
exports.SIDECAR_EXTENSIONS = void 0;
exports.findSidecarUris = findSidecarUris;
exports.findSplitPartUris = findSplitPartUris;
const vscode = __importStar(require("vscode"));
/** Known sidecar extensions from integration providers. */
exports.SIDECAR_EXTENSIONS = [
    '.perf.json',
    '.terminal.log',
    '.events.json',
    '.container.log',
    '.crash-dumps.json',
    '.linux.log',
    '.requests.json',
    '.queries.json',
    '.browser.json',
    '.security.json',
    '.audit.json',
    '.unified.jsonl',
];
/**
 * Find integration sidecar files for a session log file.
 * Sidecars are named basename.{type}.{ext} (e.g. session.perf.json, session.terminal.log).
 */
async function findSidecarUris(mainLogUri) {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) {
        return [];
    }
    const base = baseMatch[1];
    const results = [];
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return [];
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) {
            continue;
        }
        if (!name.startsWith(base + '.')) {
            continue;
        }
        const isSidecar = exports.SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        if (isSidecar) {
            results.push(vscode.Uri.joinPath(dir, name));
        }
    }
    results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return results;
}
/**
 * Find split part log files for a main log file (e.g. base_002.log, base_003.log).
 * Main file is e.g. base.log or base_001.log; we look for base_002.log, base_003.log, ...
 */
async function findSplitPartUris(mainLogUri) {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) {
        return [];
    }
    const base = baseMatch[1];
    const partPrefix = `${base}_`;
    const partRegex = /^(.+)_(\d{3})\.log$/i;
    const results = [];
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return [];
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.startsWith(partPrefix) || !name.endsWith('.log')) {
            continue;
        }
        const m = name.match(partRegex);
        if (!m || m[1] !== base) {
            continue;
        }
        const num = parseInt(m[2], 10);
        if (num >= 2) {
            results.push(vscode.Uri.joinPath(dir, name));
        }
    }
    results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return results;
}
//# sourceMappingURL=slc-session-files.js.map