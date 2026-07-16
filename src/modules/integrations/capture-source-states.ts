/**
 * Log-relevant capture-source state for the viewer Filters panel.
 *
 * These are the integrations that STREAM lines into the log viewer (adb logcat, terminal,
 * browser/DevTools, external log tailers, database live-tail) — as opposed to header- or
 * metadata-only integrations (git, coverage, build/CI) that never contribute viewer rows.
 * The Filters panel "Log Sources" tab shows this list so a user can see which sources are
 * feeding the log and jump to their Options toggle.
 *
 * State is derived from config, so it reflects the user's on/off choices and refreshes live on
 * a settings change. It is intentionally the CONFIGURED state ("this source is turned on"), not a
 * per-session runtime probe ("adb has a device attached right now") — the latter is a follow-up
 * (see bugs/ENH_surface_integrations_in_filters.md, open question 2).
 */

import type { SaropaLogCaptureConfig } from '../config/config';
import { INTEGRATION_ADAPTERS } from './integrations-ui';
import { ADB_LOGCAT_ADAPTER_ID } from './integration-adapter-constants';

/** One capture source and whether it is currently switched on. */
export interface CaptureSourceState {
    /** Integration adapter id (matches INTEGRATION_ADAPTERS / the Options checkbox). */
    readonly id: string;
    /** Display label — reused from the adapter metadata so the two never drift. */
    readonly label: string;
    /** True when this source is configured on and would feed the log. */
    readonly on: boolean;
}

/** Look up an adapter's display label; falls back to the id if the adapter is not in the meta list. */
function labelFor(id: string): string {
    return INTEGRATION_ADAPTERS.find((a) => a.id === id)?.label ?? id;
}

/**
 * Build the log-relevant capture-source list for the Filters panel. Ordered most-to-least common
 * for a Flutter/Android workflow. `on` mirrors each provider's own enable gate (see the matching
 * `isEnabled` in each provider under integrations/providers/).
 */
export function getCaptureSourceStates(config: SaropaLogCaptureConfig): CaptureSourceState[] {
    const adapters = config.integrationsAdapters ?? [];
    return [
        // adb logcat's on/off lives in its own boolean (the Options checkbox binds to it), not the array.
        { id: ADB_LOGCAT_ADAPTER_ID, label: labelFor(ADB_LOGCAT_ADAPTER_ID), on: config.integrationsAdbLogcat.enabled },
        { id: 'terminal', label: labelFor('terminal'), on: adapters.includes('terminal') },
        { id: 'browser', label: labelFor('browser'), on: adapters.includes('browser') },
        // External tailers only stream when at least one path is configured.
        { id: 'externalLogs', label: labelFor('externalLogs'), on: adapters.includes('externalLogs') && config.integrationsExternalLogs.paths.length > 0 },
        // Database contributes a live stream only in live-tail mode.
        { id: 'database', label: labelFor('database'), on: adapters.includes('database') && config.integrationsDatabase.liveTail },
    ];
}
