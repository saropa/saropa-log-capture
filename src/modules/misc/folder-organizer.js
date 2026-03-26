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
exports.organizeLogFiles = organizeLogFiles;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const datePrefixPattern = /^(\d{8})_/;
/**
 * Move top-level log files with a yyyymmdd_ prefix into date subfolders.
 * Updates central metadata store when metaStore is provided.
 * @returns The number of files moved.
 */
async function organizeLogFiles(logDirUri, metaStore) {
    const { fileTypes } = (0, config_1.getConfig)();
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(logDirUri);
    }
    catch {
        return 0;
    }
    const topLevelFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && (0, config_1.isTrackedFile)(name, fileTypes))
        .map(([name]) => name);
    let moved = 0;
    for (const name of topLevelFiles) {
        const match = datePrefixPattern.exec(name);
        if (!match) {
            continue;
        }
        const dateFolder = match[1];
        const destDir = vscode.Uri.joinPath(logDirUri, dateFolder);
        await vscode.workspace.fs.createDirectory(destDir);
        const srcUri = vscode.Uri.joinPath(logDirUri, name);
        const destUri = vscode.Uri.joinPath(destDir, name);
        const meta = metaStore ? await metaStore.loadMetadata(srcUri) : {};
        await vscode.workspace.fs.rename(srcUri, destUri, { overwrite: true });
        if (metaStore && Object.keys(meta).length > 0) {
            await metaStore.saveMetadata(destUri, meta);
            await metaStore.deleteMetadata(srcUri);
        }
        moved++;
    }
    return moved;
}
//# sourceMappingURL=folder-organizer.js.map