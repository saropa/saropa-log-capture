/**
 * Reader for split log session parts (base.log + base_002.log, base_003.log, ...).
 * Extracted from log-viewer-provider-load.ts to keep that file under the 300-line limit.
 */

import * as vscode from "vscode";

export interface SessionLogPart {
  readonly uri: vscode.Uri;
  readonly lines: string[];
}

function parsePartNumberForBase(name: string, base: string): number | undefined {
  if (!name.toLowerCase().endsWith(".log")) { return undefined; }
  if (name.toLowerCase() === `${base}.log`.toLowerCase()) { return 1; }
  const lower = name.toLowerCase();
  const prefix = `${base}_`.toLowerCase();
  if (!lower.startsWith(prefix)) { return undefined; }
  const tail = lower.slice(prefix.length, -4);
  if (!/^\d{3}$/.test(tail)) { return undefined; }
  const parsed = Number.parseInt(tail, 10);
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : undefined;
}

async function readLogPartLines(partUri: vscode.Uri): Promise<string[] | undefined> {
  try {
    const raw = await vscode.workspace.fs.readFile(partUri);
    return Buffer.from(raw).toString("utf-8").split(/\r?\n/);
  } catch {
    return undefined;
  }
}

/** Read all split log parts for the same session (base.log + base_XXX.log), sorted by part number. */
export async function readSessionLogParts(
  uri: vscode.Uri,
  fallbackText: string,
): Promise<SessionLogPart[]> {
  const fileName = (uri.fsPath.split(/[/\\]/).pop() ?? "");
  const m = /^(.+?)(?:_(\d{3}))?\.log$/i.exec(fileName);
  if (!m) {
    return [{ uri, lines: fallbackText.split(/\r?\n/) }];
  }
  const base = m[1];
  const dir = vscode.Uri.joinPath(uri, "..");
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(dir);
  } catch {
    return [{ uri, lines: fallbackText.split(/\r?\n/) }];
  }

  const partEntries: Array<{ uri: vscode.Uri; part: number }> = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File) { continue; }
    const partNum = parsePartNumberForBase(name, base);
    if (!partNum) { continue; }
    partEntries.push({ uri: vscode.Uri.joinPath(dir, name), part: partNum });
  }

  if (partEntries.length === 0) {
    return [{ uri, lines: fallbackText.split(/\r?\n/) }];
  }
  partEntries.sort((a, b) => a.part - b.part);

  const parts: SessionLogPart[] = [];
  for (const p of partEntries) {
    const lines = await readLogPartLines(p.uri);
    if (lines) { parts.push({ uri: p.uri, lines }); }
  }
  return parts.length > 0 ? parts : [{ uri, lines: fallbackText.split(/\r?\n/) }];
}
