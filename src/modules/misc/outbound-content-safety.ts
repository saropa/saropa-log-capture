/**
 * Safety helpers for log/user-derived text embedded in OUTBOUND artifacts — bug reports opened in a
 * Markdown viewer, CSV exports opened in a spreadsheet. These are distinct from the viewer's HTML
 * escaping: they target Markdown code-fence breakout and spreadsheet formula injection, not the DOM.
 */

/**
 * Wrap content in a Markdown code fence that inner backticks cannot break out of.
 *
 * A run of backticks inside the content would close a plain three-backtick fence early, letting
 * everything after it render as live Markdown (e.g. an injected image or link) — a real risk because
 * the content here is arbitrary captured log text. Per CommonMark, a fenced block may use a longer
 * run of backticks than any run it contains, so fence with `longest inner run + 1` (minimum 3).
 *
 * @param content - Raw text to place inside the fence.
 * @param lang - Optional info string (language hint) appended to the opening fence.
 */
export function fencedBlock(content: string, lang = ''): string {
    const longestRun = (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    return `${fence}${lang}\n${content}\n${fence}`;
}

/**
 * Neutralize spreadsheet formula injection in a single CSV field.
 *
 * Excel / Google Sheets execute a cell whose text begins with `=`, `+`, `-`, `@` (or a leading tab /
 * carriage return) as a formula, so a captured log message like `=cmd|'/c calc'!A1` runs on open.
 * Prefixing a literal apostrophe forces the cell to be treated as text. Pure numbers (including
 * negatives like `-5` and `+5`) are left untouched so genuine numeric columns still parse as numbers.
 */
export function csvFormulaSafe(value: string): string {
    if (!/^[=+\-@\t\r]/.test(value)) { return value; }
    if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) { return value; }
    return `'${value}`;
}
