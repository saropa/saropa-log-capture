/**
 * Single source of truth for Trouble Mode severity levels.
 *
 * These arrays must stay in sync with the `saropaLogCapture.troubleMode.levels`
 * enum and default in `package.json`. The webview's `TROUBLE_LEVELS` object
 * (viewer-trouble-mode.ts) is initialised from `troubleDefaultLevels` at
 * template-build time, and `setTroubleLevels()` replaces it at runtime when
 * the host pushes a non-default configuration.
 *
 * The trouble chart (viewer-trouble-chart.ts) currently only buckets error,
 * warning, and performance — adding a level here makes it survive the feed
 * filter but NOT appear in the chart histogram or legend. A chart-side change
 * is needed to visualise additional levels.
 */

/** Every level the user may include in `troubleMode.levels`. */
export const troubleValidLevels = [
    "error", "warning", "performance", "database", "todo", "debug", "notice",
] as const;

/** Levels enabled by default when no user override is set. */
export const troubleDefaultLevels = [
    "error", "warning", "performance",
] as const;

export type TroubleLevel = typeof troubleValidLevels[number];
