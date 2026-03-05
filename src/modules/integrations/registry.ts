/**
 * Registry for integration providers. Called from session-lifecycle: getHeaderContributions
 * before LogSession.start(), runOnSessionStartAsync after start (fire-and-forget),
 * runOnSessionEnd during finalizeSession to merge meta and write sidecar files.
 */

import * as vscode from 'vscode';
import type {
    IntegrationProvider, IntegrationContext, IntegrationEndContext,
    Contribution, MetaContribution,
} from './types';
import type { SessionMetadataStore } from '../session/session-metadata';

function collectProviderEndContributions(
    p: IntegrationProvider,
    context: IntegrationEndContext,
    metaOut: MetaContribution[],
    sidecarOut: (Contribution & { kind: 'sidecar' })[],
): Promise<{ contributed: boolean }> {
    return Promise.resolve(p.onSessionEnd!(context)).then(contributions => {
        if (!contributions) { return { contributed: false }; }
        let contributed = false;
        for (const c of contributions) {
            if (c.kind === 'meta') { metaOut.push(c); contributed = true; }
            if (c.kind === 'sidecar') { sidecarOut.push(c); contributed = true; }
        }
        return { contributed };
    }).catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        context.outputChannel.appendLine(`[${p.id}] onSessionEnd failed: ${msg}`);
        return { contributed: false };
    });
}

export class IntegrationRegistry {
    private readonly providers: IntegrationProvider[] = [];

    /** Register a provider. Called once from extension-activation for each built-in provider. */
    register(provider: IntegrationProvider): void {
        if (this.providers.some(p => p.id === provider.id)) { return; }
        this.providers.push(provider);
    }

    unregister(id: string): void {
        const i = this.providers.findIndex(p => p.id === id);
        if (i !== -1) { this.providers.splice(i, 1); }
    }

    /** Returns header lines and contributor ids (sync). Call before LogSession.start(). Never throws; provider errors are logged and skipped.
     * Note: isEnabled may return Promise<boolean> per API; this path treats non-boolean as false (sync only). */
    getHeaderContributions(context: IntegrationContext): { lines: string[]; contributorIds: string[] } {
        const lines: string[] = [];
        const contributorIds: string[] = [];
        for (const p of this.providers) {
            let enabled: boolean;
            try {
                const result = p.isEnabled(context);
                enabled = typeof result === 'boolean' ? result : false;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[${p.id}] isEnabled failed: ${msg}`);
                continue;
            }
            if (!enabled) { continue; }
            const sync = p.onSessionStartSync;
            if (!sync) { continue; }
            let contributions: Contribution[] | undefined;
            try {
                contributions = sync(context);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[${p.id}] onSessionStartSync failed: ${msg}`);
                continue;
            }
            if (!contributions) { continue; }
            let contributed = false;
            for (const c of contributions) {
                if (c.kind === 'header' && c.lines.length) {
                    lines.push(...c.lines);
                    contributed = true;
                }
            }
            if (contributed) { contributorIds.push(p.id); }
        }
        return { lines, contributorIds };
    }

    /** Ids of providers that contributed in the last runOnSessionEnd (for status bar). */
    private lastEndContributorIds: string[] = [];

    /**
     * Runs all enabled providers' onSessionEnd, merges meta into SessionMeta.integrations,
     * and writes sidecar files. Logs errors and continues; never throws.
     */

    async runOnSessionEnd(
        context: IntegrationEndContext,
        metadataStore: SessionMetadataStore,
    ): Promise<{ contributorIds: string[] }> {
        const metaContributions: MetaContribution[] = [];
        const sidecarContributions: (Contribution & { kind: 'sidecar' })[] = [];
        const contributorIds: string[] = [];

        for (const p of this.providers) {
            const enabled = await Promise.resolve(p.isEnabled(context));
            if (!enabled || !p.onSessionEnd) { continue; }
            const result = await collectProviderEndContributions(p, context, metaContributions, sidecarContributions);
            if (result.contributed) { contributorIds.push(p.id); }
        }
        this.lastEndContributorIds = contributorIds;

        if (metaContributions.length > 0) {
            try {
                const meta = await metadataStore.loadMetadata(context.logUri);
                if (!meta.integrations) { meta.integrations = {}; }
                for (const c of metaContributions) {
                    meta.integrations[c.key] = c.payload;
                }
                await metadataStore.saveMetadata(context.logUri, meta);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`Integration meta save failed: ${msg}`);
            }
        }

        for (const c of sidecarContributions) {
            try {
                const uri = vscode.Uri.joinPath(context.logDirUri, c.filename);
                const buf = typeof c.content === 'string'
                    ? Buffer.from(c.content, 'utf-8')
                    : c.content;
                await vscode.workspace.fs.writeFile(uri, buf);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`Sidecar write failed (${c.filename}): ${msg}`);
            }
        }
        return { contributorIds };
    }

    getLastEndContributorIds(): string[] {
        return [...this.lastEndContributorIds];
    }

    /** Runs onSessionStartAsync for all enabled providers. Does not merge results; use for fire-and-forget. */
    runOnSessionStartAsync(context: IntegrationContext): void {
        for (const p of this.providers) {
            Promise.resolve(p.isEnabled(context)).then(enabled => {
                if (!enabled || !p.onSessionStartAsync) { return; }
                return p.onSessionStartAsync!(context);
            }).catch(err => {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[${p.id}] onSessionStartAsync failed: ${msg}`);
            });
        }
    }
}
