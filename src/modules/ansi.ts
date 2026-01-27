/** Regex matching ANSI escape sequences (SGR and cursor codes). */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

/** Strip ANSI escape codes from text for display in the webview viewer. */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '');
}
