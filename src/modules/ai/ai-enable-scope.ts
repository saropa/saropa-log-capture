/**
 * Where to persist saropaLogCapture.ai.enabled for one-click enablement from the UI.
 * Prefer workspace when a folder is open so Integrations and Settings stay aligned per project.
 */

import * as vscode from 'vscode';

export function getAiEnabledConfigurationTarget(): vscode.ConfigurationTarget {
    return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
}
