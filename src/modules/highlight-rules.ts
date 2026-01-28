/**
 * Highlight Rule Engine
 *
 * Provides pattern-based highlighting for log lines in the viewer.
 * Rules can use plain strings (case-insensitive substring match) or
 * regex patterns (enclosed in forward slashes with optional flags).
 *
 * Key features:
 * - Stackable: A single line can match multiple rules
 * - Priority-based: Earlier rules in the array take precedence for conflicts
 * - CSS variable colors: Uses VS Code theme colors for consistency
 *
 * @example
 * // Plain string match (case-insensitive)
 * { pattern: "error", color: "red" }
 *
 * // Regex pattern with flags
 * { pattern: "/WARN|WARNING/i", color: "yellow" }
 *
 * // Custom CSS color
 * { pattern: "success", color: "#00ff00", backgroundColor: "#002200" }
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
 * A compiled highlight rule with the regex pre-built for efficient matching.
 * Created once per rule and reused for all line comparisons.
 */
interface CompiledRule {
    /** The original rule configuration. */
    readonly rule: HighlightRule;

    /** Pre-compiled regex for fast matching. */
    readonly regex: RegExp;

    /** Display label (rule.label or rule.pattern). */
    readonly label: string;
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

/**
 * Parses a pattern string into a RegExp.
 *
 * Supports two formats:
 * 1. Plain string: Converted to case-insensitive substring match
 * 2. Regex literal: /pattern/flags format (e.g., "/error|warn/gi")
 *
 * @param pattern - The pattern string to parse
 * @returns A RegExp for matching, or undefined if pattern is invalid
 *
 * @example
 * parseHighlightPattern("error")           // /error/i (substring match)
 * parseHighlightPattern("/ERROR/")         // /ERROR/ (exact case)
 * parseHighlightPattern("/warn|error/gi")  // /warn|error/gi
 * parseHighlightPattern("/[invalid/")      // undefined (invalid regex)
 */
export function parseHighlightPattern(pattern: string): RegExp | undefined {
    if (!pattern || pattern.length === 0) {
        return undefined;
    }

    // Check for regex literal format: /pattern/flags
    const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexMatch) {
        try {
            return new RegExp(regexMatch[1], regexMatch[2]);
        } catch {
            // Invalid regex syntax - return undefined to skip this rule
            return undefined;
        }
    }

    // Plain string: escape special chars and match case-insensitively
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
}

/**
 * Compiles an array of highlight rules into efficient matchers.
 *
 * Invalid rules (empty pattern, invalid regex) are silently skipped.
 * This should be called once when rules change, not on every line.
 *
 * @param rules - The highlight rules from user settings
 * @returns Array of compiled rules ready for matching
 */
export function compileHighlightRules(rules: readonly HighlightRule[]): CompiledRule[] {
    const compiled: CompiledRule[] = [];

    for (const rule of rules) {
        // Skip rules without a pattern
        if (!rule.pattern) {
            continue;
        }

        // Skip rules without any styling
        if (!rule.color && !rule.backgroundColor && !rule.bold && !rule.italic) {
            continue;
        }

        const regex = parseHighlightPattern(rule.pattern);
        if (!regex) {
            continue;
        }

        compiled.push({
            rule,
            regex,
            label: rule.label ?? rule.pattern,
        });
    }

    return compiled;
}

/**
 * Tests a line against compiled highlight rules and returns matching styles.
 *
 * Rules are tested in order. For style conflicts (e.g., two rules setting
 * different colors), the first matching rule wins. However, all matching
 * labels are collected for tooltip display.
 *
 * @param line - The log line text to test
 * @param compiledRules - Pre-compiled rules from compileHighlightRules()
 * @returns Match result with combined styles and labels, or undefined if no match
 *
 * @example
 * const rules = compileHighlightRules([
 *     { pattern: "error", color: "red" },
 *     { pattern: "warning", color: "yellow" }
 * ]);
 * const match = matchHighlightRules("Error: something failed", rules);
 * // match.styles.color === "red"
 * // match.matchedLabels === ["error"]
 */
export function matchHighlightRules(
    line: string,
    compiledRules: readonly CompiledRule[],
): HighlightMatch | undefined {
    if (compiledRules.length === 0) {
        return undefined;
    }

    const styles: HighlightStyles = {};
    const matchedLabels: string[] = [];

    for (const compiled of compiledRules) {
        if (compiled.regex.test(line)) {
            matchedLabels.push(compiled.label);

            // First match wins for each style property
            const r = compiled.rule;
            if (r.color && !styles.color) {
                styles.color = r.color;
            }
            if (r.backgroundColor && !styles.backgroundColor) {
                styles.backgroundColor = r.backgroundColor;
            }
            if (r.bold && !styles.fontWeight) {
                styles.fontWeight = 'bold';
            }
            if (r.italic && !styles.fontStyle) {
                styles.fontStyle = 'italic';
            }
        }
    }

    if (matchedLabels.length === 0) {
        return undefined;
    }

    return { styles, matchedLabels };
}

/**
 * Converts highlight styles to an inline CSS string.
 *
 * Used by the viewer to apply styles to line elements.
 * Only includes properties that are actually set.
 *
 * @param styles - The styles from a highlight match
 * @returns CSS string for use in style attribute, or empty string
 *
 * @example
 * stylesToCss({ color: "red", fontWeight: "bold" })
 * // Returns: "color: red; font-weight: bold;"
 */
export function stylesToCss(styles: HighlightStyles): string {
    const parts: string[] = [];

    if (styles.color) {
        parts.push(`color: ${styles.color}`);
    }
    if (styles.backgroundColor) {
        parts.push(`background-color: ${styles.backgroundColor}`);
    }
    if (styles.fontWeight) {
        parts.push(`font-weight: ${styles.fontWeight}`);
    }
    if (styles.fontStyle) {
        parts.push(`font-style: ${styles.fontStyle}`);
    }

    return parts.length > 0 ? parts.join('; ') + ';' : '';
}

/**
 * Manager class for highlight rules.
 *
 * Caches compiled rules and provides convenient methods for matching lines.
 * Create one instance per session and call setRules() when config changes.
 *
 * @example
 * const highlighter = new HighlightRulesManager();
 * highlighter.setRules(config.highlightRules);
 *
 * // In line processing loop:
 * const match = highlighter.matchLine(lineText);
 * if (match) {
 *     element.style.cssText = stylesToCss(match.styles);
 * }
 */
export class HighlightRulesManager {
    private compiledRules: CompiledRule[] = [];

    /**
     * Updates the highlight rules.
     * Call this when configuration changes.
     *
     * @param rules - The new highlight rules from settings
     */
    setRules(rules: readonly HighlightRule[]): void {
        this.compiledRules = compileHighlightRules(rules);
    }

    /**
     * Tests a line against the current rules.
     *
     * @param line - The log line text to test
     * @returns Match result or undefined if no rules matched
     */
    matchLine(line: string): HighlightMatch | undefined {
        return matchHighlightRules(line, this.compiledRules);
    }

    /**
     * Returns the number of compiled rules.
     * Useful for debugging and status display.
     */
    get ruleCount(): number {
        return this.compiledRules.length;
    }

    /**
     * Checks if any rules are configured.
     */
    hasRules(): boolean {
        return this.compiledRules.length > 0;
    }
}
