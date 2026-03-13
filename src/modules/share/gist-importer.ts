/**
 * Import investigation from GitHub Gist or from a URL (raw .slc or base64).
 * Shared flow: fetch → temp file → importSlcBundle → persist investigation and set active.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { importSlcBundle, type ImportInvestigationResult } from '../export/slc-bundle';
import type { Investigation } from '../investigation/investigation-types';
import type { InvestigationStore } from '../investigation/investigation-store';
import { t } from '../../l10n';

const GIST_API = 'https://api.github.com/gists';
/** GitHub Gist limit; also used as max download size for URL import. */
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100MB

async function writeTempFile(data: Uint8Array | Buffer, suffix: string): Promise<vscode.Uri> {
    const tmpDir = os.tmpdir();
    const name = `slc-import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${suffix}`;
    const tmpPath = path.join(tmpDir, name);
    const uri = vscode.Uri.file(tmpPath);
    await vscode.workspace.fs.writeFile(uri, data instanceof Buffer ? data : Buffer.from(data));
    return uri;
}

/** If result is an investigation bundle, persist it and set as active; show toast. Returns the investigation or undefined. */
async function persistAndActivateInvestigation(
    result: import('../export/slc-bundle').ImportSlcResult | undefined,
    store: InvestigationStore,
): Promise<Investigation | undefined> {
    if (!result || !('investigation' in result)) {
        return undefined;
    }
    const invResult = result as ImportInvestigationResult;
    await store.addInvestigation(invResult.investigation);
    await store.setActiveInvestigationId(invResult.investigation.id);
    vscode.window.showInformationMessage(t('msg.investigationImported', invResult.investigation.name));
    return invResult.investigation;
}

/** Run import from a temp .slc URI; always deletes the temp file. */
async function importFromSlcUri(
    tempUri: vscode.Uri,
    store: InvestigationStore,
): Promise<Investigation | undefined> {
    try {
        const result = await importSlcBundle(tempUri);
        if (result && 'mainLogUri' in result) {
            vscode.window.showInformationMessage(t('msg.investigationImported', 'Session'));
        }
        return persistAndActivateInvestigation(result, store);
    } finally {
        try {
            await vscode.workspace.fs.delete(tempUri);
        } catch {
            /* ignore */
        }
    }
}

export async function importFromGist(
    gistId: string,
    store: InvestigationStore,
): Promise<Investigation | undefined> {
    const res = await fetch(`${GIST_API}/${gistId}`);
    if (!res.ok) {
        throw new Error(t('msg.importGistNotFound'));
    }

    const gist = (await res.json()) as { files?: Record<string, { raw_url?: string }> };
    const slcFile = gist.files?.['investigation.slc.b64'];
    if (!slcFile?.raw_url) {
        throw new Error(t('msg.importGistInvalid'));
    }

    const base64Res = await fetch(slcFile.raw_url);
    if (!base64Res.ok) {
        throw new Error(t('msg.importDownloadFailed'));
    }

    const base64 = await base64Res.text();
    const slcBuffer = Buffer.from(base64, 'base64');
    if (slcBuffer.length > MAX_DOWNLOAD_BYTES) {
        throw new Error(t('msg.importFileTooLarge'));
    }

    const tempUri = await writeTempFile(slcBuffer, '.slc');
    return importFromSlcUri(tempUri, store);
}

function isHttpsUrl(urlStr: string): boolean {
    try {
        const u = new URL(urlStr);
        return u.protocol === 'https:';
    } catch {
        return false;
    }
}

export async function importFromUrl(
    url: string,
    store: InvestigationStore,
): Promise<Investigation | undefined> {
    if (!isHttpsUrl(url)) {
        throw new Error(t('msg.importOnlyHttps'));
    }

    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
        throw new Error(t('msg.importDownloadFailed'));
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength) {
        const len = parseInt(contentLength, 10);
        if (Number.isFinite(len) && len > MAX_DOWNLOAD_BYTES) {
            throw new Error(t('msg.importFileTooLarge'));
        }
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
        throw new Error(t('msg.importFileTooLarge'));
    }

    let data: Uint8Array;
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('base64') || url.includes('.b64')) {
        const text = new TextDecoder().decode(arrayBuffer);
        data = new Uint8Array(Buffer.from(text, 'base64'));
    } else {
        data = new Uint8Array(arrayBuffer);
    }

    const tempUri = await writeTempFile(data, '.slc');
    return importFromSlcUri(tempUri, store);
}
