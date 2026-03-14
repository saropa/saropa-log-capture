/**
 * Shared types and constants for .slc bundle manifest (session v1/v2 and investigation v3).
 */

import * as vscode from 'vscode';
import type { Investigation } from '../investigation/investigation-types';

export const MANIFEST_VERSION = 2;
export const MANIFEST_VERSION_INVESTIGATION = 3;
export const MANIFEST_FILENAME = 'manifest.json';
export const METADATA_FILENAME = 'metadata.json';
export const INVESTIGATION_JSON_FILENAME = 'investigation.json';
export const SOURCES_FOLDER = 'sources';

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

export interface ImportSessionResult {
    mainLogUri: vscode.Uri;
}

export interface ImportInvestigationResult {
    investigation: Investigation;
}

export type ImportSlcResult = ImportSessionResult | ImportInvestigationResult;
