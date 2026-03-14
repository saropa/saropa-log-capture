/**
 * Investigation .slc bundle: build ZIP buffer, export to file, import from bundle.
 */

import * as vscode from 'vscode';
import JSZip from 'jszip';
import { t } from '../../l10n';
import { getLogDirectoryUri } from '../config/config';
import type { Investigation, InvestigationSource } from '../investigation/investigation-types';
import { findSidecarUris } from './slc-session-files';
import {
    MANIFEST_VERSION_INVESTIGATION,
    MANIFEST_FILENAME,
    INVESTIGATION_JSON_FILENAME,
    SOURCES_FOLDER,
    type SlcManifest,
    type SlcManifestInvestigationSource,
    type SlcManifestInvestigation,
    type ImportInvestigationResult,
} from './slc-types';

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
 */
export async function importInvestigationFromSlc(
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
