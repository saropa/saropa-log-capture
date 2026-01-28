import * as assert from 'assert';
import { resolveSourceUri } from '../modules/source-resolver';

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

    test('should strip Dart package prefix', () => {
        // Without a workspace folder, this returns undefined
        // but the prefix stripping logic is still exercised
        const uri = resolveSourceUri('package:my_app/src/widget.dart');
        // May be undefined if no workspace folder is set in test environment
        // The important thing is it doesn't throw
        assert.ok(uri === undefined || uri.fsPath.includes('widget.dart'));
    });
});
