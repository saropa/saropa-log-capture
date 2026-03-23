/**
 * Drift Advisor → root-cause hint summary extraction.
 */
import * as assert from "node:assert";
import { DRIFT_ADVISOR_META_KEY } from "../../../modules/integrations/drift-advisor-constants";
import { rootCauseDriftSummaryFromSessionIntegrations } from "../../../modules/root-cause-hints/root-cause-hint-drift-meta";

suite("root-cause-hint-drift-meta", () => {
  test("returns undefined when integrations missing or empty", () => {
    assert.strictEqual(rootCauseDriftSummaryFromSessionIntegrations(undefined), undefined);
    assert.strictEqual(rootCauseDriftSummaryFromSessionIntegrations(null), undefined);
    assert.strictEqual(rootCauseDriftSummaryFromSessionIntegrations({}), undefined);
  });

  test("maps issuesSummary.count and top byCode rule", () => {
    const integrations: Record<string, unknown> = {
      [DRIFT_ADVISOR_META_KEY]: {
        issuesSummary: {
          count: 5,
          byCode: { rule_a: 2, rule_b: 3 },
          bySeverity: { error: 1 },
        },
      },
    };
    const s = rootCauseDriftSummaryFromSessionIntegrations(integrations);
    assert.deepStrictEqual(s, { issueCount: 5, topRuleId: "rule_b" });
  });

  test("returns undefined when issue count is zero", () => {
    const integrations: Record<string, unknown> = {
      [DRIFT_ADVISOR_META_KEY]: {
        issuesSummary: { count: 0, byCode: { x: 1 } },
      },
    };
    assert.strictEqual(rootCauseDriftSummaryFromSessionIntegrations(integrations), undefined);
  });
});
