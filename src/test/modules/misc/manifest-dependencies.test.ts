import * as assert from 'assert';
import {
    parsePubspecDependencies,
    parsePackageJsonDependencies,
} from '../../../modules/misc/manifest-dependencies';

suite('manifest-dependencies', () => {
    suite('parsePubspecDependencies', () => {
        test('should collect names from dependencies and dev_dependencies', () => {
            const text = [
                'name: my_app',
                'dependencies:',
                '  flutter:',
                '    sdk: flutter',
                '  dio: ^5.4.0',
                '  drift: ^2.0.0',
                'dev_dependencies:',
                '  flutter_test:',
                '    sdk: flutter',
                '  test: ^1.24.0',
            ].join('\n');
            const deps = parsePubspecDependencies(text);
            assert.ok(deps.has('dio'));
            assert.ok(deps.has('drift'));
            assert.ok(deps.has('test'));
            assert.ok(deps.has('flutter'));
            assert.ok(deps.has('flutter_test'));
        });

        test('should include dependency_overrides keys', () => {
            const text = [
                'dependency_overrides:',
                '  http: ^1.2.0',
            ].join('\n');
            const deps = parsePubspecDependencies(text);
            assert.ok(deps.has('http'));
        });

        test('should not treat block-form sub-config as dependency names', () => {
            const text = [
                'dependencies:',
                '  firebase_crashlytics:',
                '    git:',
                '      url: https://example.com/repo.git',
                '      ref: main',
            ].join('\n');
            const deps = parsePubspecDependencies(text);
            assert.ok(deps.has('firebase_crashlytics'));
            assert.ok(!deps.has('git'));
            assert.ok(!deps.has('url'));
            assert.ok(!deps.has('ref'));
        });

        test('should stop collecting once a new top-level key begins', () => {
            const text = [
                'dependencies:',
                '  dio: ^5.0.0',
                'flutter:',
                '  uses-material-design: true',
            ].join('\n');
            const deps = parsePubspecDependencies(text);
            assert.ok(deps.has('dio'));
            // 'uses-material-design' lives under the top-level flutter: config block, not a dependency.
            assert.ok(!deps.has('uses-material-design'));
        });

        test('should ignore comments and blank lines without ending a section', () => {
            const text = [
                'dependencies:',
                '  # database layer',
                '',
                '  drift: ^2.0.0 # local SQL',
                '',
                '  sqflite: ^2.3.0',
            ].join('\n');
            const deps = parsePubspecDependencies(text);
            assert.ok(deps.has('drift'));
            assert.ok(deps.has('sqflite'));
            assert.ok(!deps.has('# database layer'));
        });

        test('should return an empty set for malformed or empty input', () => {
            assert.strictEqual(parsePubspecDependencies('').size, 0);
            assert.strictEqual(parsePubspecDependencies('not: : valid: yaml').size, 0);
        });

        test('should not collect names outside any dependency section', () => {
            const text = [
                'name: my_app',
                'version: 1.0.0',
                'environment:',
                '  sdk: ">=3.0.0 <4.0.0"',
            ].join('\n');
            const deps = parsePubspecDependencies(text);
            assert.strictEqual(deps.size, 0);
        });
    });

    suite('parsePackageJsonDependencies', () => {
        test('should collect names from dependencies and devDependencies', () => {
            const text = JSON.stringify({
                name: 'app',
                dependencies: { axios: '^1.0.0', pg: '^8.0.0' },
                devDependencies: { jest: '^29.0.0' },
            });
            const deps = parsePackageJsonDependencies(text);
            assert.ok(deps.has('axios'));
            assert.ok(deps.has('pg'));
            assert.ok(deps.has('jest'));
        });

        test('should ignore non-object dependency fields', () => {
            const text = JSON.stringify({ dependencies: 'not-an-object', devDependencies: { vitest: '^1.0.0' } });
            const deps = parsePackageJsonDependencies(text);
            assert.ok(deps.has('vitest'));
            assert.strictEqual(deps.size, 1);
        });

        test('should return an empty set for malformed JSON', () => {
            assert.strictEqual(parsePackageJsonDependencies('{ not valid').size, 0);
            assert.strictEqual(parsePackageJsonDependencies('"a string"').size, 0);
            assert.strictEqual(parsePackageJsonDependencies('').size, 0);
        });
    });
});
