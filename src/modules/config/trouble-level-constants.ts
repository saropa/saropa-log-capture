/**
 * Single source of truth for Trouble Mode severity levels.
 *
 * These arrays must stay in sync with the `saropaLogCapture.troubleMode.levels`
 * enum and default in `package.json`. The webview's `TROUBLE_LEVELS` object
 * (viewer-trouble-mode.ts) is initialised from `troubleDefaultLevels` at
 * template-build time, and `setTroubleLevels()` replaces it at runtime when
 * the host pushes a non-default configuration.
 *
 * `troubleValidLevels` also defines the canonical stacking order for the
 * trouble chart: error at the baseline (drawn first), notice at the top.
 * The chart only draws levels present in the active `TROUBLE_LEVELS` set.
 */

/** Every level the user may include in `troubleMode.levels`.
 *  Order defines the chart stack: first = baseline, last = top. */
export const troubleValidLevels = [
    "error", "warning", "performance", "database", "todo", "debug", "notice",
] as const;

/** Levels enabled by default when no user override is set. */
export const troubleDefaultLevels = [
    "error", "warning", "performance",
] as const;

export type TroubleLevel = typeof troubleValidLevels[number];
