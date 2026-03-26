"use strict";
/**
 * Save investigation .slc to a shared folder path (team namespace). Path can be local or network.
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
exports.saveToSharedFolder = saveToSharedFolder;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const slc_bundle_1 = require("../export/slc-bundle");
/**
 * Save investigation bundle to sharedFolderPath. Path is used as-is if absolute; otherwise relative to workspace root.
 * Returns the file URI written.
 */
async function saveToSharedFolder(investigation, workspaceUri, sharedFolderPath) {
    const buffer = await (0, slc_bundle_1.exportInvestigationToBuffer)(investigation, workspaceUri);
    const safeName = (investigation.name.replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'investigation') + '.slc';
    const isAbsolute = path.isAbsolute(sharedFolderPath);
    const dirUri = isAbsolute
        ? vscode.Uri.file(sharedFolderPath)
        : vscode.Uri.joinPath(workspaceUri, sharedFolderPath);
    const fileUri = vscode.Uri.joinPath(dirUri, safeName);
    await vscode.workspace.fs.writeFile(fileUri, buffer);
    return fileUri;
}
//# sourceMappingURL=shared-folder.js.map