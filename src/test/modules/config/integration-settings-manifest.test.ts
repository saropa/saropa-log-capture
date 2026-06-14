/**
 * Guards that integration settings READ by `integration-config.ts` are also
 * DECLARED in package.json `contributes.configuration`. A setting read without a
 * declaration is invisible/uneditable in the VS Code Settings UI; the externalLogs
 * and http adapters previously shipped in exactly that state. These assertions pin
 * the declared default and numeric bounds to the values the config reader expects,
 * so the manifest and reader cannot silently drift apart again.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

interface ConfigProp {
    readonly default?: unknown;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly type?: string;
}

function manifestProps(): Record<string, ConfigProp> {
    // out/test/modules/config/<file>.js -> repo root is four levels up.
    const root = path.resolve(__dirname, '..', '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(root, 'utf8')) as {
        contributes: { configuration: { properties: Record<string, ConfigProp> } };
    };
    return pkg.contributes.configuration.properties;
}

suite('integration settings manifest', () => {
    const props = manifestProps();
    const prefix = 'saropaLogCapture.';

    suite('externalLogs adapter', () => {
        test('paths is a string[] defaulting to empty', () => {
            const p = props[`${prefix}integrations.externalLogs.paths`];
            assert.ok(p, 'integrations.externalLogs.paths must be declared');
            assert.strictEqual(p.type, 'array');
            assert.deepStrictEqual(p.default, []);
        });

        test('writeSidecars and prefixLines default to true', () => {
            assert.strictEqual(props[`${prefix}integrations.externalLogs.writeSidecars`]?.default, true);
            assert.strictEqual(props[`${prefix}integrations.externalLogs.prefixLines`]?.default, true);
        });

        test('maxLinesPerFile default and bounds match the reader clamp', () => {
            const p = props[`${prefix}integrations.externalLogs.maxLinesPerFile`];
            assert.ok(p, 'integrations.externalLogs.maxLinesPerFile must be declared');
            assert.strictEqual(p.default, 10000);
            assert.strictEqual(p.minimum, 100);
            assert.strictEqual(p.maximum, 1000000);
        });
    });

    suite('http adapter', () => {
        test('requestLogPath and requestIdPattern default to empty strings', () => {
            assert.strictEqual(props[`${prefix}integrations.http.requestLogPath`]?.default, '');
            assert.strictEqual(props[`${prefix}integrations.http.requestIdPattern`]?.default, '');
        });

        test('timeWindowSeconds default and bounds match the reader clamp', () => {
            const p = props[`${prefix}integrations.http.timeWindowSeconds`];
            assert.ok(p, 'integrations.http.timeWindowSeconds must be declared');
            assert.strictEqual(p.default, 10);
            assert.strictEqual(p.minimum, 1);
            assert.strictEqual(p.maximum, 120);
        });

        test('maxRequestsPerSession default and bounds match the reader clamp', () => {
            const p = props[`${prefix}integrations.http.maxRequestsPerSession`];
            assert.ok(p, 'integrations.http.maxRequestsPerSession must be declared');
            assert.strictEqual(p.default, 500);
            assert.strictEqual(p.minimum, 10);
            assert.strictEqual(p.maximum, 5000);
        });
    });
});
