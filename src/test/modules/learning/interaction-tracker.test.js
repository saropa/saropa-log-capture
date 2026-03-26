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
const interaction_tracker_1 = require("../../../modules/learning/interaction-tracker");
suite("interaction-tracker", () => {
    test("flush drains items appended while a save is in flight", async () => {
        const batches = [];
        let finishSave;
        const pendingSave = new Promise((resolve) => {
            finishSave = resolve;
        });
        const store = {
            async saveBatch(batch) {
                batches.push(batch);
                await pendingSave;
            },
        };
        const tracker = new interaction_tracker_1.InteractionTracker({
            store: store,
            getSessionId: () => "sess-a",
            getMaxLineLength: () => 2000,
            isEnabled: () => true,
        });
        tracker.track({ type: "dismiss", lineText: "first line", lineLevel: "log" });
        const flush1 = tracker.flush();
        tracker.track({ type: "dismiss", lineText: "second line during save", lineLevel: "log" });
        finishSave();
        await flush1;
        await tracker.flush();
        assert.strictEqual(batches.length, 2, "second batch must not be dropped");
        assert.ok(batches[0].interactions.some((i) => i.lineText.includes("first")));
        assert.ok(batches[1].interactions.some((i) => i.lineText.includes("second")));
    });
});
//# sourceMappingURL=interaction-tracker.test.js.map