import * as assert from 'assert';
import { listSettingKeys } from '../legacy-compat';

suite('legacy-compat listSettingKeys', () => {
    test('should strip the saropaCapture prefix from a single configuration object', () => {
        const keys = listSettingKeys({ contributes: { configuration: { properties: { 'saropaCapture.foo': {}, 'saropaCapture.bar.baz': {} } } } });
        assert.deepStrictEqual(keys, ['foo', 'bar.baz']);
    });

    test('should merge properties across an array of configuration sections', () => {
        const keys = listSettingKeys({ contributes: { configuration: [{ properties: { 'saropaCapture.a': {} } }, { properties: { 'saropaCapture.b': {} } }] } });
        assert.deepStrictEqual(keys, ['a', 'b']);
    });

    test('should ignore keys outside the prefix and tolerate a missing configuration', () => {
        assert.deepStrictEqual(listSettingKeys({ contributes: { configuration: { properties: { 'other.x': {} } } } }), []);
        assert.deepStrictEqual(listSettingKeys({}), []);
    });
});
