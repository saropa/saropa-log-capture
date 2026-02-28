/**
 * Loads CHANGELOG excerpt for the About panel. Shared by sidebar and pop-out message handlers.
 */

import * as vscode from "vscode";

const CHANGELOG_URL = "https://marketplace.visualstudio.com/items/Saropa.saropa-log-capture/changelog";
const MAX_EXCERPT_CHARS = 6000;
const MAX_SECTIONS = 3;

/** Build version string for display. */
export function formatAboutVersion(version: string | undefined): string {
  return version ? `v${version}` : "";
}

/** Load CHANGELOG.md from extension and post aboutContent to webview. Runs async; safe to call from message handler. */
export async function loadAndPostAboutContent(
  extensionUri: vscode.Uri,
  extensionVersion: string | undefined,
  post: (msg: unknown) => void,
): Promise<void> {
  const version = formatAboutVersion(extensionVersion);
  try {
    const uri = vscode.Uri.joinPath(extensionUri, "CHANGELOG.md");
    const buf = await vscode.workspace.fs.readFile(uri);
    const full = Buffer.from(buf).toString("utf-8");
    const sections = full.split(/\n(?=##\s)/);
    const excerpt = sections.slice(0, MAX_SECTIONS).join("\n").slice(0, MAX_EXCERPT_CHARS);
    post({ type: "aboutContent", version, changelogExcerpt: excerpt, changelogUrl: CHANGELOG_URL });
  } catch {
    post({ type: "aboutContent", version, changelogExcerpt: "", changelogUrl: CHANGELOG_URL });
  }
}
