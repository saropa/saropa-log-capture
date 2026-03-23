/**
 * Payload pushed to the log viewer webview for noise-learning client behavior.
 */

import * as vscode from "vscode";

export type SetLearningOptionsMessage = {
    type: "setLearningOptions";
    enabled: boolean;
    maxLineLength: number;
    trackScroll: boolean;
};

export function getLearningWebviewOptions(): SetLearningOptionsMessage {
    const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
    return {
        type: "setLearningOptions",
        enabled: cfg.get<boolean>("learning.enabled", true) !== false,
        maxLineLength: cfg.get<number>("learning.maxStoredLineLength", 2000) ?? 2000,
        trackScroll: cfg.get<boolean>("learning.trackScrollBehavior", false) === true,
    };
}
