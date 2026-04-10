"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const stack_parser_1 = require("../../../modules/analysis/stack-parser");
suite('StackParser', () => {
    suite('isAsciiBoxDrawingDecorLine', () => {
        test('detects paired vertical-bar banner rows', () => {
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('│      Open in browser to view your database:      │'), true);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('      │              http://127.0.0.1:8642               │'), true);
        });
        test('detects paired bars with only whitespace between them', () => {
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('\u2502          \u2502'), true);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('\u2502 \u2502'), true);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('   \u2502     \u2502  '), true);
        });
        test('detects double-vertical-bar (║) banner rows', () => {
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('║                     ISAR CONNECT STARTED                     ║'), true);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('║             Open the link to connect to the Isar             ║'), true);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('║ https://inspect.isar-community.dev/3.3.0/#/37391/Q3SG7NeTAHc ║'), true);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('\u2551     \u2551'), true);
        });
        test('does not match single gutter lines', () => {
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('│ #0  package:foo/main.dart  foo (package:foo/a.dart:1:1)'), false);
            assert.strictEqual((0, stack_parser_1.isAsciiBoxDrawingDecorLine)('│  at Object.run (main.js:1:1)'), false);
        });
    });
    suite('isStackFrameLine — box art exemption', () => {
        test('should not treat paired empty bars as a stack frame', () => {
            assert.strictEqual((0, stack_parser_1.isStackFrameLine)('\u2502          \u2502'), false);
            assert.strictEqual((0, stack_parser_1.isStackFrameLine)('\u2502 \u2502'), false);
        });
        test('should not treat paired content bars as a stack frame', () => {
            assert.strictEqual((0, stack_parser_1.isStackFrameLine)('\u2502  DRIFT DEBUG SERVER  \u2502'), false);
        });
        test('should still treat single gutter bar as a stack frame', () => {
            assert.strictEqual((0, stack_parser_1.isStackFrameLine)('\u2502 #0  main (package:foo/main.dart:1:1)'), true);
        });
    });
    // --- Dart / Flutter ---
    test('should detect Flutter package frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at package:flutter/src/widgets/framework.dart:4567'), true);
    });
    test('should detect dart: SDK frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at dart:async/future.dart:42'), true);
    });
    // --- Node.js ---
    test('should detect node_modules frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('    at Object.<anonymous> (/app/node_modules/express/lib/router.js:46:12)'), true);
    });
    test('should detect node:internal frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('    at Module._compile (node:internal/modules/cjs/loader:1241:14)'), true);
    });
    test('should detect <anonymous> frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('    at <anonymous>'), true);
    });
    // --- Python ---
    test('should detect Python lib frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  File "/usr/lib/python3.11/asyncio/base_events.py", line 123'), true);
    });
    test('should detect site-packages frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  File "/env/lib/python3.11/site-packages/django/core/handlers.py"'), true);
    });
    // --- Go ---
    test('should detect Go runtime frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  /usr/local/go/src/runtime/panic.go:884 +0x212'), true);
    });
    test('should detect runtime/ frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  runtime/proc.go:250'), true);
    });
    // --- Java / .NET ---
    test('should detect java.lang frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at java.lang.Thread.run(Thread.java:750)'), true);
    });
    test('should detect System.Net frame as framework', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at System.Net.Http.HttpClient.SendAsync()'), true);
    });
    // --- App code ---
    test('should treat workspace-relative path as app code', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at lib/main.dart:10'), false);
    });
    test('should treat path under workspace as app code', () => {
        const ws = '/home/user/myapp';
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at /home/user/myapp/src/handler.ts:42', ws), false);
    });
    test('should treat path outside workspace as framework', () => {
        const ws = '/home/user/myapp';
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at /home/other/lib/util.ts:10', ws), true);
    });
    // --- isAppFrame (inverse) ---
    test('isAppFrame should be inverse of isFrameworkFrame', () => {
        assert.strictEqual((0, stack_parser_1.isAppFrame)('  at package:flutter/foo.dart'), false);
        assert.strictEqual((0, stack_parser_1.isAppFrame)('  at lib/main.dart:10'), true);
    });
    // --- Workspace priority over framework patterns ---
    test('should treat workspace runtime/ directory as app code', () => {
        const ws = '/home/user/myapp';
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at /home/user/myapp/src/runtime/handler.go:42', ws), false);
    });
    // --- Edge cases ---
    test('should return false for empty string', () => {
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)(''), false);
    });
    test('should handle Windows paths under workspace', () => {
        const ws = 'C:\\Users\\dev\\project';
        assert.strictEqual((0, stack_parser_1.isFrameworkFrame)('  at C:\\Users\\dev\\project\\src\\app.ts:5', ws), false);
    });
});
//# sourceMappingURL=stack-parser.test.js.map