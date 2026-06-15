/**
 * CSS for loading shimmers and toast notifications in the signal report.
 * Extracted from signal-report-styles.ts to stay under the 300-line limit.
 */

export function getFeedbackStyles(): string {
    return /* css */ `
/* Pulsing shimmer so loading placeholders signal activity, not a frozen UI */
@keyframes shimmer-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
.section-loading {
    color: var(--muted);
    font-style: italic;
    font-size: var(--text-caption);
    animation: shimmer-pulse 1.5s ease-in-out infinite;
}
/* Toast notification — slides in from top-right, auto-dismisses */
.toast {
    position: fixed;
    top: var(--space-3);
    right: var(--space-3);
    padding: var(--space-2) 14px;
    border-radius: var(--radius-sm);
    font-size: var(--text-caption);
    font-weight: 500;
    z-index: var(--z-toast);
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: none;
}
.toast--visible {
    opacity: 1;
    transform: translateY(0);
}
/* Host pass/fail colors with a status-token fallback. Text stays #fff: white on a
   saturated success/error fill holds AA where a theme-bound text token might not. */
.toast--success {
    background: var(--vscode-testing-iconPassed, var(--status-good));
    color: #fff;
}
.toast--error {
    background: var(--vscode-testing-iconFailed, var(--status-bad));
    color: #fff;
}
`;
}
