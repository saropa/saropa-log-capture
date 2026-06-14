import * as assert from 'assert';
import { suggestAdaptersFromPubspec } from '../../../modules/misc/adapter-recommendations';
import { INTEGRATION_ADAPTERS } from '../../../modules/integrations/integrations-ui';

suite('adapter-recommendations', () => {
    suite('suggestAdaptersFromPubspec', () => {
        test('should map known packages to their adapter ids', () => {
            const deps = new Set(['firebase_crashlytics', 'drift', 'dio']);
            const recs = suggestAdaptersFromPubspec(deps, []);
            const adapters = recs.map(r => r.adapter);
            assert.ok(adapters.includes('crashlytics'));
            assert.ok(adapters.includes('database'));
            assert.ok(adapters.includes('driftAdvisor'));
            assert.ok(adapters.includes('http'));
        });

        test('should record the triggering dependency for each adapter', () => {
            const recs = suggestAdaptersFromPubspec(new Set(['dio']), []);
            assert.strictEqual(recs.length, 1);
            assert.strictEqual(recs[0].adapter, 'http');
            assert.strictEqual(recs[0].trigger, 'dio');
        });

        test('should exclude adapters that are already enabled', () => {
            const deps = new Set(['drift']);
            const recs = suggestAdaptersFromPubspec(deps, ['database']);
            const adapters = recs.map(r => r.adapter);
            assert.ok(!adapters.includes('database'));
            assert.ok(adapters.includes('driftAdvisor'));
        });

        test('should dedupe an adapter implied by multiple dependencies', () => {
            const deps = new Set(['dio', 'http', 'chopper']);
            const recs = suggestAdaptersFromPubspec(deps, []);
            assert.strictEqual(recs.filter(r => r.adapter === 'http').length, 1);
        });

        test('should return nothing for dependencies with no mapping', () => {
            const recs = suggestAdaptersFromPubspec(new Set(['provider', 'intl']), []);
            assert.strictEqual(recs.length, 0);
        });

        test('should return nothing when every mapped adapter is already enabled', () => {
            const deps = new Set(['firebase_crashlytics']);
            const recs = suggestAdaptersFromPubspec(deps, ['crashlytics']);
            assert.strictEqual(recs.length, 0);
        });

        test('should treat the flutter SDK marker as implying device and crash capture', () => {
            const recs = suggestAdaptersFromPubspec(new Set(['flutter']), []);
            const adapters = recs.map(r => r.adapter);
            assert.ok(adapters.includes('adbLogcat'));
            assert.ok(adapters.includes('flutterCrashLogs'));
        });

        // Every adapter the mapping can emit must exist in the UI table, or the toast
        // would name a raw id instead of a friendly label (and the picker would not list it).
        test('should only map to adapter ids known to the integrations UI table', () => {
            const knownIds = new Set(INTEGRATION_ADAPTERS.map(a => a.id));
            const allTriggers = new Set([
                'firebase_crashlytics', 'drift', 'moor', 'sqflite', 'sqlite3',
                'dio', 'http', 'chopper', 'retrofit',
                'flutter_test', 'test', 'integration_test', 'coverage', 'flutter',
            ]);
            const recs = suggestAdaptersFromPubspec(allTriggers, []);
            for (const rec of recs) {
                assert.ok(knownIds.has(rec.adapter), `adapter "${rec.adapter}" missing from INTEGRATION_ADAPTERS`);
            }
        });
    });
});
