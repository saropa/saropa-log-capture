/**
 * Shared design-token layer for the log viewer webview.
 *
 * Phase 1 of adopting the canonical Saropa Dashboard & Webview Style Guide
 * (D:\src\saropa_lints\docs\design\SAROPA_DASHBOARD_STYLE_GUIDE.md, §3).
 * This module is the single source of truth for the guide's named tokens; it
 * resolves each one to the VS Code host theme so the viewer stays theme-aware
 * in light, dark, and high-contrast modes. Dashboard-class panels (SQL history,
 * Crashlytics, Performance, Signal report) consume these names instead of raw
 * hex / magic pixels.
 *
 * WHY a token layer over the existing direct --vscode-* usage: it lets new and
 * migrated dashboard surfaces reference one stable vocabulary (--surface-2,
 * --space-4, --accent-critical) while the resolution stays bound to the host
 * theme. The guide's §3.13 layout constants and §4 page-shell are intentionally
 * NOT included here — layout adoption is deferred past phase 1.
 *
 * The log-line console (monospace rows, minimap, decoration bars) is exempt
 * from the guide and must NOT be migrated onto the sans type scale below.
 */

/**
 * Return the :root token block. Bind once; it is prepended ahead of every other
 * style module so all downstream rules can reference the tokens.
 */
export function getTokenStyles(): string {
    return /* css */ `
/* ===================================================================
   Design tokens — Saropa Dashboard Style Guide §3
   Names are canonical; only the resolution (here, the VS Code host theme)
   changes per host. Brand orange is the only fixed color.
   =================================================================== */
:root {
    /* §3.4 Brand — the only fixed colors. Accent ONLY: never a large fill
       behind small body text (orange cannot hold AA at small sizes). */
    --brand: #f97316;
    --brand-2: #ea580c;
    --brand-glow: rgba(249, 115, 22, 0.18);
    --ring: 0 0 0 3px rgba(249, 115, 22, 0.32);

    /* §3.1 Surfaces — step by depth. In VS Code the editor + widget
       backgrounds already carry the theme's light/dark elevation, so raised
       surfaces map to editorWidget / inactiveSelection rather than a hand-mixed
       step. Never use shadow as the ONLY elevation signal — pair with surface. */
    --surface-0: var(--vscode-editor-background);
    --surface-1: var(--vscode-editor-background);
    --surface-2: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    --surface-3: var(--vscode-editor-inactiveSelectionBackground, var(--vscode-editorWidget-background));
    --inset: var(--vscode-input-background, var(--vscode-editor-background));

    /* §3.2 Text. --muted must still clear AA 4.5:1 on its surface; on busy
       tinted bands lift it toward foreground with the color-mix below. */
    --text: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --link: var(--vscode-textLink-foreground);
    --muted-on-band: color-mix(in srgb, var(--text) 72%, var(--muted));

    /* §3.3 Borders. --border-strong is the focus-adjacent / hover edge:
       a 35% blend of the host focus border into the hairline. */
    --border: var(--vscode-widget-border, var(--vscode-panel-border));
    --border-strong: color-mix(in srgb, var(--vscode-focusBorder) 35%, var(--border));

    /* §3.5 Semantic / status — bind to the host's diagnostic colors so severity
       reads identically to the editor's own squiggles. Never invent a green/red. */
    --status-good: var(--vscode-testing-iconPassed, var(--vscode-editorInfo-foreground));
    --status-bad: var(--vscode-editorError-foreground);
    --accent-critical: var(--vscode-editorError-foreground);
    --accent-high: color-mix(in srgb, var(--vscode-editorError-foreground) 60%, var(--vscode-editorWarning-foreground));
    --accent-medium: var(--vscode-editorWarning-foreground);
    --accent-warning: var(--vscode-editorWarning-foreground);
    --accent-low: var(--vscode-editorInfo-foreground);
    --accent-info: var(--vscode-editorInfo-foreground);
    --accent-opinionated: var(--vscode-descriptionForeground);

    /* §3.7 Spacing scale (4px base). All margins/padding/gaps land on these. */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;
    --space-8: 48px;

    /* §3.8 Radius. */
    --radius-sm: 3px;
    --radius: 8px;
    --radius-lg: 12px;
    --radius-pill: 999px;

    /* §3.9 Elevation — surface step + shadow, paired. In VS Code's flat
       language prefer the widget border + surface step; reserve --shadow-lg for
       true overlays (popovers, modals, drill-downs). */
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.22);
    --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.30), 0 10px 30px -8px rgba(0, 0, 0, 0.45);

    /* §3.10 Type scale (modular, ratio ~1.2, 14px base). DASHBOARD surfaces
       only — the log-line console keeps its monospace --log-font-size and must
       not consume these. Pair every size with the line-height baked in here. */
    --text-eyebrow: 11px;
    --text-caption: 12px;
    --text-body: 14px;
    --text-label: 14px;
    --text-h3: 17px;
    --text-h2: 20px;
    --text-h1: 28px;
    --text-kpi: 34px;
    --text-kpi-xl: 44px;

    /* §3.11 Motion. Wrap all non-essential motion in prefers-reduced-motion. */
    --ease: cubic-bezier(0.2, 0.6, 0.2, 1);
    --dur-fast: 80ms;
    --dur: 160ms;
    --dur-slow: 300ms;

    /* §3.12 Z-index layers. */
    --z-base: 0;
    --z-sticky: 50;
    --z-overlay: 100;
    --z-modal: 200;
    --z-toast: 300;
}
`;
}
