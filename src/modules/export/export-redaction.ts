/**
 * bug_048: single chokepoint for redacting secrets from exported log content (HTML, CSV, JSON,
 * JSONL, Loki). Controlled by `saropaLogCapture.export.redactSensitiveData` (default on).
 */

import * as vscode from 'vscode';
import { redactSensitiveContent } from '../security/redact';

/** True unless the user explicitly turned export redaction off. */
export function isExportRedactionEnabled(): boolean {
    return vscode.workspace.getConfiguration('saropaLogCapture').get<boolean>('export.redactSensitiveData', true);
}

/** Redact `text` for export when the setting is enabled; otherwise return it unchanged. */
export function redactForExport(text: string): string {
    return isExportRedactionEnabled() ? redactSensitiveContent(text) : text;
}
