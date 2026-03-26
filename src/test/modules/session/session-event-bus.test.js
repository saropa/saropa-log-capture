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
const session_event_bus_1 = require("../../../modules/session/session-event-bus");
function body(output, category) {
    return { output, category: category ?? 'console' };
}
suite('EarlyOutputBuffer', () => {
    test('add and drain return buffered events', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        buf.add('s1', body('a'));
        buf.add('s1', body('b'));
        const drained = buf.drain('s1');
        assert.strictEqual(drained.length, 2);
        assert.strictEqual(drained[0].output, 'a');
        assert.strictEqual(drained[1].output, 'b');
    });
    test('drain removes session from buffer', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        buf.add('s1', body('x'));
        buf.drain('s1');
        assert.strictEqual(buf.drain('s1').length, 0);
    });
    test('drain returns empty array for unknown session', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        assert.deepStrictEqual(buf.drain('unknown'), []);
    });
    test('delete removes session without returning', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        buf.add('s1', body('x'));
        buf.delete('s1');
        assert.strictEqual(buf.drain('s1').length, 0);
    });
    test('clear removes all sessions', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        buf.add('s1', body('a'));
        buf.add('s2', body('b'));
        buf.clear();
        assert.strictEqual(buf.drain('s1').length, 0);
        assert.strictEqual(buf.drain('s2').length, 0);
    });
    test('sessions are buffered independently', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        buf.add('s1', body('one'));
        buf.add('s2', body('two'));
        buf.add('s1', body('three'));
        assert.strictEqual(buf.drain('s1').length, 2);
        assert.strictEqual(buf.drain('s2').length, 1);
    });
    test('caps at maxEarlyBuffer (500) per session', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        for (let i = 0; i < 600; i++) {
            buf.add('s1', body(`line ${i}`));
        }
        const drained = buf.drain('s1');
        assert.strictEqual(drained.length, 500);
        assert.strictEqual(drained[0].output, 'line 0');
        assert.strictEqual(drained[499].output, 'line 499');
    });
    test('drainAll returns all sessions and clears buffer', () => {
        const buf = new session_event_bus_1.EarlyOutputBuffer();
        buf.add('s1', body('a'));
        buf.add('s2', body('b'));
        buf.add('s1', body('c'));
        const all = buf.drainAll();
        assert.strictEqual(all.size, 2);
        assert.strictEqual(all.get('s1').length, 2);
        assert.strictEqual(all.get('s2').length, 1);
        assert.strictEqual(all.get('s1')[0].output, 'a');
        assert.strictEqual(all.get('s1')[1].output, 'c');
        assert.strictEqual(all.get('s2')[0].output, 'b');
        assert.strictEqual(buf.drain('s1').length, 0);
        assert.strictEqual(buf.drain('s2').length, 0);
    });
});
//# sourceMappingURL=session-event-bus.test.js.map