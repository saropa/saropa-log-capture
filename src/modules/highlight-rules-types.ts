/**
 * Type definitions for the highlight rule engine.
 *
 * These interfaces define the shape of highlight rules, match results,
 * and CSS styles. They are used by the rule engine, the viewer provider,
 * and configuration readers.
 */

/**
 * A single highlight rule mapping a pattern to visual styling.
 * Patterns can be plain strings or regex (e.g., "/pattern/flags").
 */
export interface HighlightRule {
    /** The pattern to match - plain string or /regex/flags format. */
    readonly pattern: string;

    /**
     * Text color for matching lines.
     * Can be a CSS color name, hex value, or VS Code CSS variable.
     * @example "red", "#ff0000", "var(--vscode-errorForeground)"
     */
    readonly color?: string;

    /**
     * Background color for matching lines.
     * Can be a CSS color name, hex value, or VS Code CSS variable.
     * @example "yellow", "#ffff00", "var(--vscode-editor-findMatchHighlightBackground)"
     */
    readonly backgroundColor?: string;

    /**
     * Optional label shown in tooltips to explain why the line is highlighted.
     * If not provided, the pattern is used as the label.
     */
    readonly label?: string;

    /**
     * Whether to apply bold styling to matching text.
     * @default false
     */
    readonly bold?: boolean;

    /**
     * Whether to apply italic styling to matching text.
     * @default false
     */
    readonly italic?: boolean;
}

/**
 * Result of matching a line against highlight rules.
 * Contains the styles to apply and the labels of all matching rules.
 */
export interface HighlightMatch {
    /**
     * CSS styles to apply to the line.
     * Combined from all matching rules (first match wins for conflicts).
     */
    readonly styles: HighlightStyles;

    /**
     * Labels of all rules that matched this line.
     * Useful for tooltips showing why a line is highlighted.
     */
    readonly matchedLabels: string[];
}

/**
 * CSS styles extracted from matching highlight rules.
 * These are applied directly to the line element in the viewer.
 */
export interface HighlightStyles {
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
    fontStyle?: string;
}
