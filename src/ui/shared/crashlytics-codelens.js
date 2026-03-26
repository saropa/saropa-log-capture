"use strict";
/** CodeLens provider that shows Crashlytics crash indicators on affected source files. */
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
exports.CrashlyticsCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../../modules/config/config");
const vscode_fs_read_directory_safe_1 = require("../../modules/misc/vscode-fs-read-directory-safe");
/** Cached mapping: filename → { issueCount, totalEvents, totalUsers }. */
let crashIndex;
let indexBuiltAt = 0;
const indexTtl = 5 * 60_000;
/** CodeLens provider showing Crashlytics production crash indicators on source files. */
class CrashlyticsCodeLensProvider {
    _onChange = new vscode.EventEmitter();
    onDidChangeCodeLenses = this._onChange.event;
    /** Invalidate the index (e.g., after a new Crashlytics query). */
    invalidate() {
        crashIndex = undefined;
        this._onChange.fire();
    }
    async provideCodeLenses(document) {
        const filename = document.uri.fsPath.split(/[\\/]/).pop();
        if (!filename) {
            return [];
        }
        const index = await getOrBuildIndex();
        const info = index.get(filename);
        if (!info) {
            return [];
        }
        const range = new vscode.Range(0, 0, 0, 0);
        const label = `Crashlytics: ${info.issueCount} issue${info.issueCount === 1 ? '' : 's'}, ${info.totalEvents} cached event${info.totalEvents === 1 ? '' : 's'}`;
        return [new vscode.CodeLens(range, { title: label, command: '' })];
    }
}
exports.CrashlyticsCodeLensProvider = CrashlyticsCodeLensProvider;
async function getOrBuildIndex() {
    if (crashIndex && Date.now() - indexBuiltAt < indexTtl) {
        return crashIndex;
    }
    crashIndex = await buildIndexFromCache();
    indexBuiltAt = Date.now();
    return crashIndex;
}
function getCrashlyticsDir() {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        return undefined;
    }
    return (0, config_1.getSaropaCacheCrashlyticsUri)(ws);
}
async function buildIndexFromCache() {
    const index = new Map();
    const cacheDir = getCrashlyticsDir();
    if (!cacheDir) {
        return index;
    }
    const entries = await (0, vscode_fs_read_directory_safe_1.readDirectoryIfExistsAsDirectory)(vscode.workspace.fs, cacheDir);
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith('.json')) {
            continue;
        }
        try {
            const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(cacheDir, name));
            const data = JSON.parse(Buffer.from(raw).toString('utf-8'));
            const events = Array.isArray(data.events) ? data.events : [data];
            const eventCount = events.length;
            // Collect all filenames touched by any event in this issue
            const issueFiles = new Set();
            for (const event of events) {
                extractFilenames(event).forEach(fn => issueFiles.add(fn));
            }
            issueFiles.forEach(fn => {
                const prev = index.get(fn) ?? { issueCount: 0, totalEvents: 0, totalUsers: 0 };
                index.set(fn, { issueCount: prev.issueCount + 1, totalEvents: prev.totalEvents + eventCount, totalUsers: prev.totalUsers });
            });
        }
        catch { /* skip corrupt cache files */ }
    }
    return index;
}
function extractFilenames(event) {
    const names = new Set();
    const thread = event.crashThread;
    if (!thread) {
        return names;
    }
    const frames = thread.frames;
    if (!Array.isArray(frames)) {
        return names;
    }
    for (const f of frames) {
        const fileName = f.fileName;
        if (fileName) {
            names.add(fileName);
        }
    }
    return names;
}
//# sourceMappingURL=crashlytics-codelens.js.map