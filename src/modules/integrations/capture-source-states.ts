/**
 * Log-relevant capture-source state for the viewer Filters panel.
 *
 * These are the integrations that STREAM lines into the log viewer (adb logcat, terminal,
 * browser/DevTools, external log tailers, database live-tail) — as opposed to header- or
 * metadata-only integrations (git, coverage, build/CI) that never contribute viewer rows.
 * The Filters panel "Log Sources" tab shows this list so a user can see which sources are
 * feeding the log and jump to their Options toggle.
 *
 * Two levels of accuracy:
 *  - No active debug session → the CONFIGURED state ('on' / 'off'), derived from config alone.
 *  - Active session → the RUNTIME state ('streaming' / 'idle' / 'off'): 'streaming' means the
 *    source is actually producing (for adb, a device is attached), 'idle' means it is enabled and
 *    applies to this session but has nothing to stream (adb enabled but no device attached).
 * The adb source is the only one with a cheap runtime probe (`adb devices`); the others map their
 * configured-on state to 'streaming' when a session is active.
 */

import * as vscode from 'vscode';
import { getConfig, type SaropaLogCaptureConfig } from '../config/config';
import { INTEGRATION_ADAPTERS } from './integrations-ui';
import { ADB_LOGCAT_ADAPTER_ID } from './integration-adapter-constants';
import { listAdbDevices } from './adb-logcat-capture';

/**
 * A source's on/off word. 'on' / 'off' when no session is running (configured state); 'streaming' /
 * 'idle' / 'off' when a session is active (runtime state). The webview colors 'streaming'/'on'
 * green, 'idle' amber, 'off' gray.
 */
export type CaptureSourceRuntime = 'streaming' | 'idle' | 'on' | 'off';

/** One capture source and its current state. */
export interface CaptureSourceState {
    /** Integration adapter id (matches INTEGRATION_ADAPTERS / the Options checkbox). */
    readonly id: string;
    /** Display label — reused from the adapter metadata so the two never drift. */
    readonly label: string;
    /** On/off (no session) or streaming/idle/off (active session). */
    readonly state: CaptureSourceRuntime;
    /** Optional extra context, e.g. an attached device serial. Rendered after the state word. */
    readonly detail?: string;
}

/** Runtime signals for the active debug session; absent means "no session, use configured state". */
export interface CaptureSourceRuntimeInput {
    /** The active debug adapter type (e.g. 'dart'); gates adb auto-detect. */
    readonly debugAdapterType?: string;
    /** Serials of attached, ready devices (from `adb devices`); distinguishes streaming vs idle. */
    readonly adbDevices: readonly string[];
}

/** Look up an adapter's display label; falls back to the id if the adapter is not in the meta list. */
function labelFor(id: string): string {
    return INTEGRATION_ADAPTERS.find((a) => a.id === id)?.label ?? id;
}

/** Map a plain configured-on flag to a state, given whether a session is active. */
function simpleState(configuredOn: boolean, sessionActive: boolean): CaptureSourceRuntime {
    if (!configuredOn) { return 'off'; }
    return sessionActive ? 'streaming' : 'on';
}

/** Resolve the adb source's state — the only source with a runtime (device-attached) probe. */
function adbState(config: SaropaLogCaptureConfig, runtime?: CaptureSourceRuntimeInput): CaptureSourceState {
    const base = { id: ADB_LOGCAT_ADAPTER_ID, label: labelFor(ADB_LOGCAT_ADAPTER_ID) };
    if (!config.integrationsAdbLogcat.enabled) { return { ...base, state: 'off' }; }
    if (!runtime) { return { ...base, state: 'on' }; }
    // Session active: mirror the provider's checkEnabled (explicit adapter OR Dart auto-detect).
    const applies = (config.integrationsAdapters ?? []).includes(ADB_LOGCAT_ADAPTER_ID)
        || runtime.debugAdapterType === 'dart';
    if (!applies) { return { ...base, state: 'off' }; }
    if (runtime.adbDevices.length === 0) { return { ...base, state: 'idle' }; }
    // detail names the single device, or the count when several are attached.
    const detail = runtime.adbDevices.length === 1 ? runtime.adbDevices[0] : `${runtime.adbDevices.length} devices`;
    return { ...base, state: 'streaming', detail };
}

/**
 * Build the log-relevant capture-source list for the Filters panel. Ordered most-to-least common
 * for a Flutter/Android workflow. Each non-adb source mirrors its own provider's enable gate (see
 * the matching `isEnabled` in each provider under integrations/providers/).
 */
export function buildCaptureSourceStates(
    config: SaropaLogCaptureConfig,
    runtime?: CaptureSourceRuntimeInput,
): CaptureSourceState[] {
    const adapters = config.integrationsAdapters ?? [];
    const active = runtime !== undefined;
    return [
        adbState(config, runtime),
        { id: 'terminal', label: labelFor('terminal'), state: simpleState(adapters.includes('terminal'), active) },
        { id: 'browser', label: labelFor('browser'), state: simpleState(adapters.includes('browser'), active) },
        // External tailers only stream when at least one path is configured.
        { id: 'externalLogs', label: labelFor('externalLogs'), state: simpleState(adapters.includes('externalLogs') && config.integrationsExternalLogs.paths.length > 0, active) },
        // Database contributes a live stream only in live-tail mode.
        { id: 'database', label: labelFor('database'), state: simpleState(adapters.includes('database') && config.integrationsDatabase.liveTail, active) },
    ];
}

/**
 * Compute and post the capture-source list to the webview via `post`. Reads the current config and
 * the active debug session: when a session is running AND adb is enabled, probes `adb devices` (async,
 * off the critical path) so the adb row can show streaming-with-device vs idle. All push sites (viewer
 * load, config change, session start/stop) call this one resolver so the state model stays consistent.
 */
export async function resolveAndPostCaptureSources(post: (msg: unknown) => void): Promise<void> {
    const config = getConfig();
    const active = vscode.debug.activeDebugSession;
    let runtime: CaptureSourceRuntimeInput | undefined;
    if (active) {
        // Only spend a subprocess on the device probe when adb could actually stream.
        const adbDevices = config.integrationsAdbLogcat.enabled ? await listAdbDevices() : [];
        runtime = { debugAdapterType: active.type, adbDevices };
    }
    post({ type: 'captureSources', sources: buildCaptureSourceStates(config, runtime) });
}
