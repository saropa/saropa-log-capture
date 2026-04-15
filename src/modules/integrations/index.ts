/**
 * Integration API: types, registry, and context helpers.
 * Providers register with the registry; session lifecycle calls getHeaderContributions
 * and runOnSessionEnd. See docs/history/INTEGRATION_API.md.
 */

export type {
    Contribution, HeaderContribution, MetaContribution, SidecarContribution,
    IntegrationProvider, IntegrationContext, IntegrationEndContext,
    StreamingWriter,
} from './types';
export { IntegrationRegistry, type RunOnSessionStartAsyncOptions } from './registry';
export {
    createIntegrationContext,
    createIntegrationEndContext,
    type IntegrationEndContextParams,
} from './context';

import { IntegrationRegistry } from './registry';

let defaultRegistry: IntegrationRegistry | undefined;

/** Returns the default integration registry (singleton). Used by session lifecycle. */
export function getDefaultIntegrationRegistry(): IntegrationRegistry {
    if (!defaultRegistry) { defaultRegistry = new IntegrationRegistry(); }
    return defaultRegistry;
}
