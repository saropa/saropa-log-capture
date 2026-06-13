/**
 * Webview UI preview harness.
 *
 * Renders the log-viewer's dashboard surfaces as standalone HTML so they can be
 * screenshotted without launching the full Extension Development Host. The goal is
 * VISUAL ground truth for UI/UX work: real CSS (pulled from getViewerStyles) applied
 * to representative markup, under real VS Code theme variables, at narrow + wide widths.
 *
 * Why this exists: the panels render their content via client-side JS with live data,
 * so reading the CSS source alone cannot tell you how a surface actually looks. This
 * harness closes that gap. Screenshots are throwaway artifacts (written to d:/tmp), the
 * script itself is the durable, re-runnable tool.
 *
 * Run: node scripts/ui-preview/render-surfaces.mjs
 *      (Playwright + chromium must be installed: npm i -D playwright && npx playwright install chromium)
 *
 * Theme values are real VS Code "Dark Modern" / "Light Modern" defaults; any --vscode-*
 * the map omits is covered by the documented fallbacks already baked into the CSS.
 */

import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const outDir = 'd:/tmp/ui-shots';
const tmpStyles = join(__dirname, '.tmp-viewer-styles.mjs');

/* ---- 1. Bundle the shipped CSS so we get the EXACT strings the webview uses ----
   getViewerStyles() is the main bundle; the quality-badge CSS is injected separately by
   viewer-content.ts, so we must concatenate it too or the badges render unstyled (a harness
   artifact that once looked like a real "invisible badge" defect — it was not). */
async function loadCss() {
    await build({
        stdin: {
            contents: `
                import { getViewerStyles } from './src/ui/viewer-styles/viewer-styles';
                import { getQualityBadgeStyles } from './src/ui/viewer-styles/viewer-styles-quality';
                export function getAllCss() { return getViewerStyles() + '\\n' + getQualityBadgeStyles(); }
            `,
            resolveDir: repoRoot,
            loader: 'ts',
        },
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: tmpStyles,
        external: ['vscode'],
        logLevel: 'silent',
    });
    const mod = await import(pathToFileURL(tmpStyles).href + '?t=' + Date.now());
    return mod.getAllCss();
}

