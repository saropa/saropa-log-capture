/**
 * Loads CHANGELOG excerpt for the About panel. Shared by sidebar and pop-out message handlers.
 */

import * as vscode from "vscode";
import { buildChangelogUrl as buildChangelogUrlFromBase } from "../../modules/marketplace-url";
import { getActiveLogDirectoryUri } from "../../modules/config/config";

/** One row in the About panel's Debug section: a meta file or folder the extension uses,
 *  with a usage blurb and whether it currently exists on disk (the key diagnostic signal). */
interface MetaPathInfo {
  readonly label: string;
  readonly usage: string;
  readonly uriString: string;
  readonly fsPath: string;
  readonly kind: "file" | "folder";
  readonly exists: boolean;
}

/** True if the URI resolves to something on disk. */
async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try { await vscode.workspace.fs.stat(uri); return true; } catch { return false; }
}

/** Resolve every meta file/folder the extension reads or writes, with live existence flags.
 *  This is the About panel's Debug section — it lets the user (and support) SEE whether e.g.
 *  the loaded-files history was actually written, instead of guessing. */
async function buildMetaPaths(context: vscode.ExtensionContext): Promise<MetaPathInfo[]> {
  // Override-aware: resolve the directory the Logs panel is actually showing, so the Debug
  // section lists the SAME .loaded-files-history.json that recording writes — even when the
  // panel is on a browsed override root with no workspace folder open.
  const logDir = getActiveLogDirectoryUri(context);
  if (!logDir) { return []; }
  const defs: ReadonlyArray<readonly [string, string, vscode.Uri, "file" | "folder"]> = [
    ["Reports / log directory", "Folder where captured debug sessions and report files are written. Also holds the two metadata files below.", logDir, "folder"],
    ["Session metadata", "Cached per-session display names, tags, severity counts, and parsed header fields — lets the Logs list paint without re-reading every file.", vscode.Uri.joinPath(logDir, ".session-metadata.json"), "file"],
    ["Loaded-files history", "Files you opened by path (Open Log File / drag-drop) so they appear in the Logs list grouped by load day, with their metadata cached.", vscode.Uri.joinPath(logDir, ".loaded-files-history.json"), "file"],
  ];
  const out: MetaPathInfo[] = [];
  for (const [label, usage, uri, kind] of defs) {
    out.push({ label, usage, uriString: uri.toString(), fsPath: uri.fsPath, kind, exists: await pathExists(uri) });
  }
  return out;
}

/** Build changelog URL from extension id (e.g. saropa.saropa-log-capture). */
export function buildChangelogUrl(extensionId: string): string {
  return buildChangelogUrlFromBase(extensionId);
}

/** Build version string for display. */
export function formatAboutVersion(version: string | undefined): string {
  return version ? `v${version}` : "";
}

/** Load CHANGELOG.md from extension and post aboutContent to webview. Runs async; safe to call from message handler. */
export async function loadAndPostAboutContent(
  context: vscode.ExtensionContext,
  extensionVersion: string | undefined,
  post: (msg: unknown) => void,
): Promise<void> {
  // extensionUri + id come from context — derive them here so the signature stays ≤4 params.
  const extensionUri = context.extensionUri;
  const version = formatAboutVersion(extensionVersion);
  const changelogUrl = buildChangelogUrl(context.extension.id);
  const metaPaths = await buildMetaPaths(context);
  try {
    // After repository re-org, the changelog lives under `docs/`, but keep
    // a fallback to the legacy root path to avoid packaging/runtime issues.
    const candidatePaths = ["CHANGELOG.md", "docs/CHANGELOG.md"];
    let changelogUri: vscode.Uri | undefined;
    for (const candidate of candidatePaths) {
      const uri = vscode.Uri.joinPath(extensionUri, ...candidate.split("/"));
      if (await pathExists(uri)) { changelogUri = uri; break; }
    }
    // The changelog now opens in the log viewer (rendered as markdown) instead of being
    // dumped inline in the panel — so we ship its URI, not an excerpt to render here.
    post({
      type: "aboutContent", version, changelogUrl, metaPaths,
      changelogUriString: changelogUri?.toString() ?? "",
    });
  } catch {
    post({ type: "aboutContent", version, changelogUrl, metaPaths, changelogUriString: "" });
  }
}
