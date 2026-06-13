/**
 * Visual harness driver: renders the real webview HTML in Chromium under Dark + Light VS Code
 * theme variables, opens each dashboard surface, feeds mock host→webview messages, and writes
 * screenshots to test/visual/.shots/.
 *
 * Run:  node test/visual/gen-html.mjs && node test/visual/render.mjs
 * Diagnostics only (no surfaces): node test/visual/render.mjs --diagnose
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { themes } from './themes.mjs';
import { surfaces } from './surfaces.mjs';

const root = process.cwd();
const htmlPath = path.join(root, 'test', 'visual', '.gen', 'viewer.html');
const shotDir = path.join(root, 'test', 'visual', '.shots');
mkdirSync(shotDir, { recursive: true });

const diagnoseOnly = process.argv.includes('--diagnose');
const WIDTHS = { narrow: 380, wide: 920 };

/** Build a :root rule that injects every --vscode-* var, plus a sane body default. */
function themeStyle(vars) {
  const decls = Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');
  const bg = vars['--vscode-editor-background'] || '#1e1e1e';
  const fg = vars['--vscode-foreground'] || '#ccc';
  const ff = vars['--vscode-font-family'] || 'sans-serif';
  // Kill animations/transitions so screenshots capture the settled state, not a mid-flight frame
  // (slide-in, flash highlights, expand) that reads as motion blur in a still.
  const noMotion = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}';
  // The slide-out slot is sized by host JS at runtime (workspace state), which the harness doesn't
  // run — so pin it to a realistic panel width and hide the full-area in-viewer crash detail overlay
  // (position:absolute inset:0) so the sidebar LIST renders as one clean column, not overlapped.
  const slot = '#panel-slot{width:360px!important;flex:0 0 360px!important;min-width:360px!important;} #panel-content-row{display:flex!important;} .crashlytics-detail{display:none!important;}';
  return `:root{${decls}} html,body{background:${bg};color:${fg};font-family:${ff};margin:0;} ${noMotion} ${slot}`;
}

// Injected before any page script: stub acquireVsCodeApi (captures postMessages) and paint theme.
function initScript(css) {
  window.__posted = [];
  window.acquireVsCodeApi = () => ({
    postMessage: (m) => { window.__posted.push(m); },
    getState: () => ({}),
    setState: () => {},
  });
  const apply = () => {
    const s = document.createElement('style');
    s.setAttribute('data-harness-theme', '1');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.head) apply(); else document.addEventListener('DOMContentLoaded', apply);
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];

  // Fresh page per (theme, width, surface) so panel state never bleeds between surfaces.
  async function freshPage(themeName, width, tag) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[${tag}] ${msg.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
    await page.addInitScript(initScript, themeStyle(themes[themeName]));
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    return page;
  }

  for (const themeName of Object.keys(themes)) {
    for (const [widthName, width] of Object.entries(WIDTHS)) {
      // Base render (default/empty state).
      const basePage = await freshPage(themeName, width, `${themeName}/${widthName}/base`);
      if (diagnoseOnly && themeName === 'dark' && widthName === 'wide') {
        const diag = await basePage.evaluate(() => {
          const fns = Object.getOwnPropertyNames(window).filter((n) => /open.*panel|panel|signal|crashlytics|recurring|perf/i.test(n) && typeof window[n] === 'function');
          const iconButtons = Array.from(document.querySelectorAll('[id^="ib-"]')).map((e) => e.id);
          const panels = Array.from(document.querySelectorAll('[class*="panel"]')).map((e) => e.className).slice(0, 60);
          return { fns, iconButtons, panels };
        });
        writeFileSync(path.join(shotDir, 'diagnostics.json'), JSON.stringify(diag, null, 2));
        console.log('Diagnostics written. open fns:', diag.fns.length, 'icon buttons:', diag.iconButtons.length);
      }
      await basePage.screenshot({ path: path.join(shotDir, `base.${themeName}.${widthName}.png`), fullPage: true });
      await basePage.close();

      if (diagnoseOnly) continue;

      // One isolated page per surface.
      for (const surface of surfaces) {
        const tag = `${themeName}/${widthName}/${surface.name}`;
        const page = await freshPage(themeName, width, tag);
        try {
          await surface.drive(page);
          await page.waitForTimeout(350);
          // Optional: hover an element first to capture a hover-reveal state (action clusters, etc.).
          if (surface.hover) {
            const h = await page.$(surface.hover);
            if (h) { await h.hover(); await page.waitForTimeout(150); }
          }
          const el = surface.clip ? await page.$(surface.clip) : null;
          const shot = path.join(shotDir, `${surface.name}.${themeName}.${widthName}.png`);
          if (el && (await el.isVisible())) await el.screenshot({ path: shot });
          else await page.screenshot({ path: shot, fullPage: true });
        } catch (e) {
          errors.push(`[${tag}] surface failed: ${e.message}`);
        }
        await page.close();
      }
    }
  }

  await browser.close();
  if (errors.length) {
    writeFileSync(path.join(shotDir, 'errors.log'), errors.join('\n'));
    console.log(`\n${errors.length} console/page errors -> test/visual/.shots/errors.log`);
    console.log(errors.slice(0, 20).join('\n'));
  } else {
    console.log('No console/page errors.');
  }
  console.log('Screenshots in test/visual/.shots/');
}

main().catch((e) => { console.error(e); process.exit(1); });