/* ---- 2. Real VS Code theme variable maps (only the bare/no-fallback vars need defining) ---- */
const THEMES = {
    dark: {
        'foreground': '#CCCCCC', 'editor-foreground': '#CCCCCC', 'editor-background': '#1F1F1F',
        'descriptionForeground': '#9D9D9D', 'panel-border': '#2B2B2B', 'panel-background': '#181818',
        'sideBar-background': '#181818', 'sideBar-border': '#2B2B2B', 'editorWidget-background': '#202020',
        'focusBorder': '#0078D4', 'button-background': '#0078D4', 'button-foreground': '#FFFFFF',
        'button-hoverBackground': '#026EC1', 'button-border': '#ffffff1a',
        'button-secondaryBackground': '#313131', 'button-secondaryForeground': '#CCCCCC',
        'button-secondaryHoverBackground': '#3C3C3C', 'input-background': '#313131',
        'input-foreground': '#CCCCCC', 'input-border': '#3C3C3C', 'dropdown-background': '#313131',
        'dropdown-foreground': '#CCCCCC', 'dropdown-border': '#3C3C3C', 'badge-background': '#616161',
        'badge-foreground': '#F8F8F8', 'errorForeground': '#F85149', 'editorError-foreground': '#F85149',
        'editorWarning-foreground': '#CCA700', 'textLink-foreground': '#4daafc',
        'textLink-activeForeground': '#4daafc', 'textBlockQuote-background': '#2B2B2B',
        'textCodeBlock-background': '#2B2B2B', 'progressBar-background': '#0078D4', 'widget-border': '#313131',
        'list-hoverBackground': '#2A2D2E', 'list-activeSelectionBackground': '#04395E',
        'list-activeSelectionForeground': '#FFFFFF', 'toolbar-hoverBackground': '#5A5D5E44',
        'debugConsole-errorForeground': '#F85149', 'debugConsole-warningForeground': '#CCA700',
        'debugConsole-infoForeground': '#b695f8', 'debugConsole-sourceForeground': '#89d185',
        'charts-blue': '#4daafc', 'charts-yellow': '#CCA700', 'charts-purple': '#a855f7',
        'testing-iconPassed': '#73C991', 'inputValidation-errorBackground': '#5A1D1D',
        'inputValidation-errorBorder': '#BE1100', 'inputValidation-warningBackground': '#352A05',
        'inputValidation-warningBorder': '#B89500', 'inputValidation-infoBackground': '#063B49',
        'inputValidation-infoBorder': '#1B81A8', 'editor-findMatchHighlightBackground': '#EA5C0055',
        'scrollbarSlider-background': '#79797966', 'scrollbarSlider-hoverBackground': '#646464b3',
        'gitDecoration-modifiedResourceForeground': '#E2C08D',
    },
    light: {
        'foreground': '#3B3B3B', 'editor-foreground': '#3B3B3B', 'editor-background': '#FFFFFF',
        'descriptionForeground': '#767676', 'panel-border': '#E5E5E5', 'panel-background': '#F8F8F8',
        'sideBar-background': '#F8F8F8', 'sideBar-border': '#E5E5E5', 'editorWidget-background': '#F8F8F8',
        'focusBorder': '#005FB8', 'button-background': '#005FB8', 'button-foreground': '#FFFFFF',
        'button-hoverBackground': '#0258A8', 'button-border': '#0000001a',
        'button-secondaryBackground': '#E5E5E5', 'button-secondaryForeground': '#3B3B3B',
        'button-secondaryHoverBackground': '#CCCCCC', 'input-background': '#FFFFFF',
        'input-foreground': '#3B3B3B', 'input-border': '#CECECE', 'dropdown-background': '#FFFFFF',
        'dropdown-foreground': '#3B3B3B', 'dropdown-border': '#CECECE', 'badge-background': '#CCCCCC',
        'badge-foreground': '#3B3B3B', 'errorForeground': '#E51400', 'editorError-foreground': '#E51400',
        'editorWarning-foreground': '#BF8803', 'textLink-foreground': '#005FB8',
        'textLink-activeForeground': '#005FB8', 'textBlockQuote-background': '#F0F0F0',
        'textCodeBlock-background': '#F0F0F0', 'progressBar-background': '#005FB8', 'widget-border': '#E5E5E5',
        'list-hoverBackground': '#F0F0F0', 'list-activeSelectionBackground': '#E4E6F1',
        'list-activeSelectionForeground': '#000000', 'toolbar-hoverBackground': '#B8B8B850',
        'debugConsole-errorForeground': '#E51400', 'debugConsole-warningForeground': '#BF8803',
        'debugConsole-infoForeground': '#7A3EC8', 'debugConsole-sourceForeground': '#388A34',
        'charts-blue': '#005FB8', 'charts-yellow': '#BF8803', 'charts-purple': '#7A3EC8',
        'testing-iconPassed': '#388A34', 'inputValidation-errorBackground': '#F2DEDE',
        'inputValidation-errorBorder': '#BE1100', 'inputValidation-warningBackground': '#FFF8E1',
        'inputValidation-warningBorder': '#B89500', 'inputValidation-infoBackground': '#E3F2FD',
        'inputValidation-infoBorder': '#1B81A8', 'editor-findMatchHighlightBackground': '#EA5C0033',
        'scrollbarSlider-background': '#64646466', 'scrollbarSlider-hoverBackground': '#646464b3',
        'gitDecoration-modifiedResourceForeground': '#895503',
    },
    hc: {
        'foreground': '#FFFFFF', 'editor-foreground': '#FFFFFF', 'editor-background': '#000000',
        'descriptionForeground': '#FFFFFF', 'panel-border': '#6FC3DF', 'panel-background': '#000000',
        'sideBar-background': '#000000', 'sideBar-border': '#6FC3DF', 'editorWidget-background': '#0C141F',
        'focusBorder': '#F38518', 'button-background': '#0F4A85', 'button-foreground': '#FFFFFF',
        'button-hoverBackground': '#0F4A85', 'button-border': '#FFFFFF',
        'button-secondaryBackground': '#000000', 'button-secondaryForeground': '#FFFFFF',
        'button-secondaryHoverBackground': '#0F4A85', 'input-background': '#000000',
        'input-foreground': '#FFFFFF', 'input-border': '#FFFFFF', 'dropdown-background': '#000000',
        'dropdown-foreground': '#FFFFFF', 'dropdown-border': '#FFFFFF', 'badge-background': '#000000',
        'badge-foreground': '#FFFFFF', 'errorForeground': '#F48771', 'editorError-foreground': '#F48771',
        'editorWarning-foreground': '#FFD700', 'textLink-foreground': '#3794FF',
        'textLink-activeForeground': '#3794FF', 'textBlockQuote-background': '#000000',
        'textCodeBlock-background': '#000000', 'progressBar-background': '#0F4A85', 'widget-border': '#6FC3DF',
        'list-hoverBackground': '#000000', 'list-activeSelectionBackground': '#0F4A85',
        'list-activeSelectionForeground': '#FFFFFF', 'toolbar-hoverBackground': '#0F4A85',
        'debugConsole-errorForeground': '#F48771', 'debugConsole-warningForeground': '#FFD700',
        'debugConsole-infoForeground': '#D18AFF', 'debugConsole-sourceForeground': '#89D185',
        'charts-blue': '#3794FF', 'charts-yellow': '#FFD700', 'charts-purple': '#D18AFF',
        'testing-iconPassed': '#89D185', 'inputValidation-errorBackground': '#000000',
        'inputValidation-errorBorder': '#F48771', 'inputValidation-warningBackground': '#000000',
        'inputValidation-warningBorder': '#FFD700', 'inputValidation-infoBackground': '#000000',
        'inputValidation-infoBorder': '#3794FF', 'editor-findMatchHighlightBackground': '#F38518AA',
        'scrollbarSlider-background': '#6FC3DF66', 'scrollbarSlider-hoverBackground': '#6FC3DFb3',
        'gitDecoration-modifiedResourceForeground': '#FFD700',
    },
};

