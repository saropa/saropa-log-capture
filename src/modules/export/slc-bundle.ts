/**
 * .slc session bundle export and import. Export produces a ZIP with manifest.json,
 * metadata.json, log file(s), and integration sidecar files; import extracts into
 * the workspace log directory and merges metadata.
 * v3: investigation bundles (type 'investigation') with investigation.json and sources/.
 * Invoked by exportSlc command and session panel "Export as SLC".
 */
import * as vscode from 'vscode';
import { t } from '../../l10n';
import JSZip from 'jszip';
import { getLogDirectoryUri } from '../config/config';
import { SessionMetadataStore } from '../session/session-metadata';
import type { SessionMeta } from '../session/session-metadata';
import type { Investigation, InvestigationSource } from '../investigation/investigation-types';

const MANIFEST_VERSION = 2;
const MANIFEST_VERSION_INVESTIGATION = 3;
const MANIFEST_FILENAME = 'manifest.json';
const METADATA_FILENAME = 'metadata.json';
const INVESTIGATION_JSON_FILENAME = 'investigation.json';
const SOURCES_FOLDER = 'sources';

export interface SlcManifestSession {
    version: 1 | 2;
    mainLog: string;
    parts: string[];
    sidecars?: string[];
    displayName?: string;
}

export interface SlcManifestInvestigationSource {
    type: 'session' | 'file';
    filename: string;
    label: string;
}

export interface SlcManifestInvestigation {
    name: string;
    notes?: string;
    lastSearchQuery?: string;
    sources: SlcManifestInvestigationSource[];
}

/** Union manifest: session (v1/v2) or investigation (v3). */
export interface SlcManifest {
    version: number;
    type?: 'session' | 'investigation';
    mainLog?: string;
    parts?: string[];
    sidecars?: string[];
    displayName?: string;
    investigation?: SlcManifestInvestigation;
}

/** Returns true if manifest has supported version and required fields. */
export function isSlcManifestValid(manifest: SlcManifest): boolean {
    if (manifest.version === MANIFEST_VERSION_INVESTIGATION && manifest.type === 'investigation') {
        return !!(
            manifest.investigation?.name &&
            Array.isArray(manifest.investigation.sources)
        );
    }
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

/** Result of importing a session bundle. */
export interface ImportSessionResult {
    mainLogUri: vscode.Uri;
}

/** Result of importing an investigation bundle. */
export interface ImportInvestigationResult {
    investigation: Investigation;
}

export type ImportSlcResult = ImportSessionResult | ImportInvestigationResult;

/** Type guard: manifest is v3 investigation bundle. */
function isInvestigationManifest(m: SlcManifest): m is SlcManifest & { type: 'investigation'; investigation: SlcManifestInvestigation } {
    return m.version === MANIFEST_VERSION_INVESTIGATION && m.type === 'investigation' && !!m.investigation;
}

/**
 * Import a .slc bundle: dispatches to session or investigation import based on manifest type.
 */
export async function importSlcBundle(slcUri: vscode.Uri): Promise<ImportSlcResult | undefined> {
    let raw: Uint8Array;
    try {
        raw = await vscode.workspace.fs.readFile(slcUri);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(t('msg.slcImportReadFailed', msg));
        return undefined;
    }
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(raw);
    } catch {
        vscode.window.showErrorMessage(t('msg.slcImportInvalidManifest'));
        return undefined;
    }
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
    if (isInvestigationManifest(manifest)) {
        return importInvestigationFromSlc(slcUri, zip, manifest);
    }
    return importSessionFromSlc(zip, manifest);
}

/**
 * Import a session .slc bundle: extract log files into the workspace log directory and merge metadata.
 */
