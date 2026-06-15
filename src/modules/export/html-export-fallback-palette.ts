/**
 * Standalone fallback palette for the HTML log exports.
 *
 * A saved/shared HTML report has NO VS Code host theme to inherit, so the
 * `--vscode-*`-bound viewer tokens cannot resolve in a browser. Per the Saropa
 * Dashboard Style Guide §3.6 / §10 ("Standalone HTML exports ship the fallback
 * palette baked in"), this module bakes the canonical token NAMES with concrete
 * light/dark values so a standalone export speaks the same vocabulary as every
 * webview surface — just resolved from a baked palette instead of the host theme.
 *
 * Scope: COLORS ONLY (§3.1 surfaces, §3.2 text, §3.3 borders, §3.4 brand,
 * §3.5 semantic/severity). The log export is a high-density console, which the
 * guide's scope carve-out exempts from the §3.7 spacing scale, §3.8 radius, and
 * §3.10 type scale — so those stay as the export's own literal pixels and the
 * monospace font is untouched. ANSI color classes are the terminal palette itself
 * (the data, not chrome) and likewise stay literal at their call sites.
 *
 * Theme model: DARK is the default (`:root`) to match the export's original look;
 * the interactive export's theme-toggle button adds `.light-theme` to the body to
 * flip to the light resolutions (the simple export has no toggle and stays dark).
 * Brand, status, and severity hold across both grounds per the guide — only the
 * surfaces/text/border/brand-glow differ by theme.
 */

/** The `:root` (dark) + `.light-theme` (light) §3.6 fallback palette block. */
export function getStandaloneFallbackPalette(): string {
    return `
:root {
    color-scheme: light dark;
    --brand: #f97316;
    --brand-2: #ea580c;
    --brand-glow: rgba(249, 115, 22, 0.28);
    --surface-1: #0f172a;
    --surface-2: #1e293b;
    --surface-3: #243044;
    --inset: #0b1220;
    --text: #f1f5f9;
    --muted: #94a3b8;
    --link: #fb923c;
    --border: rgba(148, 163, 184, 0.18);
    --border-strong: color-mix(in srgb, var(--brand) 35%, var(--border));
    --status-good: #16a34a;
    --status-bad: #dc2626;
    --accent-critical: #dc2626;
    --accent-high: #ea580c;
    --accent-warning: #d97706;
    --accent-medium: #d97706;
    --accent-info: #2563eb;
    --accent-low: #2563eb;
    --accent-opinionated: #94a3b8;
}
.light-theme {
    --brand-glow: rgba(249, 115, 22, 0.20);
    --surface-1: #ffffff;
    --surface-2: #f5f5f4;
    --surface-3: #eeeeec;
    --inset: #ffffff;
    --text: #0f172a;
    --muted: #64748b;
    --link: #ea580c;
    --border: #e5e7eb;
    --accent-opinionated: #64748b;
}
`;
}
