import * as assert from 'assert';
import { getSqlPatternTagsScript } from '../../ui/viewer-stack-tags/viewer-sql-pattern-tags';

suite('SQL pattern tags script (DB_05 config injection)', () => {
    test('getSqlPatternTagsScript injects clamped min count and max chips', () => {
        const s = getSqlPatternTagsScript(5, 12);
        assert.ok(s.includes('var sqlChipMinCount = 5'));
        assert.ok(s.includes('var sqlPatternMaxChips = 12'));
    });

    test('getSqlPatternTagsScript clamps out-of-range values', () => {
        const s = getSqlPatternTagsScript(0, 500);
        assert.ok(s.includes('var sqlChipMinCount = 1'));
        assert.ok(s.includes('var sqlPatternMaxChips = 100'));
    });

    test('getSqlPatternTagsScript uses defaults when args are non-finite (false positive guard)', () => {
        const s = getSqlPatternTagsScript(Number.NaN, Number.NaN);
        assert.ok(s.includes('var sqlChipMinCount = 2'));
        assert.ok(s.includes('var sqlPatternMaxChips = 20'));
    });

    test('embedded script defines applyViewerSqlPatternChipSettings for host messages', () => {
        const s = getSqlPatternTagsScript();
        assert.ok(s.includes('function applyViewerSqlPatternChipSettings'));
    });
});
