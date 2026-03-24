import * as assert from "node:assert";
import { describe, it } from "node:test";
import { mergeDriftAdvisorDbPanelPayload } from "../../../modules/integrations/drift-advisor-db-panel-payload";

describe("mergeDriftAdvisorDbPanelPayload", () => {
  it("returns null when both absent", () => {
    assert.strictEqual(mergeDriftAdvisorDbPanelPayload(undefined, null), null);
  });

  it("meta alone is returned", () => {
    const m = mergeDriftAdvisorDbPanelPayload({ performance: { totalQueries: 3 } }, null) as Record<
      string,
      unknown
    >;
    assert.strictEqual((m.performance as { totalQueries: number }).totalQueries, 3);
  });

  it("sidecar fills performance when meta omits it", () => {
    const m = mergeDriftAdvisorDbPanelPayload(
      { baseUrl: "http://x" },
      { performance: { slowCount: 2 }, baseUrl: "ignored" },
    ) as Record<string, unknown>;
    assert.strictEqual(m.baseUrl, "http://x");
    assert.strictEqual((m.performance as { slowCount: number }).slowCount, 2);
  });
});
