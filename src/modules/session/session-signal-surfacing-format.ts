/**
 * Pure formatting helpers for predictive error surfacing (idea #1).
 *
 * Kept free of `vscode` / l10n imports so the branch logic (which message variant, label
 * truncation) is unit-testable under `node --test` without the Extension Host. The host module
 * (session-signal-surfacing.ts) applies `t()` to the variant key these helpers choose.
 */

/** Non-zero counts decide which message variant the toast uses. */
export interface SurfacingCounts {
    readonly newErrorCount: number;
    readonly recurringCount: number;
}

/** l10n key for the head message, or null when nothing is actionable. */
export type SurfacingKey =
    | 'msg.sessionSignals.both'
    | 'msg.sessionSignals.newOnly'
    | 'msg.sessionSignals.recurringOnly'
    | null;

/** The chosen message key plus the positional args `t()` substitutes into it. */
export interface SurfacingVariant {
    readonly key: SurfacingKey;
    readonly args: readonly number[];
}

/**
 * Choose the message variant from the counts. A null key means "stay silent" — the caller
 * suppresses the toast entirely so an empty session never nags (idea #8, silence is golden).
 */
export function selectSurfacingVariant(counts: SurfacingCounts): SurfacingVariant {
    const { newErrorCount, recurringCount } = counts;
    if (newErrorCount > 0 && recurringCount > 0) {
        return { key: 'msg.sessionSignals.both', args: [newErrorCount, recurringCount] };
    }
    if (newErrorCount > 0) {
        return { key: 'msg.sessionSignals.newOnly', args: [newErrorCount] };
    }
    if (recurringCount > 0) {
        return { key: 'msg.sessionSignals.recurringOnly', args: [recurringCount] };
    }
    return { key: null, args: [] };
}

/** Truncate a headline error label with an ellipsis so the toast stays one scannable line. */
export function truncateLabel(label: string, max: number): string {
    return label.length > max ? label.slice(0, max - 3) + '...' : label;
}
