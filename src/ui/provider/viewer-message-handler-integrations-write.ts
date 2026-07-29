/**
 * setIntegrationsAdapters write path, extracted from viewer-message-handler-panels.ts
 * for the line limit when the screenshots toggle (plan 114) joined the routing.
 *
 * The Integrations checkboxes post ONE id list; three of those ids are UI-only and map
 * to their own booleans instead of the persisted `integrations.adapters` array:
 * explainWithAi → ai.enabled, adbLogcat → integrations.adbLogcat.enabled,
 * screenshots → integrations.screenshots.enabled.
 */

import * as vscode from 'vscode';
import {
    ADB_LOGCAT_ADAPTER_ID,
    EXPLAIN_WITH_AI_ADAPTER_ID,
    SCREENSHOTS_ADAPTER_ID,
    mergeIntegrationAdaptersForWebview,
    stripUiOnlyIntegrationAdapterIds,
} from '../../modules/integrations/integration-adapter-constants';
import { DRIFT_ADVISOR_EXTENSION_ID } from './drift-advisor-integration';

/** Persist the checkbox payload, then echo the merged state back to the webview. */
export function applyIntegrationsAdaptersWrite(rawAdapterIds: unknown, post: (msg: unknown) => void): void {
    const adapterIds = Array.isArray(rawAdapterIds)
        ? (rawAdapterIds as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
    const aiEnabled = adapterIds.includes(EXPLAIN_WITH_AI_ADAPTER_ID);
    // adbLogcat's checkbox binds to its own boolean, not the adapters array — route it there and
    // keep it out of the persisted session-adapter list (see integration-adapter-constants).
    const adbLogcatEnabled = adapterIds.includes(ADB_LOGCAT_ADAPTER_ID);
    // Screenshots follows the same checkbox-to-boolean routing as adbLogcat (plan 114).
    const screenshotsEnabled = adapterIds.includes(SCREENSHOTS_ADAPTER_ID);
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    // The checkbox controls integrations.adbLogcat.enabled, not array membership. But a power user
    // can hand-add 'adbLogcat' to integrations.adapters to force logcat on a NON-Dart session; that
    // explicit entry must survive a UI toggle of any OTHER checkbox. Preserve it while the box stays
    // on; a genuine uncheck (adbLogcatEnabled false) drops it AND sets enabled false, which is the
    // authoritative off.
    const currentAdapters = cfg.get<string[]>('integrations.adapters', []);
    const adbWasExplicit = Array.isArray(currentAdapters) && currentAdapters.includes(ADB_LOGCAT_ADAPTER_ID);
    let sessionOnly = stripUiOnlyIntegrationAdapterIds(adapterIds)
        .filter((id) => id !== ADB_LOGCAT_ADAPTER_ID && id !== SCREENSHOTS_ADAPTER_ID);
    if (adbLogcatEnabled && adbWasExplicit) { sessionOnly = [...sessionOnly, ADB_LOGCAT_ADAPTER_ID]; }
    const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
    void Promise.all([
        cfg.update('integrations.adapters', sessionOnly, vscode.ConfigurationTarget.Workspace),
        cfg.update('integrations.adbLogcat.enabled', adbLogcatEnabled, vscode.ConfigurationTarget.Workspace),
        cfg.update('integrations.screenshots.enabled', screenshotsEnabled, vscode.ConfigurationTarget.Workspace),
        aiCfg.update('enabled', aiEnabled, vscode.ConfigurationTarget.Workspace),
    ]).then(() => {
        const merged = mergeIntegrationAdaptersForWebview(sessionOnly, aiEnabled, adbLogcatEnabled, screenshotsEnabled);
        post({ type: 'integrationsAdapters', adapterIds: merged });
        post({ type: 'setDriftAdvisorAvailable', available: !!vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID) });
        void import('../../modules/integrations/integration-prep.js').then((m) => m.runIntegrationPrepCheck(sessionOnly));
    });
}
