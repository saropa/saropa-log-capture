import type { HighlightRule } from "../storage/highlight-rules";

/**
 * Default highlight rules for common log patterns.
 * Priority-ordered: first match wins when multiple rules could apply.
 * Users can override via the `saropaLogCapture.highlightRules` setting.
 */
export function defaultHighlightRules(): HighlightRule[] {
  return [
    { pattern: String.raw`/\b(fatal|panic|critical)\b/i`, color: "var(--vscode-errorForeground)", bold: true, label: "Fatal" },
    { pattern: String.raw`/\b(error|exception|fail(ed|ure)?)\b/i`, color: "var(--vscode-errorForeground)", label: "Error" },
    { pattern: String.raw`/\b(warn(ing)?|caution)\b/i`, color: "var(--vscode-editorWarning-foreground)", label: "Warning" },
    { pattern: String.raw`/\b(todo|fixme|xxx)\b/i`, color: "var(--vscode-editorWarning-foreground)", italic: true, label: "TODO" },
    { pattern: String.raw`/\b(hack|workaround|kludge)\b/i`, color: "var(--vscode-editorWarning-foreground)", italic: true, label: "Hack" },
    { pattern: String.raw`/\bdeprecated\b/i`, color: "var(--vscode-descriptionForeground)", italic: true, label: "Deprecated" },
    { pattern: String.raw`/\b(success(ful(ly)?)?|passed|succeeded)\b/i`, color: "var(--vscode-debugConsole-sourceForeground)", label: "Success" },
    { pattern: String.raw`/\b(info(rmation)?|notice)\b/i`, color: "var(--vscode-debugConsole-infoForeground)", label: "Info" },
    { pattern: String.raw`/\b(debug|trace|verbose)\b/i`, color: "var(--vscode-descriptionForeground)", label: "Debug" },
    { pattern: "[Awesome Notifications]", color: "var(--vscode-terminal-ansiGreen, #89d185)", scope: "keyword", label: "Awesome Notifications" },
  ];
}
