"use strict";
/** Persistent store for error triage status (open/closed/muted). */
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
exports.getErrorStatusBatch = getErrorStatusBatch;
exports.setErrorStatus = setErrorStatus;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const safe_json_1 = require("./safe-json");
const filename = '.error-status.json';
function getStatusUri() {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        return undefined;
    }
    return vscode.Uri.joinPath((0, config_1.getLogDirectoryUri)(ws), filename);
}
/** Load all error statuses from the store. */
async function loadStatuses() {
    const uri = getStatusUri();
    if (!uri) {
        return {};
    }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = (0, safe_json_1.parseJSONOrDefault)(Buffer.from(raw), {});
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch {
        return {};
    }
}
/** Get statuses for multiple hashes at once (for batch rendering). */
async function getErrorStatusBatch(hashes) {
    const map = await loadStatuses();
    const result = {};
    for (const h of hashes) {
        result[h] = map[h]?.status ?? 'open';
    }
    return result;
}
/** Set the status of a single error by hash. 'open' deletes the entry. */
async function setErrorStatus(hash, status) {
    const uri = getStatusUri();
    if (!uri) {
        return;
    }
    const map = await loadStatuses();
    if (status === 'open') {
        delete map[hash];
    }
    else {
        map[hash] = { status, updatedAt: Date.now() };
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(map, null, 2)));
}
//# sourceMappingURL=error-status-store.js.map