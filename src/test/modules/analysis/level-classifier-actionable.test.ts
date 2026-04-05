import * as assert from 'assert';
import { isActionableLevel } from '../../../modules/analysis/level-classifier';

suite('isActionableLevel', () => {

    test('should return true for error', () => {
        assert.strictEqual(isActionableLevel('error'), true);
    });

    test('should return true for warning', () => {
        assert.strictEqual(isActionableLevel('warning'), true);
    });

    test('should return true for performance', () => {
        assert.strictEqual(isActionableLevel('performance'), true);
    });

    test('should return true for todo', () => {
        assert.strictEqual(isActionableLevel('todo'), true);
    });

    test('should return false for info', () => {
        assert.strictEqual(isActionableLevel('info'), false);
    });

    test('should return false for debug', () => {
        assert.strictEqual(isActionableLevel('debug'), false);
    });

    test('should return false for notice', () => {
        assert.strictEqual(isActionableLevel('notice'), false);
    });

    test('should return false for database', () => {
        assert.strictEqual(isActionableLevel('database'), false);
    });
});
