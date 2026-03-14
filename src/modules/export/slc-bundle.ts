/**
 * .slc session bundle export and import. Export produces a ZIP with manifest.json,
 * metadata.json, log file(s), and integration sidecar files; import extracts into
 * the workspace log directory and merges metadata.
 * v3: investigation bundles (type 'investigation') with investigation.json and sources/.
 * Invoked by exportSlc command and session panel "Export as SLC".
 */

import * as vscode from 'vscode';
import JSZip from 'jszip';
import { t } from '../../l10n';
import {
    MANIFEST_VERSION_INVESTIGATION,
    MANIFEST_FILENAME,
    type SlcManifest,
    type SlcManifestSession,
    type SlcManifestInvestigationSource,
    type SlcManifestInvestigation,
    type ImportSessionResult,
    type ImportInvestigationResult,
    type ImportSlcResult,
} from './slc-types';
import { exportSessionToSlc, importSessionFromSlc } from './slc-session';
import {
    exportInvestigationToSlc,
    exportInvestigationToBuffer,
    importInvestigationFromSlc,
} from './slc-investigation';

export type { SlcManifestSession, SlcManifestInvestigationSource, SlcManifestInvestigation, SlcManifest };
export type { ImportSessionResult, ImportInvestigationResult, ImportSlcResult };

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
        return importInvestigationFromSlc(zip, manifest);
    }
    return importSessionFromSlc(zip, manifest);
}

export { exportSessionToSlc, exportInvestigationToSlc, exportInvestigationToBuffer };
