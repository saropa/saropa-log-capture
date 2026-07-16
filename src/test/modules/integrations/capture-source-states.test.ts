import * as assert from 'node:assert';
import { getCaptureSourceStates } from '../../../modules/integrations/capture-source-states';
import type { SaropaLogCaptureConfig } from '../../../modules/config/config';

/**
 * Build a minimal config covering only the fields getCaptureSourceStates reads. Cast through
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

function on(states: ReturnType<typeof getCaptureSourceStates>, id: string): boolean {
    const s = states.find((x) => x.id === id);
    assert.ok(s, `expected a capture source with id "${id}"`);
    return s.on;
}

suite('capture-source-states', () => {
    test('lists the five log-streaming sources', () => {
        const ids = getCaptureSourceStates(cfg({})).map((s) => s.id);
        assert.deepStrictEqual(ids, ['adbLogcat', 'terminal', 'browser', 'externalLogs', 'database']);
    });

    test('adbLogcat.on follows its own boolean, not the adapters array', () => {
        // Default: enabled true -> on, even though adbLogcat is not in the adapters array.
        assert.strictEqual(on(getCaptureSourceStates(cfg({ adapters: [] })), 'adbLogcat'), true);
        // Disabled -> off, even if the array still lists it (the boolean wins).
        assert.strictEqual(
            on(getCaptureSourceStates(cfg({ adapters: ['adbLogcat'], adbEnabled: false })), 'adbLogcat'),
            false,
        );
    });

    test('terminal and browser follow adapters membership', () => {
        const states = getCaptureSourceStates(cfg({ adapters: ['terminal'] }));
        assert.strictEqual(on(states, 'terminal'), true);
        assert.strictEqual(on(states, 'browser'), false);
    });

    test('externalLogs is on only when enabled AND a path is configured', () => {
        assert.strictEqual(on(getCaptureSourceStates(cfg({ adapters: ['externalLogs'] })), 'externalLogs'), false);
        assert.strictEqual(
            on(getCaptureSourceStates(cfg({ adapters: ['externalLogs'], externalPaths: ['app.log'] })), 'externalLogs'),
            true,
        );
    });

    test('database is on only when enabled AND live-tail mode', () => {
        assert.strictEqual(on(getCaptureSourceStates(cfg({ adapters: ['database'] })), 'database'), false);
        assert.strictEqual(
            on(getCaptureSourceStates(cfg({ adapters: ['database'], dbLiveTail: true })), 'database'),
            true,
        );
    });

    test('every source carries a non-empty display label', () => {
        for (const s of getCaptureSourceStates(cfg({}))) {
            assert.ok(s.label.length > 0, `source ${s.id} must have a label`);
        }
    });
});
