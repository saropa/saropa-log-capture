import * as assert from 'assert';
import { isSlcManifestValid, type SlcManifest } from '../../../modules/export/slc-bundle';

suite('slc-bundle', () => {
    suite('isSlcManifestValid', () => {
        test('accepts valid manifest with version 1 and mainLog', () => {
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: 'session.log', parts: [] }), true);
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: 'a.log', parts: ['a_002.log'], displayName: 'Foo' }), true);
        });

        test('rejects wrong version', () => {
            assert.strictEqual(isSlcManifestValid({ version: 2, mainLog: 'x.log', parts: [] }), false);
        });

        test('rejects missing mainLog', () => {
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: '', parts: [] } as SlcManifest), false);
        });

        test('rejects non-string mainLog', () => {
            assert.strictEqual(isSlcManifestValid({ version: 1, mainLog: undefined as unknown as string, parts: [] }), false);
        });
    });
});
