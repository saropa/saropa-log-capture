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
    --brand-glow: rgba(249, 115, 22, 0.20);
    --ring: 0 0 0 3px rgba(249, 115, 22, 0.32);

    /* §3.1 Surfaces — step by depth. --surface-0 is standalone-only and is
       deliberately NOT defined here: in a webview the page background AND cards
       are both --surface-1 (--vscode-editor-background), separated by --border,
       not by a tone change. Raised surfaces map to editorWidget / inactiveSelection,
       which render close to the editor background in some themes — so lean on the
       border, never shadow alone, to separate stacked surfaces. Mirrors the
       canonical chromeTokens() (saropa_lints dashboardChromeStyles.ts). */
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

    /* Severity count-pill palette — the SINGLE source of truth for the filled level
       count pills (.dot-count-* in the toolbar level summary AND .sev-count-* in the
       sidebar Logs list). Unlike the theme-bound --accent-* semantics above, these are
       FIXED hex on purpose: a count pill is a filled chip with a fixed per-fill foreground
       tuned to clear WCAG AA (4.5:1) for a 9–10px bold number, and a theme-variable fill
       would invert light/dark and break that fixed contrast. Each level has a fill
       (--sev-<level>) and its paired legible foreground (--sev-<level>-fg): near-black on
       the bright/mid fills, white only on the two genuinely dark fills (performance purple,
       debug brown) — white-on-red / white-on-blue was rejected (~3.9:1 / ~3.1:1, below AA).
       The fills echo the semantic hues of the theme-bound .line.level-* / .level-bar-* text
       colors (red/orange/blue/purple/gray/cyan/brown/green) but are their own fixed set;
       do NOT re-point these at --vscode-* tokens. Both pill surfaces consume ONLY these
       variables, so the two can never drift apart again. */
    --sev-error: #f44336;       --sev-error-fg: #2a0400;
    --sev-warning: #ff9800;     --sev-warning-fg: #1c1200;
    --sev-info: #2196f3;        --sev-info-fg: #051f33;
    --sev-performance: #9c27b0; --sev-performance-fg: #ffffff;
    --sev-todo: #bdbdbd;        --sev-todo-fg: #1a1a1a;
    --sev-notice: #00bcd4;      --sev-notice-fg: #062a2e;
    --sev-debug: #795548;       --sev-debug-fg: #ffffff;
    --sev-database: #4caf50;    --sev-database-fg: #0a2410;
    /* Framework bucket exists only in the sidebar list (the toolbar has no fw pill); it is
       a neutral gray, kept here so the whole pill palette lives in one place. */
    --sev-fw: #cccccc;          --sev-fw-fg: #141414;

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
       true overlays (popovers, modals, drill-downs). Values mirror chromeTokens(). */
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.10);
    --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.18), 0 10px 30px -8px rgba(0, 0, 0, 0.28);

    /* §3.10 Type scale (modular, ratio ~1.2). Anchored to the 13px VS Code host
       density (NOT the 14px standalone base) so it matches the canonical chrome.
       DASHBOARD surfaces only — the log-line console keeps its monospace
       --log-font-size and must not consume these. */
    --text-eyebrow: 11px;
    --text-caption: 11px;
    --text-body: 13px;
    --text-label: 13px;
    --text-h3: 15px;
    --text-h2: 18px;
    --text-h1: 22px;
    --text-kpi: 28px;
    --text-kpi-xl: 40px;

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
