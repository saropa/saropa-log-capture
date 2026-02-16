/**
 * Async bridge between debug-side recurring errors and Crashlytics production issues.
 *
 * Runs after the Insights panel renders: matches local error fingerprints
 * against Crashlytics issues and posts production badges back to the webview.
 */

import * as vscode from 'vscode';
import { getFirebaseContext, type CrashlyticsIssue } from '../modules/firebase-crashlytics';
import type { RecurringError } from '../modules/cross-session-aggregator';

const bridgeTimeout = 10_000;

/** Post a message to the webview, silently ignoring disposed panels. */
function safePost(panel: vscode.WebviewPanel, message: Record<string, unknown>): void {
    try { panel.webview.postMessage(message); } catch { /* panel disposed */ }
}

let outputChannel: vscode.OutputChannel | undefined;

/** Lazily create (or reuse) the shared output channel. */
function getOutputChannel(): vscode.OutputChannel {
    outputChannel ??= vscode.window.createOutputChannel('Saropa Log Capture');
    return outputChannel;
}

/** Start the async Crashlytics bridge and post results back to the webview panel. */
export function startCrashlyticsBridge(panel: vscode.WebviewPanel, errors: readonly RecurringError[]): void {
    if (errors.length === 0) { return; }
    safePost(panel, { type: 'productionBridgeLoading' });
    let settled = false;
    const finish = (bridges: Record<string, string>, reason: string): void => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        getOutputChannel().appendLine(`Crashlytics bridge: ${reason}`);
        safePost(panel, { type: 'productionBridgeResults', bridges });
    };
    const timer = setTimeout(() => {
        finish({}, 'timed out after 10 s');
    }, bridgeTimeout);
    getFirebaseContext([]).then((ctx) => {
        if (!ctx.available) {
            finish({}, `not available — ${ctx.setupHint ?? 'unknown reason'}`);
            return;
        }
        const bridges = ctx.issues.length > 0
            ? matchErrorsToIssues(errors, ctx.issues) : {};
        const count = Object.keys(bridges).length;
        finish(bridges, `matched ${count} of ${errors.length} errors against ${ctx.issues.length} issues`);
    }).catch((err: unknown) => {
        finish({}, `error — ${err instanceof Error ? err.message : String(err)}`);
    });
}

function matchErrorsToIssues(
    errors: readonly RecurringError[], issues: readonly CrashlyticsIssue[],
): Record<string, string> {
    const bridges: Record<string, string> = {};
    for (const err of errors) {
        const words = extractMatchWords(err);
        for (const issue of issues) {
            const combined = (issue.title + ' ' + issue.subtitle).toLowerCase();
            if (words.some(w => combined.includes(w))) {
                bridges[err.hash] = `${issue.eventCount} events, ${issue.userCount} users`;
                break;
            }
        }
    }
    return bridges;
}

function extractMatchWords(err: RecurringError): string[] {
    const text = (err.exampleLine + ' ' + err.normalizedText).toLowerCase();
    return text.split(/\s+/).filter(w => w.length > 5 && !/^[<[\d]/.test(w));
}
