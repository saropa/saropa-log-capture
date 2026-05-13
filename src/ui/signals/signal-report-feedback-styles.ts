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
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
    animation: shimmer-pulse 1.5s ease-in-out infinite;
}
/* Toast notification — slides in from top-right, auto-dismisses */
.toast {
    position: fixed;
    top: 12px;
    right: 12px;
    padding: 8px 14px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    z-index: 1000;
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: none;
}
.toast--visible {
    opacity: 1;
    transform: translateY(0);
}
.toast--success {
    background: var(--vscode-testing-iconPassed, #388a34);
    color: #fff;
}
.toast--error {
    background: var(--vscode-testing-iconFailed, #f14c4c);
    color: #fff;
}
`;
}
