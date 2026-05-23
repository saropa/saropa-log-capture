/**
 * Crashlytics panel CSS: setup wizard and diagnostic box styles.
 */

export function getSetupStyles(): string {
    return /* css */ `

/* --- Setup wizard --- */
.cp-setup-intro { margin: 10px 12px 4px; font-size: 13px; line-height: 1.5; }

/* 3-step progress row. Each step is a numbered/checked pill: done (green), active (accent), todo (muted). */
.cp-steps { display: flex; gap: 6px; margin: 10px 12px; }
.cp-step { display: flex; align-items: center; gap: 5px; flex: 1; font-size: 11px; opacity: 0.6; }
.cp-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--vscode-panel-border);
    font-size: 11px;
}
.cp-step-active { opacity: 1; font-weight: 600; }
.cp-step-active .cp-step-num {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}
.cp-step-done { opacity: 0.9; }
.cp-step-done .cp-step-num {
    background: var(--vscode-testing-iconPassed, #388e3c);
    color: var(--vscode-button-foreground);
    border-color: transparent;
}

.cp-setup-status { margin: 6px 12px 2px; font-size: 12px; font-weight: 600; }

/* Collapsed diagnostic/troubleshooting so a failed setup reads as guidance, not an error wall. */
.cp-problem { margin: 10px 12px; font-size: 0.9em; }
.cp-problem > summary { cursor: pointer; opacity: 0.8; padding: 4px 0; }
.cp-problem-body { margin-top: 4px; }

.cp-setup-title { font-weight: 600; font-size: 1.1em; margin: 0 12px 4px; }

/* --- Connection test report --- */
.cp-conn-test { margin: 8px 12px; }
.cp-conn-test-btn { width: 100%; text-align: center; }
.cp-conn-report { margin-top: 8px; }
.cp-conn-checking { font-size: 12px; opacity: 0.8; padding: 4px 0; }
.cp-conn-ok { color: var(--vscode-testing-iconPassed, #388e3c); font-weight: 600; margin-bottom: 6px; }
.cp-conn-bad { color: var(--vscode-errorForeground); font-weight: 600; margin-bottom: 6px; }
.cp-conn-step {
    padding: 6px 8px;
    margin: 4px 0;
    border-left: 3px solid var(--vscode-panel-border);
    border-radius: 3px;
    background: var(--vscode-textBlockQuote-background);
}
.cp-conn-pass { border-left-color: var(--vscode-testing-iconPassed, #388e3c); }
.cp-conn-fail { border-left-color: var(--vscode-errorForeground); }
.cp-conn-skipped { opacity: 0.7; }
.cp-conn-head { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; }
.cp-conn-detail { font-size: 12px; opacity: 0.9; margin-top: 2px; }
.cp-conn-fix { font-size: 11px; margin-top: 4px; }
.cp-conn-tech { margin-top: 4px; font-size: 11px; }
.cp-conn-tech summary { cursor: pointer; opacity: 0.8; }
.cp-conn-tech pre {
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--vscode-textCodeBlock-background);
    padding: 4px;
    margin: 4px 0;
}
.cp-setup-step { margin: 8px 12px; }
.cp-setup-step p { margin: 4px 0 8px; opacity: 0.85; line-height: 1.4; font-size: 12px; }
.cp-setup-step code {
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 4px;
    border-radius: 2px;
    font-family: var(--vscode-editor-font-family);
}

.cp-install-via { margin: 6px 0; }
.cp-install-code { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-copy-btn {
    margin-left: 6px;
    padding: 2px 8px;
    font-size: 11px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    vertical-align: middle;
}
.cp-copy-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.cp-setup-why {
    margin-top: 8px;
    font-size: 0.9em;
    opacity: 0.75;
    font-style: italic;
}
.cp-use-existing { margin: 6px 0; }

.cp-setup-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 13px;
    display: block;
    margin: 8px 0;
}

.cp-setup-btn:hover { background: var(--vscode-button-hoverBackground); }

.cp-setup-link {
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    text-decoration: underline;
    display: inline-block;
    margin: 4px 0;
}

.cp-setup-settings {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    opacity: 0.8;
}

.cp-setup-tip {
    margin: 16px 12px 8px;
    font-size: 0.9em;
    opacity: 0.6;
    font-style: italic;
}

.cp-check-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    margin: 8px 12px;
}

.cp-check-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
`;
}

export function getDiagnosticStyles(): string {
    return /* css */ `

/* --- Diagnostic box --- */
.cp-diag-box {
    margin: 10px 12px;
    padding: 8px;
    background: var(--vscode-inputValidation-warningBackground);
    border-left: 3px solid var(--vscode-inputValidation-warningBorder);
    border-radius: 3px;
    font-size: 0.9em;
}

.cp-diag-msg { margin-bottom: 4px; }
.cp-diag-status { font-size: 0.85em; opacity: 0.8; margin-top: 2px; }
.cp-diag-tech { margin-top: 6px; font-size: 0.85em; }
.cp-diag-tech summary { cursor: pointer; opacity: 0.8; }
.cp-diag-tech pre {
    margin: 4px 0;
    padding: 4px;
    background: var(--vscode-textCodeBlock-background);
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family);
    font-size: 0.9em;
    white-space: pre-wrap;
    word-break: break-all;
}

.cp-diag-time { font-size: 0.8em; margin-top: 6px; opacity: 0.6; font-style: italic; }
.cp-diag-actions { margin: 10px 12px 4px; }
.cp-diag-actions-row {
    margin: 10px 12px 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.cp-btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.cp-btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.cp-open-console { margin: 8px 12px; font-size: 12px; }
.cp-show-output { margin-left: 4px; }

/* --- In-panel troubleshooting --- */
.cp-trouble-step {
    margin: 10px 12px;
    padding: 8px 10px;
    background: var(--vscode-textBlockQuote-background);
    border-left: 3px solid var(--vscode-focusBorder);
    border-radius: 3px;
    font-size: 0.9em;
}
.cp-trouble-step-title { font-weight: 600; margin-bottom: 6px; }
.cp-trouble-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85em;
}
.cp-trouble-table th, .cp-trouble-table td {
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--vscode-widget-border);
}
.cp-trouble-table th { font-weight: 600; }
.cp-trouble-symptom { font-family: var(--vscode-editor-font-family); }
.cp-trouble-details {
    margin: 10px 12px;
    font-size: 0.9em;
}
.cp-trouble-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: 4px 0;
}
.cp-trouble-details .cp-trouble-table { margin-top: 6px; }

/* --- In-panel Help (full doc content) --- */
.cp-help-details {
    margin: 10px 12px 12px;
    font-size: 0.9em;
    border-top: 1px solid var(--vscode-widget-border);
    padding-top: 8px;
}
.cp-help-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: 4px 0;
}
.cp-help-section { margin: 10px 0; }
.cp-help-section-title { font-weight: 600; margin-bottom: 4px; }
.cp-help-section-body {
    font-size: 0.95em;
    line-height: 1.4;
}
.cp-help-section-body p { margin: 6px 0; }
.cp-help-section-body ol, .cp-help-section-body ul { margin: 6px 0; padding-left: 20px; }
.cp-help-section-body code { font-family: var(--vscode-editor-font-family); font-size: 0.9em; }
.cp-help-link { color: var(--vscode-textLink-foreground); text-decoration: underline; }
.cp-help-link:hover { color: var(--vscode-textLink-activeForeground); }
`;
}
