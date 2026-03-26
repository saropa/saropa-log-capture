"use strict";
/** File utility functions for tracked log files. */
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
exports.isTrackedFile = isTrackedFile;
exports.readTrackedFiles = readTrackedFiles;
exports.getFileTypeGlob = getFileTypeGlob;
exports.shouldRedactEnvVar = shouldRedactEnvVar;
const vscode = __importStar(require("vscode"));
/** Check if a filename matches any tracked file type. Excludes .meta.json and dotfiles. */
function isTrackedFile(name, fileTypes) {
    if (name.endsWith('.meta.json') || name.startsWith('.')) {
        return false;
    }
    return fileTypes.some(ext => name.endsWith(ext));
}
const maxScanDepth = 10;
/** List tracked files, optionally recursing into subdirectories. Returns relative paths. */
async function readTrackedFiles(dirUri, fileTypes, includeSubfolders) {
    return collectFiles(dirUri, fileTypes, includeSubfolders ? maxScanDepth : 0, '');
}
async function collectFiles(dir, fileTypes, depth, prefix) {
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return [];
    }
    const results = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        if (type === vscode.FileType.File && isTrackedFile(name, fileTypes)) {
            results.push(rel);
        }
        else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
            results.push(...await collectFiles(vscode.Uri.joinPath(dir, name), fileTypes, depth - 1, rel));
        }
    }
    return results;
}
/** Build a glob pattern for file watchers, e.g. "*.{log,txt,md}". */
function getFileTypeGlob(fileTypes) {
    const exts = fileTypes.map(e => e.replace(/^\./, ''));
    return exts.length === 1 ? `*.${exts[0]}` : `*.{${exts.join(',')}}`;
}
/** Returns true if the env var name matches any pattern. Supports * wildcards (glob-style, case-insensitive). */
function shouldRedactEnvVar(name, patterns) {
    for (const pattern of patterns) {
        const regex = new RegExp("^" +
            pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
            "$", "i");
        if (regex.test(name)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=config-file-utils.js.map