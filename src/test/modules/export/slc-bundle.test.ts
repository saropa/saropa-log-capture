import * as assert from 'assert';
import { isSlcManifestValid, type SlcManifest } from '../../../modules/export/slc-bundle';

suite('slc-bundle', () => {
    suite('isSlcManifestValid', () => {
        test('accepts valid manifest with version 1 and mainLog', () => {
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: 'session.log', parts: [] }), true);
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: 'a.log', parts: ['a_002.log'], displayName: 'Foo' }), true);
        });

        test('accepts valid manifest with version 2 and sidecars', () => {
            assert.strictEqual(isSlcManifestValid({ version: 2, mainLog: 'session.log', parts: [] }), true);
            assert.strictEqual(isSlcManifestValid({ version: 2, mainLog: 'a.log', parts: [], sidecars: ['a.perf.json'] }), true);
        });

        test('rejects unsupported version', () => {
            assert.strictEqual(isSlcManifestValid({ version: 3, mainLog: 'x.log', parts: [] }), false);
            assert.strictEqual(isSlcManifestValid({ version: 0, mainLog: 'x.log', parts: [] }), false);
        });

        test('accepts valid v3 investigation manifest', () => {
            assert.strictEqual(
                isSlcManifestValid({
                    version: 3,
                    type: 'investigation',
                    investigation: { name: 'My Investigation', sources: [] },
                }),
                true,
            );
            assert.strictEqual(
                isSlcManifestValid({
                    version: 3,
                    type: 'investigation',
                    investigation: { name: 'X', sources: [{ type: 'session', filename: 'a.log', label: 'A' }] },
                }),
                true,
            );
        });

        test('rejects missing mainLog', () => {
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: '', parts: [] } as SlcManifest), false);
        });

        test('rejects non-string mainLog', () => {
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: undefined as unknown as string, parts: [] }), false);
        });
    });
});
