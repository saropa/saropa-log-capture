"use strict";
/**
 * Investigation .slc bundle: build ZIP buffer, export to file, import from bundle.
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
exports.buildInvestigationZipBuffer = buildInvestigationZipBuffer;
exports.exportInvestigationToBuffer = exportInvestigationToBuffer;
exports.exportInvestigationToSlc = exportInvestigationToSlc;
exports.importInvestigationFromSlc = importInvestigationFromSlc;
const vscode = __importStar(require("vscode"));
const jszip_1 = __importDefault(require("jszip"));
const l10n_1 = require("../../l10n");
const config_1 = require("../config/config");
const slc_session_files_1 = require("./slc-session-files");
const slc_types_1 = require("./slc-types");
async function resolveInvestigationSourceUris(source, workspaceUri) {
    const mainUri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    const uris = [mainUri];
    if (source.type !== 'session') {
        return uris;
    }
    const sidecars = await (0, slc_session_files_1.findSidecarUris)(mainUri);
    uris.push(...sidecars);
    return uris;
}
/**
 * Build an investigation .slc (ZIP) bundle in memory. Used for file export and Gist upload.
 */
async function buildInvestigationZipBuffer(investigation, workspaceUri) {
    const manifestSources = [];
    const zip = new jszip_1.default();
    const seenBasenames = new Map();
    function uniqueFilename(basename) {
        const count = seenBasenames.get(basename) ?? 0;
        seenBasenames.set(basename, count + 1);
        return count === 0 ? basename : `${count}_${basename}`;
    }
    for (const source of investigation.sources) {
        const uris = await resolveInvestigationSourceUris(source, workspaceUri);
        const mainUri = uris[0];
        let mainBasename;
        try {
            mainBasename = mainUri.path.split(/[/\\]/).pop() ?? 'file';
        }
        catch {
            continue;
        }
        const bundleFilename = uniqueFilename(mainBasename);
        manifestSources.push({
            type: source.type,
            filename: bundleFilename,
            label: source.label,
        });
        const stem = bundleFilename.replace(/\.log$/i, '');
        for (let i = 0; i < uris.length; i++) {
            try {
                const data = await vscode.workspace.fs.readFile(uris[i]);
                const name = i === 0 ? bundleFilename : stem + (uris[i].path.match(/\.[^.]+$/)?.[0] ?? '');
                zip.file(`${slc_types_1.SOURCES_FOLDER}/${name}`, data);
            }
            catch {
                /* Skip missing or unreadable files; source still appears in manifest. */
            }
        }
    }
    const manifest = {
        version: slc_types_1.MANIFEST_VERSION_INVESTIGATION,
        type: 'investigation',
        investigation: {
            name: investigation.name,
            notes: investigation.notes,
            lastSearchQuery: investigation.lastSearchQuery,
            sources: manifestSources,
        },
    };
    const investigationJson = {
        name: investigation.name,
        notes: investigation.notes,
        lastSearchQuery: investigation.lastSearchQuery,
        sources: investigation.sources.map(s => ({
            type: s.type,
            label: s.label,
            pinnedAt: s.pinnedAt,
        })),
    };
    zip.file(slc_types_1.MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
    zip.file(slc_types_1.INVESTIGATION_JSON_FILENAME, JSON.stringify(investigationJson, null, 2));
    const blob = await zip.generateAsync({ type: 'nodebuffer' });
    return Buffer.from(blob);
}
/**
 * Export an investigation to a .slc (ZIP) buffer in memory. Use for Gist upload or other in-memory use.
 */
async function exportInvestigationToBuffer(investigation, workspaceUri) {
    return buildInvestigationZipBuffer(investigation, workspaceUri);
}
/**
 * Export an investigation to a .slc (ZIP) bundle with manifest v3, investigation.json, and sources/.
 * Returns the saved file URI, or undefined if cancelled or failed.
 */
async function exportInvestigationToSlc(investigation, workspaceUri) {
    const defaultName = (investigation.name.replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'investigation') + '.slc';
    const picked = await vscode.window.showSaveDialog({
        defaultUri: workspaceUri ? vscode.Uri.joinPath(workspaceUri, defaultName) : undefined,
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
    const buffer = await buildInvestigationZipBuffer(investigation, workspaceUri);
    await vscode.workspace.fs.writeFile(targetUri, buffer);
    return targetUri;
}
/**
 * Import an investigation .slc bundle: extract sources into workspace log directory and create investigation.
 */
async function importInvestigationFromSlc(zip, manifest) {
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
    const invMeta = manifest.investigation;
    const now = Date.now();
    const investigationId = `${now}-${Math.random().toString(36).slice(2, 11)}`;
    const sources = [];
    const extractedPaths = new Set();
    for (const src of invMeta.sources) {
        const stem = src.filename.replace(/\.log$/i, '');
        const prefix = `${slc_types_1.SOURCES_FOLDER}/${stem}`;
        const toExtract = [];
        zip.forEach((path) => {
            if (path === `${slc_types_1.SOURCES_FOLDER}/${src.filename}` || (path.startsWith(prefix) && path.indexOf('/', prefix.length) < 0)) {
                toExtract.push(path);
            }
        });
        for (const path of toExtract) {
            const entry = zip.file(path);
            if (!entry) {
                continue;
            }
            const name = path.slice(slc_types_1.SOURCES_FOLDER.length + 1);
            const targetUri = vscode.Uri.joinPath(logDir, name);
            try {
                const data = await entry.async('nodebuffer');
                await vscode.workspace.fs.writeFile(targetUri, Buffer.from(data));
            }
            catch (e) {
                vscode.window.showErrorMessage((0, l10n_1.t)('msg.slcImportReadFailed', e instanceof Error ? e.message : String(e)));
                return undefined;
            }
        }
        const mainRelativePath = vscode.workspace.asRelativePath(vscode.Uri.joinPath(logDir, src.filename), false);
        if (extractedPaths.has(mainRelativePath)) {
            continue;
        }
        extractedPaths.add(mainRelativePath);
        sources.push({
            type: src.type,
            relativePath: mainRelativePath,
            label: src.label,
            pinnedAt: now,
        });
    }
    const investigation = {
        id: investigationId,
        name: invMeta.name,
        createdAt: now,
        updatedAt: now,
        sources,
        notes: invMeta.notes,
        lastSearchQuery: invMeta.lastSearchQuery,
    };
    return { investigation };
}
//# sourceMappingURL=slc-investigation.js.map