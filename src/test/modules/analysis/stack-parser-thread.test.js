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
suite('parseThreadHeader', () => {
    test('should parse quoted thread name with tid and state', () => {
        const result = (0, stack_parser_1.parseThreadHeader)('"main" tid=1 Runnable');
        assert.ok(result);
        assert.strictEqual(result.name, 'main');
        assert.strictEqual(result.tid, 1);
        assert.strictEqual(result.state, 'Runnable');
    });
    test('should parse thread with prio and tid', () => {
        const result = (0, stack_parser_1.parseThreadHeader)('"AsyncTask #1" prio=5 tid=12 Waiting');
        assert.ok(result);
        assert.strictEqual(result.name, 'AsyncTask #1');
        assert.strictEqual(result.tid, 12);
        assert.strictEqual(result.state, 'Waiting');
    });
    test('should parse dash-delimited thread header', () => {
        const result = (0, stack_parser_1.parseThreadHeader)('--- main ---');
        assert.ok(result);
        assert.strictEqual(result.name, 'main');
        assert.strictEqual(result.tid, undefined);
        assert.strictEqual(result.state, undefined);
    });
    test('should return undefined for regular stack frame', () => {
        assert.strictEqual((0, stack_parser_1.parseThreadHeader)('    at com.example.MyClass.method(MyClass.java:42)'), undefined);
    });
    test('should return undefined for regular log line', () => {
        assert.strictEqual((0, stack_parser_1.parseThreadHeader)('D/Flutter ( 1234): Hello world'), undefined);
    });
    test('should return undefined for empty string', () => {
        assert.strictEqual((0, stack_parser_1.parseThreadHeader)(''), undefined);
    });
    test('should return undefined for very long string', () => {
        assert.strictEqual((0, stack_parser_1.parseThreadHeader)('x'.repeat(250)), undefined);
    });
    test('should handle leading/trailing whitespace', () => {
        const result = (0, stack_parser_1.parseThreadHeader)('  "worker-1" tid=3 Blocked  ');
        assert.ok(result);
        assert.strictEqual(result.name, 'worker-1');
        assert.strictEqual(result.tid, 3);
        assert.strictEqual(result.state, 'Blocked');
    });
});
//# sourceMappingURL=stack-parser-thread.test.js.map