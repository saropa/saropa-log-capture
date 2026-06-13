/**
 * Generate the real webview HTML for the visual harness.
 *
 * Steps: esbuild-bundle build-entry.ts (with `vscode` aliased to the stub), import the bundle,
 * call buildHtml(), then post-process for standalone rendering:
 *   - strip the CSP <meta> so injected theme styles + acquireVsCodeApi stub are allowed
 *   - point the codicon stylesheet at the local @vscode/codicons dist so glyphs render
 * Output: test/visual/.gen/viewer.html
 */

import * as esbuild from 'esbuild';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const root = process.cwd();
const genDir = path.join(root, 'test', 'visual', '.gen');
mkdirSync(genDir, { recursive: true });

const bundlePath = path.join(genDir, 'build-entry.mjs');

await esbuild.build({
  entryPoints: [path.join(root, 'test', 'visual', 'build-entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundlePath,
  alias: { vscode: path.join(root, 'test', 'visual', 'vscode-stub.mjs') },
  logLevel: 'warning',
});

const mod = await import(pathToFileURL(bundlePath).href + '?t=' + Date.now());
let html = mod.buildHtml();

// Strip CSP: the harness injects a theme <style> and an acquireVsCodeApi stub that a
// nonce-only style-src/script-src would block. Production keeps its CSP; this is harness-only.
html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/i, '');

// Wire codicons from the installed package so the icon-bar / buttons show real glyphs.
const codiconCss = path.join(root, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
if (existsSync(codiconCss)) {
  const href = pathToFileURL(codiconCss).href;
  html = html.replace('</head>', `<link rel="stylesheet" href="${href}">\n</head>`);
}

const outPath = path.join(genDir, 'viewer.html');
writeFileSync(outPath, html);
console.log('Wrote', path.relative(root, outPath), '(' + html.length + ' bytes)');
