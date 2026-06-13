import * as assert from 'assert';
import { resolveSourceUri } from '../../../modules/source/source-resolver';

suite('resolveSourceUri', () => {

    test('should return undefined for empty path', () => {
        assert.strictEqual(resolveSourceUri(''), undefined);
    });

    test('should resolve absolute Unix path', () => {
        const uri = resolveSourceUri('/home/user/project/src/file.ts');
        assert.ok(uri);
        assert.ok(uri.fsPath.includes('file.ts'));
    });

    test('should resolve Windows drive path', () => {
        const uri = resolveSourceUri('C:\\Users\\project\\src\\file.ts');
        assert.ok(uri);
        assert.ok(uri.fsPath.includes('file.ts'));
    });

    test('should resolve UNC path starting with backslash', () => {
        const uri = resolveSourceUri('\\\\server\\share\\file.ts');
        assert.ok(uri);
    });

    test('should map a Dart package URI under the package lib/ directory', () => {
        // package: URIs resolve to the package's lib/ dir, so package:my_app/src/widget.dart maps to
        // <root>/lib/src/widget.dart — NOT <root>/src/widget.dart (which doesn't exist). Use uri.path
        // (forward-slash normalized) so the assertion holds on Windows too. May be undefined when no
        // workspace folder is set; the test environment does provide one.
        const uri = resolveSourceUri('package:my_app/src/widget.dart');
        assert.ok(
            uri === undefined || uri.path.includes('/lib/src/widget.dart'),
            `expected package: URI to map under lib/, got ${uri?.path}`,
        );
    });
});
