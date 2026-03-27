import * as assert from 'node:assert';
import {
    EXPLAIN_WITH_AI_ADAPTER_ID,
    mergeIntegrationAdaptersForWebview,
    stripUiOnlyIntegrationAdapterIds,
} from '../../../modules/integrations/integration-adapter-constants';

suite('integration-adapter-constants', () => {
    test('stripUiOnlyIntegrationAdapterIds removes explainWithAi only', () => {
        assert.deepStrictEqual(stripUiOnlyIntegrationAdapterIds(['packages', 'git']), ['packages', 'git']);
        assert.deepStrictEqual(
            stripUiOnlyIntegrationAdapterIds(['packages', EXPLAIN_WITH_AI_ADAPTER_ID, 'git']),
            ['packages', 'git'],
        );
        assert.deepStrictEqual(stripUiOnlyIntegrationAdapterIds([EXPLAIN_WITH_AI_ADAPTER_ID]), []);
    });

    test('mergeIntegrationAdaptersForWebview appends explainWithAi when AI enabled', () => {
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], false),
            ['packages'],
        );
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], true),
            ['packages', EXPLAIN_WITH_AI_ADAPTER_ID],
        );
    });

    test('mergeIntegrationAdaptersForWebview strips stray explainWithAi from session list before merge', () => {
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages', EXPLAIN_WITH_AI_ADAPTER_ID], true),
            ['packages', EXPLAIN_WITH_AI_ADAPTER_ID],
        );
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages', EXPLAIN_WITH_AI_ADAPTER_ID], false),
            ['packages'],
        );
    });
});
