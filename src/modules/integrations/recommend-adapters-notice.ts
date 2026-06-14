/**
 * Activation-time, opt-in nudge: when a workspace's pubspec.yaml declares a
 * package a Log Capture adapter can enrich, offer to turn that adapter on
 * (plan 106). Discovery only — never flips a setting without an explicit tap.
 *
 * Gated per workspace per suggestion set (R5): dismissing the same set never
 * re-prompts, but adding a new dependency that implies a new adapter produces a
 * fresh set and re-triggers. Never throws — activation must not be blocked.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getConfig } from '../config/config';
import { readPubspecDependencies } from '../misc/manifest-dependencies';
import { suggestAdaptersFromPubspec, type AdapterRecommendation } from '../misc/adapter-recommendations';
import { INTEGRATION_ADAPTERS, showIntegrationsPicker } from './integrations-ui';

const SECTION = 'saropaLogCapture';
const ADAPTERS_KEY = 'integrations.adapters';
/** Workspace-state prefix; the suffix is the sorted suggested-id set so a new suggestion re-prompts. */
const dismissedKeyPrefix = 'slc.adapterRecommendDismissed.';

/** Friendly label for an adapter id, falling back to the raw id if it is not in the UI table. */
function adapterLabel(id: string): string {
    return INTEGRATION_ADAPTERS.find(a => a.id === id)?.label ?? id;
}

/** Join a list for display with ", " — used for both trigger packages and adapter labels. */
function joinForDisplay(values: readonly string[]): string {
    return values.join(', ');
}

/** Append recommended adapter ids to the workspace setting (union, preserving existing order). */
async function enableRecommended(recs: readonly AdapterRecommendation[]): Promise<void> {
    const current = getConfig().integrationsAdapters ?? [];
    const merged = [...current];
    for (const rec of recs) {
        if (!merged.includes(rec.adapter)) { merged.push(rec.adapter); }
    }
    const cfg = vscode.workspace.getConfiguration(SECTION);
    await cfg.update(ADAPTERS_KEY, merged, vscode.ConfigurationTarget.Workspace);
    // Surface what changed by name, then run the same prep check the picker uses.
    const labels = recs.map(r => adapterLabel(r.adapter));
    vscode.window.showInformationMessage(t('msg.adapterRecommend.enabled', joinForDisplay(labels)));
    const { runIntegrationPrepCheck } = await import('./integration-prep.js');
    void runIntegrationPrepCheck(merged);
}

/**
 * Inspect the workspace pubspec, compute adapters worth suggesting, and show a
 * single gated information message offering to enable them. Returns early (no
 * prompt) when there is no workspace, no manifest, nothing new to suggest, or
 * the same set was already offered.
 */
export async function maybeRecommendAdapters(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder,
): Promise<void> {
    try {
        const deps = await readPubspecDependencies(folder.uri);
        if (deps.size === 0) { return; }

        const enabled = getConfig().integrationsAdapters ?? [];
        const recs = suggestAdaptersFromPubspec(deps, enabled);
        if (recs.length === 0) { return; }

        // Key the gate on the sorted suggested ids so an unchanged set never re-nags (R5).
        const setKey = recs.map(r => r.adapter).sort().join(',');
        const dismissedKey = dismissedKeyPrefix + setKey;
        if (context.workspaceState.get<boolean>(dismissedKey)) { return; }

        const triggers = [...new Set(recs.map(r => r.trigger))];
        const labels = recs.map(r => adapterLabel(r.adapter));
        const prompt = t('msg.adapterRecommend.prompt', joinForDisplay(triggers), joinForDisplay(labels));

        const choice = await vscode.window.showInformationMessage(
            prompt,
            t('msg.adapterRecommend.enable'),
            t('msg.adapterRecommend.choose'),
        );

        // Any response (enable, choose, or dismiss) retires this set so it does not reappear.
        await context.workspaceState.update(dismissedKey, true);

        if (choice === t('msg.adapterRecommend.enable')) {
            await enableRecommended(recs);
        } else if (choice === t('msg.adapterRecommend.choose')) {
            await showIntegrationsPicker();
        }
    } catch {
        // A recommendation nudge must never break activation; swallow and move on.
    }
}
