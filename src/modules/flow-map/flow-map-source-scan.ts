/**
 * Source 3 (plan 056): walks the target project's source to build a screen registry the builder
 * joins runtime breadcrumbs against. Best-effort and non-fatal — if the project root is missing or
 * unreadable, an empty index is returned and the map degrades to runtime-only. Uses
 * `vscode.workspace.fs` (not node fs) per project rules.
 */

import * as vscode from 'vscode';
import type { ScanIndex } from './flow-map-builder';
import { CONTACTS_PRESET, deriveScreenIdentity, type ScanPreset } from './flow-map-presets';

/** Hard cap on files visited so a misconfigured root can't run away. */
const MAX_FILES = 2000;

/** True when a file name ends in one of the preset's screen suffixes. */
function isScreenFile(name: string, preset: ScanPreset): boolean {
    return preset.fileSuffixes.some(s => name.endsWith(s));
}

/** Recursively collect screen-file URIs under a directory, bounded by MAX_FILES. */
async function collectScreenFiles(dir: vscode.Uri, preset: ScanPreset, out: vscode.Uri[]): Promise<void> {
    if (out.length >= MAX_FILES) {
        return;
    }
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return; // unreadable dir — skip, stay non-fatal
    }
    for (const [name, type] of entries) {
        const child = vscode.Uri.joinPath(dir, name);
        if (type === vscode.FileType.Directory) {
            await collectScreenFiles(child, preset, out);
        } else if (isScreenFile(name, preset)) {
            out.push(child);
        }
    }
}

/** Find the screen class declaration in a file's text; returns name + 1-based line, or undefined. */
function findScreenClass(text: string, preset: ScanPreset): { className: string; line: number } | undefined {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const m = preset.classRe.exec(lines[i]);
        if (m) {
            return { className: m[1], line: i + 1 };
        }
    }
    return undefined;
}

/** Project-relative, forward-slashed path of a file under the root. */
function relativePath(fileUri: vscode.Uri, rootUri: vscode.Uri): string {
    const root = rootUri.path.replace(/\/+$/, '');
    const full = fileUri.path;
    return full.toLowerCase().startsWith(root.toLowerCase() + '/')
        ? full.slice(root.length + 1)
        : full;
}

/** Read one screen file and add its identity to the index. */
async function indexFile(fileUri: vscode.Uri, rootUri: vscode.Uri, preset: ScanPreset, index: ScanIndex): Promise<void> {
    let text: string;
    try {
        text = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf-8');
    } catch {
        return;
    }
    const found = findScreenClass(text, preset);
    if (!found) {
        return;
    }
    const id = deriveScreenIdentity(found.className);
    // First declaration wins; do not overwrite an already-indexed screen of the same key.
    if (!index.has(id.key)) {
        index.set(id.key, { label: id.label, source: { file: relativePath(fileUri, rootUri), line: found.line } });
    }
}

/**
 * Scan the target project root for screen classes and return a ScanIndex. Returns an empty index
 * (never throws) when the root is absent or unreadable, so the caller degrades to a runtime-only map.
 */
export async function scanProjectScreens(projectRoot: string | undefined, preset: ScanPreset = CONTACTS_PRESET): Promise<ScanIndex> {
    const index: ScanIndex = new Map();
    if (!projectRoot) {
        return index;
    }
    const rootUri = vscode.Uri.file(projectRoot);
    for (const dir of preset.viewDirs) {
        const files: vscode.Uri[] = [];
        await collectScreenFiles(vscode.Uri.joinPath(rootUri, ...dir.split('/')), preset, files);
        for (const file of files) {
            await indexFile(file, rootUri, preset, index);
        }
    }
    return index;
}
