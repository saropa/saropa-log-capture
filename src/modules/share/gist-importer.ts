/**
 * Import collection from GitHub Gist or from a URL (raw .slc or base64).
 * Shared flow: fetch or read (file://) → temp file → importSlcBundle → persist collection and set active.
 * URL import allows: https (any host); http only for same-network LAN (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16–31.x.x); file:// for local .slc.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { importSlcBundle, type ImportCollectionResult } from '../export/slc-bundle';
import type { Collection } from '../collection/collection-types';
import type { CollectionStore } from '../collection/collection-store';
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

/** If result is a collection bundle, persist it and set as active; show toast. Returns the collection or undefined. */
async function persistAndActivateCollection(
    result: import('../export/slc-bundle').ImportSlcResult | undefined,
    store: CollectionStore,
): Promise<Collection | undefined> {
    if (!result || !('collection' in result)) {
        return undefined;
    }
    const invResult = result as ImportCollectionResult;
    await store.addCollection(invResult.collection);
    await store.setActiveCollectionId(invResult.collection.id);
    vscode.window.showInformationMessage(t('msg.collectionImported', invResult.collection.name));
    return invResult.collection;
}

/** Run import from a temp .slc URI; always deletes the temp file. */
async function importFromSlcUri(
    tempUri: vscode.Uri,
    store: CollectionStore,
): Promise<Collection | undefined> {
    try {
        const result = await importSlcBundle(tempUri);
        if (result && 'mainLogUri' in result) {
            vscode.window.showInformationMessage(t('msg.collectionImported', 'Session'));
        }
        return persistAndActivateCollection(result, store);
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
    store: CollectionStore,
): Promise<Collection | undefined> {
    const res = await fetch(`${GIST_API}/${gistId}`);
    if (!res.ok) {
        throw new Error(t('msg.importGistNotFound'));
    }

    const gist = (await res.json()) as { files?: Record<string, { raw_url?: string }> };
    const slcFile = gist.files?.['collection.slc.b64'];
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

/** True if host is localhost or a private/LAN IP (e.g. 192.168.x.x, 10.x.x.x, 172.16–31.x.x). */
function isPrivateOrLocalHost(hostname: string): boolean {
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

function isAllowedImportUrl(urlStr: string): { allowed: boolean; isFile: boolean } {
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
    } catch {
        return { allowed: false, isFile: false };
    }
}

/** Import from URL: https, same-network http (LAN), or file://. Validates scheme/host then fetches or reads file. */
export async function importFromUrl(
    url: string,
    store: CollectionStore,
): Promise<Collection | undefined> {
    const { allowed, isFile } = isAllowedImportUrl(url);
    if (!allowed) {
        throw new Error(t('msg.importOnlyHttps'));
    }

    if (isFile) {
        const uri = vscode.Uri.parse(url);
        const data = await vscode.workspace.fs.readFile(uri);
        if (data.length > MAX_DOWNLOAD_BYTES) {
            throw new Error(t('msg.importFileTooLarge'));
        }
        const tempUri = await writeTempFile(data, '.slc');
        return importFromSlcUri(tempUri, store);
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
