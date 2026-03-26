/**
 * Unit tests for integration-context popover empty-state gating (database line escape hatch).
 */
import * as assert from 'assert';
import { shouldPostNoIntegrationDataError } from '../../ui/shared/handlers/context-handlers';

suite('context-handlers integration popover gate', () => {
    test('posts noIntegrationData only when window data, Drift meta, and DB line are all absent', () => {
        assert.strictEqual(
            shouldPostNoIntegrationDataError({
                hasContextWindowData: false,
                hasDriftAdvisorIntegrationMeta: false,
                hasDatabaseLine: false,
            }),
            true,
        );
    });

    test('does not post error when line is database-tagged (before: would wrongly require window data)', () => {
        assert.strictEqual(
            shouldPostNoIntegrationDataError({
                hasContextWindowData: false,
                hasDriftAdvisorIntegrationMeta: false,
                hasDatabaseLine: true,
            }),
            false,
        );
    });

    test('does not post error when Drift Advisor session meta exists', () => {
        assert.strictEqual(
            shouldPostNoIntegrationDataError({
                hasContextWindowData: false,
                hasDriftAdvisorIntegrationMeta: true,
                hasDatabaseLine: false,
            }),
            false,
        );
    });

    test('does not post error when context window has any integration data', () => {
        assert.strictEqual(
            shouldPostNoIntegrationDataError({
                hasContextWindowData: true,
                hasDriftAdvisorIntegrationMeta: false,
                hasDatabaseLine: false,
            }),
            false,
        );
    });

    test('does not post error when security meta exists', () => {
        assert.strictEqual(
            shouldPostNoIntegrationDataError({
                hasContextWindowData: false,
                hasDriftAdvisorIntegrationMeta: false,
                hasDatabaseLine: false,
                hasSecurityMeta: true,
            }),
            false,
        );
    });

    test('does not post error when all three signals are present (after: non-empty popover)', () => {
        assert.strictEqual(
            shouldPostNoIntegrationDataError({
                hasContextWindowData: true,
                hasDriftAdvisorIntegrationMeta: true,
                hasDatabaseLine: true,
            }),
            false,
        );
    });
});
