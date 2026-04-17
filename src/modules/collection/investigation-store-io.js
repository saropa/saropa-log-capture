"use strict";
/**
 * Investigation file I/O. Load/save .saropa/investigations.json.
 * Extracted to keep investigation-store.ts under the line limit.
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
exports.SAROPA_FOLDER = exports.INVESTIGATIONS_FILENAME = void 0;
exports.getInvestigationsFileUri = getInvestigationsFileUri;
exports.loadInvestigationsFile = loadInvestigationsFile;
exports.saveInvestigationsFile = saveInvestigationsFile;
const vscode = __importStar(require("vscode"));
exports.INVESTIGATIONS_FILENAME = 'investigations.json';
exports.SAROPA_FOLDER = '.saropa';
function getInvestigationsFileUri() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }
    return vscode.Uri.joinPath(folder.uri, exports.SAROPA_FOLDER, exports.INVESTIGATIONS_FILENAME);
}
async function loadInvestigationsFile() {
    const uri = getInvestigationsFileUri();
    if (!uri) {
        return { version: 1, investigations: [] };
    }
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const json = JSON.parse(Buffer.from(data).toString('utf-8'));
        if (json.version !== 1 || !Array.isArray(json.investigations)) {
            return { version: 1, investigations: [] };
        }
        return json;
    }
    catch {
        return { version: 1, investigations: [] };
    }
}
async function saveInvestigationsFile(file) {
    const uri = getInvestigationsFileUri();
    if (!uri) {
        return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }
    const saropaDir = vscode.Uri.joinPath(folder.uri, exports.SAROPA_FOLDER);
    try {
        await vscode.workspace.fs.createDirectory(saropaDir);
    }
    catch { /* may exist */ }
    const content = JSON.stringify(file, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
}
//# sourceMappingURL=investigation-store-io.js.map