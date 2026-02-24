/** File utility functions for tracked log files. */

import * as vscode from 'vscode';

/** Check if a filename matches any tracked file type. Excludes .meta.json sidecars and dotfiles. */
export function isTrackedFile(name: string, fileTypes: readonly string[]): boolean {
  if (name.endsWith('.meta.json') || name.startsWith('.')) { return false; }
  return fileTypes.some(ext => name.endsWith(ext));
}

const maxScanDepth = 10;

/** List tracked files, optionally recursing into subdirectories. Returns relative paths. */
export async function readTrackedFiles(
  dirUri: vscode.Uri,
  fileTypes: readonly string[],
  includeSubfolders: boolean,
): Promise<string[]> {
  return collectFiles(dirUri, fileTypes, includeSubfolders ? maxScanDepth : 0, '');
}

async function collectFiles(dir: vscode.Uri, fileTypes: readonly string[], depth: number, prefix: string): Promise<string[]> {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(dir);
  } catch { return []; }
  const results: string[] = [];
  for (const [name, type] of entries) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (type === vscode.FileType.File && isTrackedFile(name, fileTypes)) {
      results.push(rel);
    } else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
      results.push(...await collectFiles(vscode.Uri.joinPath(dir, name), fileTypes, depth - 1, rel));
    }
  }
  return results;
}

/** Build a glob pattern for file watchers, e.g. "*.{log,txt,md}". */
export function getFileTypeGlob(fileTypes: readonly string[]): string {
  const exts = fileTypes.map(e => e.replace(/^\./, ''));
  return exts.length === 1 ? `*.${exts[0]}` : `*.{${exts.join(',')}}`;
}

/** Returns true if the env var name matches any pattern. Supports * wildcards (glob-style, case-insensitive). */
export function shouldRedactEnvVar(
  name: string,
  patterns: readonly string[],
): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      "^" +
        pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
        "$",
      "i",
    );
    if (regex.test(name)) {
      return true;
    }
  }
  return false;
}
