import * as assert from 'assert';
import { isFrameworkFrame, isAppFrame } from '../modules/stack-parser';

suite('StackParser', () => {

    // --- Dart / Flutter ---

    test('should detect Flutter package frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  at package:flutter/src/widgets/framework.dart:4567'), true);
    });

    test('should detect dart: SDK frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  at dart:async/future.dart:42'), true);
    });

    // --- Node.js ---

    test('should detect node_modules frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('    at Object.<anonymous> (/app/node_modules/express/lib/router.js:46:12)'), true);
    });

    test('should detect node:internal frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('    at Module._compile (node:internal/modules/cjs/loader:1241:14)'), true);
    });

    test('should detect <anonymous> frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('    at <anonymous>'), true);
    });

    // --- Python ---

    test('should detect Python lib frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  File "/usr/lib/python3.11/asyncio/base_events.py", line 123'), true);
    });

    test('should detect site-packages frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  File "/env/lib/python3.11/site-packages/django/core/handlers.py"'), true);
    });

    // --- Go ---

    test('should detect Go runtime frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  /usr/local/go/src/runtime/panic.go:884 +0x212'), true);
    });

    test('should detect runtime/ frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  runtime/proc.go:250'), true);
    });

    // --- Java / .NET ---

    test('should detect java.lang frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  at java.lang.Thread.run(Thread.java:750)'), true);
    });

    test('should detect System.Net frame as framework', () => {
        assert.strictEqual(isFrameworkFrame('  at System.Net.Http.HttpClient.SendAsync()'), true);
    });

    // --- App code ---

    test('should treat workspace-relative path as app code', () => {
        assert.strictEqual(isFrameworkFrame('  at lib/main.dart:10'), false);
    });

    test('should treat path under workspace as app code', () => {
        const ws = '/home/user/myapp';
        assert.strictEqual(isFrameworkFrame('  at /home/user/myapp/src/handler.ts:42', ws), false);
    });

    test('should treat path outside workspace as framework', () => {
        const ws = '/home/user/myapp';
        assert.strictEqual(isFrameworkFrame('  at /home/other/lib/util.ts:10', ws), true);
    });

    // --- isAppFrame (inverse) ---

    test('isAppFrame should be inverse of isFrameworkFrame', () => {
        assert.strictEqual(isAppFrame('  at package:flutter/foo.dart'), false);
        assert.strictEqual(isAppFrame('  at lib/main.dart:10'), true);
    });

    // --- Edge cases ---

    test('should return false for empty string', () => {
        assert.strictEqual(isFrameworkFrame(''), false);
    });

    test('should handle Windows paths under workspace', () => {
        const ws = 'C:\\Users\\dev\\project';
        assert.strictEqual(isFrameworkFrame('  at C:\\Users\\dev\\project\\src\\app.ts:5', ws), false);
    });
});
