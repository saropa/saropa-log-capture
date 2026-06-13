/**
 * esbuild entry for the visual harness: produces the real webview HTML document.
 *
 * Imports the actual production assembler (`buildViewerHtml`) so the harness renders exactly
 * what ships, not a hand-made copy. esbuild bundles this with `vscode` aliased to the stub.
 */

import { buildViewerHtml } from '../../src/ui/provider/viewer-content';

/** Build the full viewer HTML document with harness-stable nonce/version. */
export function buildHtml(): string {
  return buildViewerHtml({
    nonce: 'harnessnonce',
    version: 'harness',
    viewerMaxLines: 100000,
  });
}
