/**
 * .slc session bundle export and import. Export produces a ZIP with manifest.json,
 * metadata.json, log file(s), and integration sidecar files; import extracts into
 * the workspace log directory and merges metadata.
 * Invoked by exportSlc command and session panel "Export as SLC".
 */
import * as vscode from 'vscode';
import { t } from '../../l10n';
import JSZip from 'jszip';
import { getLogDirectoryUri } from '../config/config';
import { SessionMetadataStore } from '../session/session-metadata';
import type { SessionMeta } from '../session/session-metadata';

const MANIFEST_VERSION = 2;
const MANIFEST_FILENAME = 'manifest.json';
const METADATA_FILENAME = 'metadata.json';

export interface SlcManifest {
    version: number;
    mainLog: string;
    parts: string[];
    sidecars?: string[];
    displayName?: string;
}

/** Returns true if manifest has supported version and required mainLog (for tests and import). */
export function isSlcManifestValid(manifest: SlcManifest): boolean {
    const validVersion = manifest.version === 1 || manifest.version === 2;
    return validVersion && typeof manifest.mainLog === 'string' && manifest.mainLog.length > 0;
}

/** Known sidecar extensions from integration providers. */
const SIDECAR_EXTENSIONS = [
    '.perf.json',
    '.terminal.log',
    '.events.json',
    '.container.log',
    '.crash-dumps.json',
    '.linux.log',
    '.requests.json',
    '.queries.json',
    '.browser.json',
    '.security.json',
    '.audit.json',
];

/**
 * Find integration sidecar files for a session log file.
 * Sidecars are named basename.{type}.{ext} (e.g. session.perf.json, session.terminal.log).
 */
async function findSidecarUris(mainLogUri: vscode.Uri): Promise<vscode.Uri[]> {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) { return []; }
    const base = baseMatch[1];
    const results: vscode.Uri[] = [];
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return [];
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) { continue; }
        if (!name.startsWith(base + '.')) { continue; }
        const isSidecar = SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        if (isSidecar) {
            results.push(vscode.Uri.joinPath(dir, name));
        }
    }
    results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return results;
}

/**
 * Find split part log files for a main log file (e.g. base_002.log, base_003.log).
 * Main file is e.g. base.log or base_001.log; we look for base_002.log, base_003.log, ...
 */
async function findSplitPartUris(mainLogUri: vscode.Uri): Promise<vscode.Uri[]> {
    const dir = vscode.Uri.joinPath(mainLogUri, '..');
    const mainName = mainLogUri.path.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) { return []; }
    const base = baseMatch[1];
    const partPrefix = `${base}_`;
    const partRegex = /^(.+)_(\d{3})\.log$/i;
    const results: vscode.Uri[] = [];
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return [];
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.startsWith(partPrefix) || !name.endsWith('.log')) {
            continue;
        }
        const m = name.match(partRegex);
        if (!m || m[1] !== base) { continue; }
        const num = parseInt(m[2], 10);
        if (num >= 2) {
            results.push(vscode.Uri.joinPath(dir, name));
        }
    }
    results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return results;
}

/**
 * Export a session (main log + split parts + metadata) to a .slc (ZIP) bundle.
 * Returns the saved file URI, or undefined if cancelled or failed.
 */
