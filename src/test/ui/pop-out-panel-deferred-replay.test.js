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
const assert = __importStar(require("node:assert"));
const pop_out_panel_deferred_replay_1 = require("../../ui/viewer-panels/pop-out-panel-deferred-replay");
suite('pop-out panel deferred replay (hydration)', () => {
    test('without file snapshot replays all deferred lines (sidebar had no current log URI)', () => {
        const deferred = [{ lineCount: 1 }, { lineCount: 2 }, { lineCount: 3 }];
        const out = (0, pop_out_panel_deferred_replay_1.filterDeferredLinesAfterSnapshot)(deferred, undefined);
        assert.deepStrictEqual(out, deferred);
        assert.notStrictEqual(out, deferred, 'expected a shallow copy');
    });
    test('with snapshot replays only lines strictly after loaded content length', () => {
        const deferred = [
            { lineCount: 8, id: 'a' },
            { lineCount: 9, id: 'b' },
            { lineCount: 10, id: 'c' },
            { lineCount: 11, id: 'd' },
        ];
        const out = (0, pop_out_panel_deferred_replay_1.filterDeferredLinesAfterSnapshot)(deferred, 10);
        assert.deepStrictEqual(out.map((x) => x.id), ['d'], 'lines 8–10 are assumed already in the file read; 11 is new');
    });
    test('empty deferred stays empty', () => {
        assert.deepStrictEqual((0, pop_out_panel_deferred_replay_1.filterDeferredLinesAfterSnapshot)([], 5), []);
    });
});
//# sourceMappingURL=pop-out-panel-deferred-replay.test.js.map