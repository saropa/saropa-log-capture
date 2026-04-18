/**
 * .slc session bundle export and import. Export produces a ZIP with manifest.json,
 * metadata.json, log file(s), and integration sidecar files; import extracts into
 * the workspace log directory and merges metadata.
 * v3: collection bundles (type 'collection') with collection.json and sources/.
 * Invoked by exportSlc command and session panel "Export as SLC".
 */

import * as vscode from 'vscode';
import JSZip from 'jszip';
import { t } from '../../l10n';
import {
    MANIFEST_VERSION_COLLECTION,
    MANIFEST_FILENAME,
    type SlcManifest,
    type SlcManifestSession,
    type SlcManifestCollectionSource,
    type SlcManifestCollection,
    type ImportSessionResult,
    type ImportCollectionResult,
    type ImportSlcResult,
} from './slc-types';
import { exportSessionToSlc, importSessionFromSlc } from './slc-session';
import {
    exportCollectionToSlc,
    exportCollectionToBuffer,
    importCollectionFromSlc,
} from './slc-collection';

export type { SlcManifestSession, SlcManifestCollectionSource, SlcManifestCollection, SlcManifest };
export type { ImportSessionResult, ImportCollectionResult, ImportSlcResult };

/** Returns true if manifest has supported version and required fields. */
export function isSlcManifestValid(manifest: SlcManifest): boolean {
    if (manifest.version === MANIFEST_VERSION_COLLECTION && manifest.type === 'collection') {
        return !!(
            manifest.collection?.name &&
            Array.isArray(manifest.collection.sources)
        );
    }
    const validVersion = manifest.version === 1 || manifest.version === 2;
    return validVersion && typeof manifest.mainLog === 'string' && manifest.mainLog.length > 0;
}

function isCollectionManifest(m: SlcManifest): m is SlcManifest & { type: 'collection'; collection: SlcManifestCollection } {
    return m.version === MANIFEST_VERSION_COLLECTION && m.type === 'collection' && !!m.collection;
}

/**
 * Import a .slc bundle: dispatches to session or collection import based on manifest type.
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
    if (isCollectionManifest(manifest)) {
        return importCollectionFromSlc(zip, manifest);
    }
    return importSessionFromSlc(zip, manifest);
}

export { exportSessionToSlc, exportCollectionToSlc, exportCollectionToBuffer };
