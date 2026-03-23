import * as assert from "assert";
import { InteractionTracker } from "../../../modules/learning/interaction-tracker";
import type { LearningStore } from "../../../modules/learning/learning-store";
import type { InteractionBatch } from "../../../modules/learning/interaction-types";

suite("interaction-tracker", () => {
    test("flush drains items appended while a save is in flight", async () => {
        const batches: InteractionBatch[] = [];
        let finishSave!: () => void;
        const pendingSave = new Promise<void>((resolve) => {
            finishSave = resolve;
        });
        const store: Pick<LearningStore, "saveBatch"> = {
            async saveBatch(batch: InteractionBatch): Promise<void> {
                batches.push(batch);
                await pendingSave;
            },
        };
        const tracker = new InteractionTracker({
            store: store as LearningStore,
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
