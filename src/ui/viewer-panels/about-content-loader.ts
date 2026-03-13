/**
 * Loads CHANGELOG excerpt for the About panel. Shared by sidebar and pop-out message handlers.
 */

import * as vscode from "vscode";
import { buildChangelogUrl as buildChangelogUrlFromBase } from "../../modules/marketplace-url";

const MAX_EXCERPT_CHARS = 6000;
const MAX_SECTIONS = 3;

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
  extensionUri: vscode.Uri,
  extensionVersion: string | undefined,
  extensionId: string,
  post: (msg: unknown) => void,
): Promise<void> {
  const version = formatAboutVersion(extensionVersion);
  const changelogUrl = buildChangelogUrl(extensionId);
  try {
    const uri = vscode.Uri.joinPath(extensionUri, "CHANGELOG.md");
    const buf = await vscode.workspace.fs.readFile(uri);
    const full = Buffer.from(buf).toString("utf-8");
    const sections = full.split(/\n(?=##\s)/);
    const excerpt = sections.slice(0, MAX_SECTIONS).join("\n").slice(0, MAX_EXCERPT_CHARS);
    post({ type: "aboutContent", version, changelogExcerpt: excerpt, changelogUrl });
  } catch {
    post({ type: "aboutContent", version, changelogExcerpt: "", changelogUrl });
  }
}
