/**
 * Shared types and constants for .slc bundle manifest (session v1/v2 and collection v3).
 */

import * as vscode from 'vscode';
import type { Collection } from '../collection/collection-types';

export const MANIFEST_VERSION = 2;
export const MANIFEST_VERSION_COLLECTION = 3;
export const MANIFEST_FILENAME = 'manifest.json';
export const METADATA_FILENAME = 'metadata.json';
export const COLLECTION_JSON_FILENAME = 'collection.json';
export const SOURCES_FOLDER = 'sources';

export interface SlcManifestSession {
    version: 1 | 2;
    mainLog: string;
    parts: string[];
    sidecars?: string[];
    displayName?: string;
}

export interface SlcManifestCollectionSource {
    type: 'session' | 'file';
    filename: string;
    label: string;
}

export interface SlcManifestCollection {
    name: string;
    notes?: string;
    lastSearchQuery?: string;
    sources: SlcManifestCollectionSource[];
}

/** Union manifest: session (v1/v2) or collection (v3). */
export interface SlcManifest {
    version: number;
    type?: 'session' | 'collection';
    mainLog?: string;
    parts?: string[];
    sidecars?: string[];
    displayName?: string;
    collection?: SlcManifestCollection;
}

export interface ImportSessionResult {
    mainLogUri: vscode.Uri;
}

export interface ImportCollectionResult {
    collection: Collection;
}

export type ImportSlcResult = ImportSessionResult | ImportCollectionResult;
