import * as assert from 'assert';
import {
    computeHealthScore,
    formatHealthScoreLine,
    formatHealthScoreBreakdown,
    getHealthScoreParams,
} from '../../../modules/misc/health-score';

suite('health-score', () => {

    suite('getHealthScoreParams', () => {
        test('should return built-in impactWeights and decayRate when extension absent', () => {
            const params = getHealthScoreParams();
            assert.strictEqual(params.decayRate, 0.3);
            assert.strictEqual(params.impactWeights.critical, 8);
            assert.strictEqual(params.impactWeights.high, 3);
            assert.strictEqual(params.impactWeights.medium, 1);
            assert.strictEqual(params.impactWeights.low, 0.25);
            assert.strictEqual(params.impactWeights.opinionated, 0.05);
        });
    });

    suite('computeHealthScore', () => {
        test('should return ~94 for 10 medium violations across 50 files', () => {
            const result = computeHealthScore({ medium: 10 }, 50);
            assert.ok(result);
            assert.strictEqual(result.score, 94);
        });

        test('should return low score for critical-heavy project', () => {
            const result = computeHealthScore({ critical: 10, high: 20 }, 50);
            assert.ok(result);
            // (10*8 + 20*3) / 50 = 2.8, exp(-0.84) ≈ 0.432 → 43
            assert.strictEqual(result.score, 43);
        });

        test('should return undefined when filesAnalyzed is 0', () => {
            assert.strictEqual(computeHealthScore({ critical: 5 }, 0), undefined);
        });

        test('should return score 100 when byImpact is empty', () => {
            const result = computeHealthScore({}, 50);
            assert.ok(result);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.weightedViolations, 0);
        });

        test('should handle all impact levels', () => {
            const result = computeHealthScore(
                { critical: 1, high: 2, medium: 5, low: 10, opinionated: 20 },
                100,
            );
            assert.ok(result);
            // (1*8 + 2*3 + 5*1 + 10*0.25 + 20*0.05) / 100 = 0.225
            // exp(-0.0675) ≈ 0.9347 → 93
            assert.strictEqual(result.score, 93);
        });

        test('should ignore non-numeric values in byImpact', () => {
            const byImpact: Record<string, number> = { critical: 5 };
            // Simulate bad data by casting
            (byImpact as Record<string, unknown>)['high'] = 'bad';
            const result = computeHealthScore(byImpact, 10);
            assert.ok(result);
            // 5*8 / 10 = 4.0, exp(-1.2) ≈ 0.301 → 30
            assert.strictEqual(result.score, 30);
        });

        test('should match saropa_lints constants', () => {
            // Cross-check: same inputs must produce same score as healthScore.ts.
            // 3 critical + 12 high + 45 medium + 72 low + 10 opinionated, 247 files
            // weighted = 3*8 + 12*3 + 45*1 + 72*0.25 + 10*0.05 = 24+36+45+18+0.5 = 123.5
            // density = 123.5 / 247 ≈ 0.5
            // score = round(100 * exp(-0.15)) = round(86.07) = 86
            const result = computeHealthScore(
                { critical: 3, high: 12, medium: 45, low: 72, opinionated: 10 },
                247,
            );
            assert.ok(result);
            assert.strictEqual(result.score, 86);
        });

        test('should use explicit params when provided', () => {
            const customParams = {
                impactWeights: { critical: 10, high: 5, medium: 1, low: 0.1, opinionated: 0.01 },
                decayRate: 0.2,
            };
            const result = computeHealthScore({ critical: 2, high: 4 }, 100, customParams);
            assert.ok(result);
            // weighted = 2*10 + 4*5 = 40, density = 0.4, exp(-0.08) ≈ 0.923 → 92
            assert.strictEqual(result.score, 92);
        });
    });

    suite('formatHealthScoreLine', () => {
        test('should produce correct markdown with tier and count', () => {
            const line = formatHealthScoreLine(
                { medium: 10 }, 50, 'comprehensive', 10,
            );
            assert.strictEqual(
                line,
                '**Project health: 94/100** (comprehensive tier, 10 violations)',
            );
        });

        test('should return undefined when filesAnalyzed is 0', () => {
            assert.strictEqual(
                formatHealthScoreLine({}, 0, 'comprehensive', 0),
                undefined,
            );
        });
    });

    suite('formatHealthScoreBreakdown', () => {
        test('should list only non-zero impact levels', () => {
            const result = formatHealthScoreBreakdown(
                { critical: 3, high: 0, medium: 12, low: 0, opinionated: 5 },
            );
            assert.strictEqual(result, '3 critical, 12 medium, 5 opinionated');
        });

        test('should return undefined when all counts are zero', () => {
            assert.strictEqual(
                formatHealthScoreBreakdown({ critical: 0, high: 0 }),
                undefined,
            );
        });

        test('should return undefined for empty byImpact', () => {
            assert.strictEqual(formatHealthScoreBreakdown({}), undefined);
        });
    });
});