async function importSessionFromSlc(zip: JSZip, manifest: SlcManifest): Promise<ImportSessionResult | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage(t('msg.slcImportNoWorkspace'));
        return undefined;
    }
    const logDir = getLogDirectoryUri(folder);
    try {
        await vscode.workspace.fs.createDirectory(logDir);
    } catch { /* may exist */ }
    const mainLog = manifest.mainLog!;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const baseStem = (manifest.displayName ?? mainLog.replace(/\.log$/i, ''))
        .replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'imported';
    const mainStem = `${baseStem}_${timestamp}`;
    const mainFileName = `${mainStem}.log`;
    const mainLogUri = vscode.Uri.joinPath(logDir, mainFileName);
    const mainEntry = zip.file(mainLog);
    if (!mainEntry) {
        vscode.window.showErrorMessage(t('msg.slcImportMissingLog', mainLog));
        return undefined;
    }
    const mainData = await mainEntry.async('nodebuffer');
    await vscode.workspace.fs.writeFile(mainLogUri, Buffer.from(mainData));
    const parts = manifest.parts ?? [];
    for (let i = 0; i < parts.length; i++) {
        const partEntry = zip.file(parts[i]);
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

/**
 * Resolve all file URIs for an investigation source (main + sidecars for session type).
 */
async function resolveInvestigationSourceUris(
    source: InvestigationSource,
    workspaceUri: vscode.Uri,
): Promise<vscode.Uri[]> {
    const mainUri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    const uris: vscode.Uri[] = [mainUri];
    if (source.type !== 'session') {
        return uris;
    }
    const sidecars = await findSidecarUris(mainUri);
    uris.push(...sidecars);
    return uris;
}

/**
 * Build an investigation .slc (ZIP) bundle in memory. Used for file export and Gist upload.
 */
export async function buildInvestigationZipBuffer(
    investigation: Investigation,
    workspaceUri: vscode.Uri,
): Promise<Buffer> {
    const manifestSources: SlcManifestInvestigationSource[] = [];
    const zip = new JSZip();
    const seenBasenames = new Map<string, number>();

    function uniqueFilename(basename: string): string {
        const count = seenBasenames.get(basename) ?? 0;
        seenBasenames.set(basename, count + 1);
        return count === 0 ? basename : `${count}_${basename}`;
    }

    for (const source of investigation.sources) {
        const uris = await resolveInvestigationSourceUris(source, workspaceUri);
        const mainUri = uris[0];
        let mainBasename: string;
        try {
            mainBasename = mainUri.path.split(/[/\\]/).pop() ?? 'file';
        } catch {
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
                zip.file(`${SOURCES_FOLDER}/${name}`, data);
            } catch {
                /* Skip missing or unreadable files; source still appears in manifest. */
            }
        }
    }

    const manifest: SlcManifest = {
        version: MANIFEST_VERSION_INVESTIGATION,
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
    zip.file(MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
    zip.file(INVESTIGATION_JSON_FILENAME, JSON.stringify(investigationJson, null, 2));
    const blob = await zip.generateAsync({ type: 'nodebuffer' });
    return Buffer.from(blob);
}

/**
 * Export an investigation to a .slc (ZIP) buffer in memory. Use for Gist upload or other in-memory use.
 */
export async function exportInvestigationToBuffer(
    investigation: Investigation,
    workspaceUri: vscode.Uri,
): Promise<Buffer> {
    return buildInvestigationZipBuffer(investigation, workspaceUri);
}

/**
 * Export an investigation to a .slc (ZIP) bundle with manifest v3, investigation.json, and sources/.
 * Returns the saved file URI, or undefined if cancelled or failed.
 */
export async function exportInvestigationToSlc(
    investigation: Investigation,
    workspaceUri: vscode.Uri,
): Promise<vscode.Uri | undefined> {
    const defaultName = (investigation.name.replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'investigation') + '.slc';
    const picked = await vscode.window.showSaveDialog({
        defaultUri: workspaceUri ? vscode.Uri.joinPath(workspaceUri, defaultName) : undefined,
        filters: { [t('filter.slcBundles')]: ['slc'] },
        saveLabel: t('action.saveSlcBundle'),
    });
    if (!picked) { return undefined; }
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
 * For each manifest source we extract the main file and any sidecar files (same stem) from sources/.
 */
async function importInvestigationFromSlc(
    _slcUri: vscode.Uri,
    zip: JSZip,
    manifest: SlcManifest & { type: 'investigation'; investigation: SlcManifestInvestigation },
): Promise<ImportInvestigationResult | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage(t('msg.slcImportNoWorkspace'));
        return undefined;
    }
    const logDir = getLogDirectoryUri(folder);
    try {
        await vscode.workspace.fs.createDirectory(logDir);
    } catch { /* may exist */ }

    const invMeta = manifest.investigation;
    const now = Date.now();
    const investigationId = `${now}-${Math.random().toString(36).slice(2, 11)}`;
    const sources: InvestigationSource[] = [];
    const extractedPaths = new Set<string>();

    for (const src of invMeta.sources) {
        const stem = src.filename.replace(/\.log$/i, '');
        const prefix = `${SOURCES_FOLDER}/${stem}`;
        const toExtract: string[] = [];
        zip.forEach((path) => {
            if (path === `${SOURCES_FOLDER}/${src.filename}` || (path.startsWith(prefix) && path.indexOf('/', prefix.length) < 0)) {
                toExtract.push(path);
            }
        });
        for (const path of toExtract) {
            const entry = zip.file(path);
            if (!entry) { continue; }
            const name = path.slice(SOURCES_FOLDER.length + 1);
            const targetUri = vscode.Uri.joinPath(logDir, name);
            try {
                const data = await entry.async('nodebuffer');
                await vscode.workspace.fs.writeFile(targetUri, Buffer.from(data));
            } catch (e) {
                vscode.window.showErrorMessage(t('msg.slcImportReadFailed', e instanceof Error ? e.message : String(e)));
                return undefined;
            }
        }
        const mainRelativePath = vscode.workspace.asRelativePath(vscode.Uri.joinPath(logDir, src.filename), false);
        if (extractedPaths.has(mainRelativePath)) { continue; }
        extractedPaths.add(mainRelativePath);
        sources.push({
            type: src.type,
            relativePath: mainRelativePath,
            label: src.label,
            pinnedAt: now,
        });
    }

    const investigation: Investigation = {
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
