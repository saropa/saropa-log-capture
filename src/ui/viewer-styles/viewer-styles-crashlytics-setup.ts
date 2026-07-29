/**
 * Crashlytics panel CSS: setup wizard and diagnostic box styles.
 */

export function getSetupStyles(): string {
    return /* css */ `

/* --- Setup wizard --- */
.cp-setup-intro { margin: 10px 12px 4px; font-size: 12px; line-height: 1.5; }

/* 3-step progress row. Each step is a numbered/checked pill: done (green), active (accent), todo (muted). */
.cp-steps { display: flex; gap: 6px; margin: 10px 12px; }
.cp-step { display: flex; align-items: center; gap: 5px; flex: 1; font-size: var(--text-caption); opacity: 0.6; }
.cp-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--border);
    font-size: var(--text-caption);
}
.cp-step-active { opacity: 1; font-weight: 600; }
.cp-step-active .cp-step-num {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}
.cp-step-done { opacity: 0.9; }
.cp-step-done .cp-step-num {
    background: var(--status-good);
    color: var(--vscode-button-foreground);
    border-color: transparent;
}

.cp-setup-status { margin: 6px 12px 2px; font-size: 12px; font-weight: 600; }

/* Collapsed diagnostic/troubleshooting so a failed setup reads as guidance, not an error wall. */
.cp-problem { margin: 10px 12px; font-size: var(--text-caption); }
.cp-problem > summary { cursor: pointer; opacity: 0.8; padding: var(--space-1) 0; }
.cp-problem-body { margin-top: var(--space-1); }

.cp-setup-title { font-weight: 600; font-size: 12px; margin: 0 12px 4px; }

/* --- Connection test report --- */
.cp-conn-test { margin: var(--space-2) var(--space-3); }
.cp-conn-test-btn { width: 100%; text-align: center; }
.cp-conn-report { margin-top: var(--space-2); }
.cp-conn-checking { font-size: 12px; opacity: 0.8; padding: var(--space-1) 0; }
.cp-conn-ok { color: var(--status-good); font-weight: 600; margin-bottom: 6px; }
.cp-conn-bad { color: var(--status-bad); font-weight: 600; margin-bottom: 6px; }
.cp-conn-step {
    padding: 6px 8px;
    margin: var(--space-1) 0;
    border-left: 3px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--vscode-textBlockQuote-background);
}
.cp-conn-pass { border-left-color: var(--status-good); }
.cp-conn-fail { border-left-color: var(--status-bad); }
.cp-conn-skipped { opacity: 0.7; }
.cp-conn-head { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; }
.cp-conn-detail { font-size: 12px; opacity: 0.9; margin-top: 2px; }
.cp-conn-fix { font-size: var(--text-caption); margin-top: var(--space-1); }
.cp-conn-tech { margin-top: var(--space-1); font-size: var(--text-caption); }
.cp-conn-tech summary { cursor: pointer; opacity: 0.8; }
.cp-conn-tech pre {
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--vscode-textCodeBlock-background);
    padding: var(--space-1);
    margin: var(--space-1) 0;
}
.cp-setup-step { margin: var(--space-2) var(--space-3); }
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
    font-size: var(--text-caption);
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    vertical-align: middle;
}
.cp-copy-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.cp-setup-why {
    margin-top: var(--space-2);
    font-size: var(--text-caption);
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
    border-radius: var(--radius-sm);
    font-size: 12px;
    display: block;
    margin: var(--space-2) 0;
}

.cp-setup-btn:hover { background: var(--vscode-button-hoverBackground); }

.cp-setup-link {
    color: var(--link);
    cursor: pointer;
    text-decoration: underline;
    display: inline-block;
    margin: var(--space-1) 0;
}

.cp-setup-settings {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--link);
    cursor: pointer;
    opacity: 0.8;
}

.cp-setup-tip {
    margin: 16px 12px 8px;
    font-size: var(--text-caption);
    opacity: 0.6;
    font-style: italic;
}

.cp-check-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    margin: var(--space-2) var(--space-3);
}

.cp-check-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
`;
}

export function getDiagnosticStyles(): string {
    return /* css */ `

/* --- Diagnostic box --- */
.cp-diag-box {
    margin: 10px 12px;
    padding: var(--space-2);
    background: var(--vscode-inputValidation-warningBackground);
    border-left: 3px solid var(--vscode-inputValidation-warningBorder);
    border-radius: var(--radius-sm);
    font-size: var(--text-caption);
}

.cp-diag-msg { margin-bottom: var(--space-1); }
.cp-diag-status { font-size: 10px; opacity: 0.8; margin-top: 2px; }
.cp-diag-tech { margin-top: 6px; font-size: 10px; }
.cp-diag-tech summary { cursor: pointer; opacity: 0.8; }
.cp-diag-tech pre {
    margin: var(--space-1) 0;
    padding: var(--space-1);
    background: var(--vscode-textCodeBlock-background);
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--text-caption);
    white-space: pre-wrap;
    word-break: break-all;
}

.cp-diag-time { font-size: 10px; margin-top: 6px; opacity: 0.6; font-style: italic; }
.cp-diag-actions { margin: 10px 12px 4px; }
.cp-diag-actions-row {
    margin: 10px 12px 4px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
}
.cp-btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.cp-btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.cp-open-console { margin: var(--space-2) var(--space-3); font-size: 12px; }
.cp-show-output { margin-left: var(--space-1); }

/* --- In-panel troubleshooting --- */
.cp-trouble-step {
    margin: 10px 12px;
    padding: 8px 10px;
    background: var(--vscode-textBlockQuote-background);
    border-left: 3px solid var(--vscode-focusBorder);
    border-radius: var(--radius-sm);
    font-size: var(--text-caption);
}
.cp-trouble-step-title { font-weight: 600; margin-bottom: 6px; }
.cp-trouble-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
}
.cp-trouble-table th, .cp-trouble-table td {
    padding: var(--space-1) var(--space-2);
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
}
.cp-trouble-table th { font-weight: 600; }
.cp-trouble-symptom { font-family: var(--vscode-editor-font-family); }
.cp-trouble-details {
    margin: 10px 12px;
    font-size: var(--text-caption);
}
.cp-trouble-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: var(--space-1) 0;
}
.cp-trouble-details .cp-trouble-table { margin-top: 6px; }

/* --- In-panel Help (full doc content) --- */
.cp-help-details {
    margin: 10px 12px 12px;
    font-size: var(--text-caption);
    border-top: 1px solid var(--border);
    padding-top: var(--space-2);
}
.cp-help-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: var(--space-1) 0;
}
.cp-help-section { margin: 10px 0; }
.cp-help-section-title { font-weight: 600; margin-bottom: var(--space-1); }
.cp-help-section-body {
    font-size: var(--text-caption);
    line-height: 1.4;
}
.cp-help-section-body p { margin: 6px 0; }
.cp-help-section-body ol, .cp-help-section-body ul { margin: 6px 0; padding-left: 20px; }
.cp-help-section-body code { font-family: var(--vscode-editor-font-family); font-size: var(--text-caption); }
.cp-help-link { color: var(--link); text-decoration: underline; }
.cp-help-link:hover { color: var(--vscode-textLink-activeForeground); }
`;
}