function themeVars(theme) {
    const m = THEMES[theme];
    const lines = Object.entries(m).map(([k, v]) => `  --vscode-${k}: ${v};`);
    // Font family + size are real defaults; mono stack so monospace rows render with a true mono.
    lines.push("  --vscode-editor-font-family: ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace;");
    lines.push('  --vscode-editor-font-size: 13px;');
    lines.push('  --log-font-size: 13px;');
    return `:root{\n${lines.join('\n')}\n}`;
}

/* ---- 3. Representative surface markup (mirrors what the client render functions emit) ---- */
const SURFACES = await import('./surfaces.mjs').then((m) => m.SURFACES);

/* ---- 4. Render loop ---- */
const WIDTHS = [{ tag: 'narrow', px: 320 }, { tag: 'wide', px: 480 }];

async function main() {
    const css = await loadCss();
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch();
    const themes = process.argv.includes('--all-themes') ? ['dark', 'light', 'hc'] : ['dark'];
    let count = 0;
    for (const surface of SURFACES) {
        for (const theme of themes) {
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${themeVars(theme)}\n${css}</style></head>`
                + `<body class="${surface.bodyClass || ''}" style="height:auto;display:block;">`
                + `<div style="width:100%;min-height:100vh;background:var(--vscode-editor-background);">${surface.html}</div>`
                + `</body></html>`;
            for (const w of WIDTHS) {
                const page = await browser.newPage({ viewport: { width: w.px, height: 900 }, deviceScaleFactor: 2 });
                await page.setContent(html, { waitUntil: 'networkidle' });
                const file = join(outDir, `${surface.name}-${theme}-${w.tag}.png`);
                await page.screenshot({ path: file, fullPage: true });
                await page.close();
                count++;
            }
        }
    }
    await browser.close();
    rmSync(tmpStyles, { force: true });
    console.log(`Wrote ${count} screenshot(s) to ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
