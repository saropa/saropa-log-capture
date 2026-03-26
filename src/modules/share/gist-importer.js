"use strict";
/**
 * Import investigation from GitHub Gist or from a URL (raw .slc or base64).
 * Shared flow: fetch or read (file://) → temp file → importSlcBundle → persist investigation and set active.
 * URL import allows: https (any host); http only for same-network LAN (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16–31.x.x); file:// for local .slc.
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
exports.importFromGist = importFromGist;
exports.importFromUrl = importFromUrl;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const slc_bundle_1 = require("../export/slc-bundle");
const l10n_1 = require("../../l10n");
const GIST_API = 'https://api.github.com/gists';
/** GitHub Gist limit; also used as max download size for URL import. */
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100MB
async function writeTempFile(data, suffix) {
    const tmpDir = os.tmpdir();
    const name = `slc-import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${suffix}`;
    const tmpPath = path.join(tmpDir, name);
    const uri = vscode.Uri.file(tmpPath);
    await vscode.workspace.fs.writeFile(uri, data instanceof Buffer ? data : Buffer.from(data));
    return uri;
}
/** If result is an investigation bundle, persist it and set as active; show toast. Returns the investigation or undefined. */
async function persistAndActivateInvestigation(result, store) {
    if (!result || !('investigation' in result)) {
        return undefined;
    }
    const invResult = result;
    await store.addInvestigation(invResult.investigation);
    await store.setActiveInvestigationId(invResult.investigation.id);
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationImported', invResult.investigation.name));
    return invResult.investigation;
}
/** Run import from a temp .slc URI; always deletes the temp file. */
async function importFromSlcUri(tempUri, store) {
    try {
        const result = await (0, slc_bundle_1.importSlcBundle)(tempUri);
        if (result && 'mainLogUri' in result) {
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationImported', 'Session'));
        }
        return persistAndActivateInvestigation(result, store);
    }
    finally {
        try {
            await vscode.workspace.fs.delete(tempUri);
        }
        catch {
            /* ignore */
        }
    }
}
async function importFromGist(gistId, store) {
    const res = await fetch(`${GIST_API}/${gistId}`);
    if (!res.ok) {
        throw new Error((0, l10n_1.t)('msg.importGistNotFound'));
    }
    const gist = (await res.json());
    const slcFile = gist.files?.['investigation.slc.b64'];
    if (!slcFile?.raw_url) {
        throw new Error((0, l10n_1.t)('msg.importGistInvalid'));
    }
    const base64Res = await fetch(slcFile.raw_url);
    if (!base64Res.ok) {
        throw new Error((0, l10n_1.t)('msg.importDownloadFailed'));
    }
    const base64 = await base64Res.text();
    const slcBuffer = Buffer.from(base64, 'base64');
    if (slcBuffer.length > MAX_DOWNLOAD_BYTES) {
        throw new Error((0, l10n_1.t)('msg.importFileTooLarge'));
    }
    const tempUri = await writeTempFile(slcBuffer, '.slc');
    return importFromSlcUri(tempUri, store);
}
/** True if host is localhost or a private/LAN IP (e.g. 192.168.x.x, 10.x.x.x, 172.16–31.x.x). */
function isPrivateOrLocalHost(hostname) {
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
        return true;
    }
    const parts = hostname.replace(/^\[|\]$/g, '').split('.');
    if (parts.length !== 4) {
        return false;
    }
    const [a, b] = parts.map((p) => parseInt(p, 10));
    if (Number.isNaN(a) || Number.isNaN(b)) {
        return false;
    }
    if (a === 10) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return true;
    }
    return false;
}
function isAllowedImportUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        if (u.protocol === 'file:') {
            return { allowed: true, isFile: true };
        }
        if (u.protocol === 'https:') {
            return { allowed: true, isFile: false };
        }
        if (u.protocol === 'http:' && isPrivateOrLocalHost(u.hostname)) {
            return { allowed: true, isFile: false };
        }
        return { allowed: false, isFile: false };
    }
    catch {
        return { allowed: false, isFile: false };
    }
}
/** Import from URL: https, same-network http (LAN), or file://. Validates scheme/host then fetches or reads file. */
async function importFromUrl(url, store) {
    const { allowed, isFile } = isAllowedImportUrl(url);
    if (!allowed) {
        throw new Error((0, l10n_1.t)('msg.importOnlyHttps'));
    }
    if (isFile) {
        const uri = vscode.Uri.parse(url);
        const data = await vscode.workspace.fs.readFile(uri);
        if (data.length > MAX_DOWNLOAD_BYTES) {
            throw new Error((0, l10n_1.t)('msg.importFileTooLarge'));
        }
        const tempUri = await writeTempFile(data, '.slc');
        return importFromSlcUri(tempUri, store);
    }
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
        throw new Error((0, l10n_1.t)('msg.importDownloadFailed'));
    }
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
        const len = parseInt(contentLength, 10);
        if (Number.isFinite(len) && len > MAX_DOWNLOAD_BYTES) {
            throw new Error((0, l10n_1.t)('msg.importFileTooLarge'));
        }
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
        throw new Error((0, l10n_1.t)('msg.importFileTooLarge'));
    }
    let data;
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('base64') || url.includes('.b64')) {
        const text = new TextDecoder().decode(arrayBuffer);
        data = new Uint8Array(Buffer.from(text, 'base64'));
    }
    else {
        data = new Uint8Array(arrayBuffer);
    }
    const tempUri = await writeTempFile(data, '.slc');
    return importFromSlcUri(tempUri, store);
}
//# sourceMappingURL=gist-importer.js.map