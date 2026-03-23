/**
 * String-level checks: host → webview messages for root-cause explain trigger stay wired.
 */
import * as assert from "node:assert";
import { getViewerScriptMessageHandler } from "../../ui/viewer/viewer-script-messages";

suite("viewer-script-messages root-cause host triggers", () => {
  test("includes triggerExplainRootCauseHypotheses case delegating to embed helper", () => {
    const handler = getViewerScriptMessageHandler();
    assert.ok(handler.includes("case 'triggerExplainRootCauseHypotheses'"));
    assert.ok(handler.includes("runTriggerExplainRootCauseHypothesesFromHost"));
  });

  test("setRootCauseHintHostFields still uses hasOwnProperty partial updates", () => {
    const handler = getViewerScriptMessageHandler();
    assert.ok(handler.includes("case 'setRootCauseHintHostFields'"));
    assert.ok(handler.includes("hasOwnProperty.call(msg, 'driftAdvisorSummary')"));
    assert.ok(handler.includes("hasOwnProperty.call(msg, 'sessionDiffSummary')"));
  });
});
