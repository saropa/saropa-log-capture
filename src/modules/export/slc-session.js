"use strict";
/**
 * Session .slc bundle: export (main log + parts + sidecars + metadata) and import.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSessionToSlc = exportSessionToSlc;
exports.importSessionFromSlc = importSessionFromSlc;
const vscode = __importStar(require("vscode"));
const jszip_1 = __importDefault(require("jszip"));
const l10n_1 = require("../../l10n");
const config_1 = require("../config/config");
const session_metadata_1 = require("../session/session-metadata");
const slc_session_files_1 = require("./slc-session-files");
const slc_types_1 = require("./slc-types");
/**
 * Export a session (main log + split parts + metadata) to a .slc (ZIP) bundle.
 * Returns the saved file URI, or undefined if cancelled or failed.
 */
async function exportSessionToSlc(logUri) {
    const mainName = logUri.path.split(/[/\\]/).pop() ?? 'session.log';
    const defaultName = mainName.replace(/\.log$/i, '') + '.slc';
    const picked = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(logUri, '..', defaultName),
        filters: { [(0, l10n_1.t)('filter.slcBundles')]: ['slc'] },
        saveLabel: (0, l10n_1.t)('action.saveSlcBundle'),
    });
    if (!picked) {
        return undefined;
    }
    let targetUri = picked;
    if (!targetUri.fsPath.toLowerCase().endsWith('.slc')) {
        targetUri = vscode.Uri.file(targetUri.fsPath + '.slc');
    }
    const store = new session_metadata_1.SessionMetadataStore();
    const meta = await store.loadMetadata(logUri);
    const [partUris, sidecarUris] = await Promise.all([
        (0, slc_session_files_1.findSplitPartUris)(logUri),
        (0, slc_session_files_1.findSidecarUris)(logUri),
    ]);
    const partNames = partUris.map(u => u.path.split(/[/\\]/).pop() ?? '');
    const sidecarNames = sidecarUris.map(u => u.path.split(/[/\\]/).pop() ?? '');
    const manifest = {
        version: slc_types_1.MANIFEST_VERSION,
        mainLog: mainName,
        parts: partNames,
        sidecars: sidecarNames.length > 0 ? sidecarNames : undefined,
        displayName: meta.displayName,
    };
    const zip = new jszip_1.default();
    zip.file(slc_types_1.MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
    zip.file(slc_types_1.METADATA_FILENAME, JSON.stringify(meta, null, 2));
    const mainData = await vscode.workspace.fs.readFile(logUri);
    zip.file(mainName, mainData);
    const [partBuffers, sidecarBuffers] = await Promise.all([
        Promise.all(partUris.map(uri => vscode.workspace.fs.readFile(uri))),
        Promise.all(sidecarUris.map(uri => vscode.workspace.fs.readFile(uri))),
    ]);
    partNames.forEach((name, i) => zip.file(name, partBuffers[i]));
    sidecarNames.forEach((name, i) => zip.file(name, sidecarBuffers[i]));
    const blob = await zip.generateAsync({ type: 'nodebuffer' });
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(blob));
    return targetUri;
}
/**
 * Import a session .slc bundle: extract log files into the workspace log directory and merge metadata.
 */
async function importSessionFromSlc(zip, manifest) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportNoWorkspace'));
        return undefined;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    try {
        await vscode.workspace.fs.createDirectory(logDir);
    }
    catch { /* may exist */ }
    const mainLog = manifest.mainLog;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const baseStem = (manifest.displayName ?? mainLog.replace(/\.log$/i, ''))
        .replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'imported';
    const mainStem = `${baseStem}_${timestamp}`;
    const mainFileName = `${mainStem}.log`;
    const mainLogUri = vscode.Uri.joinPath(logDir, mainFileName);
    const mainEntry = zip.file(mainLog);
    if (!mainEntry) {
        vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportMissingLog', mainLog));
        return undefined;
    }
    const mainData = await mainEntry.async('nodebuffer');
    await vscode.workspace.fs.writeFile(mainLogUri, Buffer.from(mainData));
    const parts = manifest.parts ?? [];
    for (let i = 0; i < parts.length; i++) {
        const partEntry = zip.file(parts[i]);
        if (!partEntry) {
            continue;
        }
        const partStem = `${mainStem}_${String(i + 2).padStart(3, '0')}`;
        const partFileName = `${partStem}.log`;
        const partUri = vscode.Uri.joinPath(logDir, partFileName);
        const partData = await partEntry.async('nodebuffer');
        await vscode.workspace.fs.writeFile(partUri, Buffer.from(partData));
    }
    const sidecars = manifest.sidecars ?? [];
    for (const sidecarName of sidecars) {
        const sidecarEntry = zip.file(sidecarName);
        if (!sidecarEntry) {
            continue;
        }
        const extMatch = sidecarName.match(/\.[^.]+\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '';
        const newSidecarName = `${mainStem}${ext}`;
        const sidecarUri = vscode.Uri.joinPath(logDir, newSidecarName);
        const sidecarData = await sidecarEntry.async('nodebuffer');
        await vscode.workspace.fs.writeFile(sidecarUri, Buffer.from(sidecarData));
    }
    const metaFile = zip.file(slc_types_1.METADATA_FILENAME);
    if (metaFile) {
        try {
            const metaJson = await metaFile.async('string');
            const meta = JSON.parse(metaJson);
            const store = new session_metadata_1.SessionMetadataStore();
            meta.displayName = meta.displayName ?? baseStem;
            await store.saveMetadata(mainLogUri, meta);
        }
        catch { /* optional metadata */ }
    }
    return { mainLogUri };
}
//# sourceMappingURL=slc-session.js.map