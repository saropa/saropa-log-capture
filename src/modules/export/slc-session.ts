/**
 * Session .slc bundle: export (main log + parts + sidecars + metadata) and import.
 */

import * as vscode from 'vscode';
import JSZip from 'jszip';
import { t } from '../../l10n';
import { getLogDirectoryUri } from '../config/config';
import { SessionMetadataStore } from '../session/session-metadata';
import type { SessionMeta } from '../session/session-metadata';
import { findSidecarUris, findSplitPartUris } from './slc-session-files';
import {
    MANIFEST_VERSION,
    MANIFEST_FILENAME,
    METADATA_FILENAME,
    type SlcManifest,
    type ImportSessionResult,
} from './slc-types';

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
 * Import a session .slc bundle: extract log files into the workspace log directory and merge metadata.
 */
export async function importSessionFromSlc(zip: JSZip, manifest: SlcManifest): Promise<ImportSessionResult | undefined> {
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
