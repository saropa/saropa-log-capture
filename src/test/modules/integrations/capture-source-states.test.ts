import * as assert from 'node:assert';
import {
    buildCaptureSourceStates,
    type CaptureSourceState,
    type CaptureSourceRuntimeInput,
} from '../../../modules/integrations/capture-source-states';
import type { SaropaLogCaptureConfig } from '../../../modules/config/config';
import { adbLogcatProvider } from '../../../modules/integrations/providers/adb-logcat';
import { databaseQueryLogsProvider } from '../../../modules/integrations/providers/database-query-logs';

/**
 * Build a minimal config covering only the fields buildCaptureSourceStates reads. Cast through
 * unknown because the full config has ~250 fields the helper never touches.
 */
function cfg(overrides: {
    adapters?: string[];
    adbEnabled?: boolean;
    externalPaths?: string[];
    dbLiveTail?: boolean;
}): SaropaLogCaptureConfig {
    return {
        integrationsAdapters: overrides.adapters ?? [],
        integrationsAdbLogcat: { enabled: overrides.adbEnabled ?? true },
        integrationsExternalLogs: { paths: overrides.externalPaths ?? [] },
        integrationsDatabase: { liveTail: overrides.dbLiveTail ?? false },
    } as unknown as SaropaLogCaptureConfig;
}

function find(states: CaptureSourceState[], id: string): CaptureSourceState {
    const s = states.find((x) => x.id === id);
    assert.ok(s, `expected a capture source with id "${id}"`);
    return s;
}

const withDevice: CaptureSourceRuntimeInput = { debugAdapterType: 'dart', adbDevices: ['emulator-5554'] };
const noDevice: CaptureSourceRuntimeInput = { debugAdapterType: 'dart', adbDevices: [] };
const nonDart: CaptureSourceRuntimeInput = { debugAdapterType: 'node', adbDevices: ['emulator-5554'] };

suite('capture-source-states', () => {
    test('lists the five log-streaming sources in order', () => {
        const ids = buildCaptureSourceStates(cfg({})).map((s) => s.id);
        assert.deepStrictEqual(ids, ['adbLogcat', 'terminal', 'browser', 'externalLogs', 'database']);
    });

    test('no session: sources are on/off from config (adb follows its boolean)', () => {
        assert.strictEqual(find(buildCaptureSourceStates(cfg({ adapters: [] })), 'adbLogcat').state, 'on');
        assert.strictEqual(
            find(buildCaptureSourceStates(cfg({ adbEnabled: false })), 'adbLogcat').state,
            'off',
        );
        assert.strictEqual(find(buildCaptureSourceStates(cfg({ adapters: ['terminal'] })), 'terminal').state, 'on');
        assert.strictEqual(find(buildCaptureSourceStates(cfg({})), 'terminal').state, 'off');
    });

    test('active session: adb is streaming with a device, idle without one', () => {
        const streaming = find(buildCaptureSourceStates(cfg({}), withDevice), 'adbLogcat');
        assert.strictEqual(streaming.state, 'streaming');
        assert.strictEqual(streaming.detail, 'emulator-5554');

        assert.strictEqual(find(buildCaptureSourceStates(cfg({}), noDevice), 'adbLogcat').state, 'idle');
    });

    test('active session: adb is off for a non-Dart session unless explicitly forced', () => {
        // A device is attached, but the session is not Dart and adbLogcat is not in the adapters array.
        assert.strictEqual(find(buildCaptureSourceStates(cfg({}), nonDart), 'adbLogcat').state, 'off');
        // Explicit force via the adapters array makes it apply even for a non-Dart session.
        assert.strictEqual(
            find(buildCaptureSourceStates(cfg({ adapters: ['adbLogcat'] }), nonDart), 'adbLogcat').state,
            'streaming',
        );
    });

    test('active session: adb disabled is off regardless of device', () => {
        assert.strictEqual(
            find(buildCaptureSourceStates(cfg({ adbEnabled: false }), withDevice), 'adbLogcat').state,
            'off',
        );
    });

    test('multiple devices report a count in detail', () => {
        const runtime: CaptureSourceRuntimeInput = { debugAdapterType: 'dart', adbDevices: ['a', 'b'] };
        assert.strictEqual(find(buildCaptureSourceStates(cfg({}), runtime), 'adbLogcat').detail, '2 devices');
    });

    test('non-adb sources map configured-on to streaming when a session is active', () => {
        const states = buildCaptureSourceStates(cfg({ adapters: ['terminal'] }), noDevice);
        assert.strictEqual(find(states, 'terminal').state, 'streaming');
        assert.strictEqual(find(states, 'browser').state, 'off');
    });

    test('externalLogs needs a path; database needs live-tail', () => {
        assert.strictEqual(find(buildCaptureSourceStates(cfg({ adapters: ['externalLogs'] })), 'externalLogs').state, 'off');
        assert.strictEqual(
            find(buildCaptureSourceStates(cfg({ adapters: ['externalLogs'], externalPaths: ['a.log'] })), 'externalLogs').state,
            'on',
        );
        assert.strictEqual(find(buildCaptureSourceStates(cfg({ adapters: ['database'] })), 'database').state, 'off');
        assert.strictEqual(
            find(buildCaptureSourceStates(cfg({ adapters: ['database'], dbLiveTail: true })), 'database').state,
            'on',
        );
    });

    test('every source carries a non-empty display label', () => {
        for (const s of buildCaptureSourceStates(cfg({}))) {
            assert.ok(s.label.length > 0, `source ${s.id} must have a label`);
        }
    });

    // Guard against a registry streaming provider being added without a matching source row: the two
    // providers that stream via the registry (onSessionStartStreaming) must appear in the list. If a
    // third is added, this fails until buildCaptureSourceStates includes it (or it is deliberately
    // excluded here with a reason).
    test('registry streaming providers are represented in the source list', () => {
        const streamingProviders = [adbLogcatProvider, databaseQueryLogsProvider];
        const ids = buildCaptureSourceStates(cfg({})).map((s) => s.id);
        for (const p of streamingProviders) {
            assert.ok(typeof p.onSessionStartStreaming === 'function', `${p.id} should stream`);
            assert.ok(ids.includes(p.id), `capture-source list is missing streaming provider "${p.id}"`);
        }
    });
});
