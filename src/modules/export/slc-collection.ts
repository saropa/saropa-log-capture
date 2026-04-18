/**
 * Collection .slc bundle: build ZIP buffer, export to file, import from bundle.
 */

import * as vscode from 'vscode';
import JSZip from 'jszip';
import { t } from '../../l10n';
import { getLogDirectoryUri } from '../config/config';
import type { Collection, CollectionSource } from '../collection/collection-types';
import { findSidecarUris } from './slc-session-files';
import {
    MANIFEST_VERSION_COLLECTION,
    MANIFEST_FILENAME,
    COLLECTION_JSON_FILENAME,
    SOURCES_FOLDER,
    type SlcManifest,
    type SlcManifestCollectionSource,
    type SlcManifestCollection,
    type ImportCollectionResult,
} from './slc-types';

async function resolveCollectionSourceUris(
    source: CollectionSource,
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
 * Build a collection .slc (ZIP) bundle in memory. Used for file export and Gist upload.
 */
export async function buildCollectionZipBuffer(
    collection: Collection,
    workspaceUri: vscode.Uri,
): Promise<Buffer> {
    const manifestSources: SlcManifestCollectionSource[] = [];
    const zip = new JSZip();
    const seenBasenames = new Map<string, number>();

    function uniqueFilename(basename: string): string {
        const count = seenBasenames.get(basename) ?? 0;
        seenBasenames.set(basename, count + 1);
        return count === 0 ? basename : `${count}_${basename}`;
    }

    for (const source of collection.sources) {
        const uris = await resolveCollectionSourceUris(source, workspaceUri);
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
        version: MANIFEST_VERSION_COLLECTION,
        type: 'collection',
        collection: {
            name: collection.name,
            notes: collection.notes,
            lastSearchQuery: collection.lastSearchQuery,
            sources: manifestSources,
        },
    };
    const collectionJson = {
        name: collection.name,
        notes: collection.notes,
        lastSearchQuery: collection.lastSearchQuery,
        sources: collection.sources.map(s => ({
            type: s.type,
            label: s.label,
            pinnedAt: s.pinnedAt,
        })),
    };
    zip.file(MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
    zip.file(COLLECTION_JSON_FILENAME, JSON.stringify(collectionJson, null, 2));
    const blob = await zip.generateAsync({ type: 'nodebuffer' });
    return Buffer.from(blob);
}

/**
 * Export a collection to a .slc (ZIP) buffer in memory. Use for Gist upload or other in-memory use.
 */
export async function exportCollectionToBuffer(
    collection: Collection,
    workspaceUri: vscode.Uri,
): Promise<Buffer> {
    return buildCollectionZipBuffer(collection, workspaceUri);
}

/**
 * Export a collection to a .slc (ZIP) bundle with manifest v3, collection.json, and sources/.
 * Returns the saved file URI, or undefined if cancelled or failed.
 */
export async function exportCollectionToSlc(
    collection: Collection,
    workspaceUri: vscode.Uri,
): Promise<vscode.Uri | undefined> {
    const defaultName = (collection.name.replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'collection') + '.slc';
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

    const buffer = await buildCollectionZipBuffer(collection, workspaceUri);
    await vscode.workspace.fs.writeFile(targetUri, buffer);
    return targetUri;
}

/**
 * Import a collection .slc bundle: extract sources into workspace log directory and create collection.
 */
export async function importCollectionFromSlc(
    zip: JSZip,
    manifest: SlcManifest & { type: 'collection'; collection: SlcManifestCollection },
): Promise<ImportCollectionResult | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showErrorMessage(t('msg.slcImportNoWorkspace'));
        return undefined;
    }
    const logDir = getLogDirectoryUri(folder);
    try {
        await vscode.workspace.fs.createDirectory(logDir);
    } catch { /* may exist */ }

    const invMeta = manifest.collection;
    const now = Date.now();
    const collectionId = `${now}-${Math.random().toString(36).slice(2, 11)}`;
    const sources: CollectionSource[] = [];
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

    const collection: Collection = {
        id: collectionId,
        name: invMeta.name,
        createdAt: now,
        updatedAt: now,
        sources,
        notes: invMeta.notes,
        lastSearchQuery: invMeta.lastSearchQuery,
    };
    return { collection };
}
