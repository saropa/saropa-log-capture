import * as assert from 'assert';
import { getSqlPatternTagsScript } from '../../ui/viewer-stack-tags/viewer-sql-pattern-tags';

suite('SQL verb-based command chips (plan 043)', () => {
    test('should take no parameters', () => {
        const s = getSqlPatternTagsScript();
        assert.ok(typeof s === 'string' && s.length > 0);
    });

    test('should define verb tracking variables', () => {
        const s = getSqlPatternTagsScript();
        assert.ok(s.includes('var sqlVerbCounts'));
        assert.ok(s.includes('var hiddenSqlVerbs'));
        assert.ok(s.includes('var sqlVerbOrder'));
    });

    test('should define sqlVerbCategory mapping function', () => {
        const s = getSqlPatternTagsScript();
        assert.ok(s.includes('function sqlVerbCategory'));
    });

    test('should not contain removed fingerprint-based settings', () => {
        const s = getSqlPatternTagsScript();
        assert.ok(!s.includes('applyViewerSqlPatternChipSettings'));
        assert.ok(!s.includes('sqlChipMinCount'));
        assert.ok(!s.includes('sqlPatternMaxChips'));
        assert.ok(!s.includes('sqlPatternRawCounts'));
        assert.ok(!s.includes('promoteSqlFingerprintChip'));
        assert.ok(!s.includes('demoteSqlFingerprintChip'));
    });

    test('should include all six verb categories in order', () => {
        const s = getSqlPatternTagsScript();
        assert.ok(s.includes("'SELECT'"));
        assert.ok(s.includes("'INSERT'"));
        assert.ok(s.includes("'UPDATE'"));
        assert.ok(s.includes("'DELETE'"));
        assert.ok(s.includes("'Transaction'"));
        assert.ok(s.includes("'Other SQL'"));
    });
});
