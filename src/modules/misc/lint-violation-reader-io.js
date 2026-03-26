"use strict";
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
exports.detectExtension = detectExtension;
exports.readExportFile = readExportFile;
const vscode = __importStar(require("vscode"));
/** Check if the Saropa Lints extension has been used (extension report files exist). */
async function detectExtension(wsRoot) {
    const reportsUri = vscode.Uri.joinPath(wsRoot, 'reports');
    try {
        const entries = await vscode.workspace.fs.readDirectory(reportsUri);
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.Directory || !/^\d{8}$/.test(name)) {
                continue;
            }
            const dirUri = vscode.Uri.joinPath(reportsUri, name);
            const files = await vscode.workspace.fs.readDirectory(dirUri);
            if (files.some(([f]) => f.endsWith('_saropa_extension.md'))) {
                return true;
            }
        }
    }
    catch {
        // reports/ doesn't exist or can't be read
    }
    return false;
}
async function readExportFile(wsRoot) {
    const uri = vscode.Uri.joinPath(wsRoot, 'reports', '.saropa_lints', 'violations.json');
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(data).toString('utf-8'));
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=lint-violation-reader-io.js.map