export async function exportSessionToSlc(logUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const mainName = logUri.path.split(/[/\\]/).pop() ?? 'session.log';
    const defaultName = mainName.replace(/\.log$/i, '') + '.slc';
    const picked = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(logUri, '..', defaultName),
        filters: { [t('filter.slcBundles')]: ['slc'] },
        saveLabel: t('action.saveSlcBundle'),
    });
    if (!picked) { return undefined; }
    let targetUri = picked;
    if (!targetUri.fsPath.toLowerCase().endsWith('.slc')) {
        targetUri = vscode.Uri.file(targetUri.fsPath + '.slc');
    }
    const store = new SessionMetadataStore();
    const meta = await store.loadMetadata(logUri);
    const [partUris, sidecarUris] = await Promise.all([
        findSplitPartUris(logUri),
        findSidecarUris(logUri),
    ]);
    const partNames = partUris.map(u => u.path.split(/[/\\]/).pop() ?? '');
    const sidecarNames = sidecarUris.map(u => u.path.split(/[/\\]/).pop() ?? '');
    const manifest: SlcManifest = {
        version: MANIFEST_VERSION,
        mainLog: mainName,
        parts: partNames,
        sidecars: sidecarNames.length > 0 ? sidecarNames : undefined,
        displayName: meta.displayName,
    };
    const zip = new JSZip();
    zip.file(MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
    zip.file(METADATA_FILENAME, JSON.stringify(meta, null, 2));
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
 * Import a .slc bundle: extract log files into the workspace log directory and merge metadata.
 * Target folder is chosen via workspace folder; log files get unique names to avoid overwriting.
 */
export async function importSlcBundle(slcUri: vscode.Uri): Promise<{ mainLogUri: vscode.Uri } | undefined> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(slcUri);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(t('msg.slcImportReadFailed', msg));
        return undefined;
    }
    const zip = await JSZip.loadAsync(raw);
    const manifestFile = zip.file(MANIFEST_FILENAME);
    if (!manifestFile) {
        vscode.window.showErrorMessage(t('msg.slcImportNoManifest'));
        return undefined;
    }
    const manifestJson = await manifestFile.async('string');
    let manifest: SlcManifest;
    try {
        manifest = JSON.parse(manifestJson) as SlcManifest;
    } catch {
        vscode.window.showErrorMessage(t('msg.slcImportInvalidManifest'));
        return undefined;
    }
    if (!isSlcManifestValid(manifest)) {
        vscode.window.showErrorMessage(t('msg.slcImportInvalidManifest'));
        return undefined;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage(t('msg.slcImportNoWorkspace'));
        return undefined;
    }
    const logDir = getLogDirectoryUri(folder);
    try {
        await vscode.workspace.fs.createDirectory(logDir);
    } catch { /* may exist */ }
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const baseStem = (manifest.displayName ?? manifest.mainLog.replace(/\.log$/i, ''))
        .replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'imported';
    const mainStem = `${baseStem}_${timestamp}`;
    const mainFileName = `${mainStem}.log`;
    const mainLogUri = vscode.Uri.joinPath(logDir, mainFileName);
    const mainEntry = zip.file(manifest.mainLog);
    if (!mainEntry) {
        vscode.window.showErrorMessage(t('msg.slcImportMissingLog', manifest.mainLog));
        return undefined;
    }
    const mainData = await mainEntry.async('nodebuffer');
    await vscode.workspace.fs.writeFile(mainLogUri, Buffer.from(mainData));
    for (let i = 0; i < manifest.parts.length; i++) {
        const partEntry = zip.file(manifest.parts[i]);
        if (!partEntry) { continue; }
        const partStem = `${mainStem}_${String(i + 2).padStart(3, '0')}`;
        const partFileName = `${partStem}.log`;
        const partUri = vscode.Uri.joinPath(logDir, partFileName);
        const partData = await partEntry.async('nodebuffer');
        await vscode.workspace.fs.writeFile(partUri, Buffer.from(partData));
    }
    const sidecars = manifest.sidecars ?? [];
    for (const sidecarName of sidecars) {
        const sidecarEntry = zip.file(sidecarName);
        if (!sidecarEntry) { continue; }
        const extMatch = sidecarName.match(/\.[^.]+\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '';
        const newSidecarName = `${mainStem}${ext}`;
        const sidecarUri = vscode.Uri.joinPath(logDir, newSidecarName);
        const sidecarData = await sidecarEntry.async('nodebuffer');
        await vscode.workspace.fs.writeFile(sidecarUri, Buffer.from(sidecarData));
    }
    const metaFile = zip.file(METADATA_FILENAME);
    if (metaFile) {
        try {
            const metaJson = await metaFile.async('string');
            const meta = JSON.parse(metaJson) as SessionMeta;
            const store = new SessionMetadataStore();
            meta.displayName = meta.displayName ?? baseStem;
            await store.saveMetadata(mainLogUri, meta);
        } catch { /* optional metadata */ }
    }
    return { mainLogUri };
}
