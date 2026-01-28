import * as assert from 'assert';
import { extractDuration } from '../modules/duration-extractor';

suite('DurationExtractor', () => {

    test('should extract milliseconds from "500ms"', () => {
        assert.strictEqual(extractDuration('completed in 500ms'), 500);
    });

    test('should extract milliseconds from "1.5ms"', () => {
        assert.strictEqual(extractDuration('request took 1.5ms'), 1.5);
    });

    test('should extract seconds and convert to ms', () => {
        assert.strictEqual(extractDuration('finished in 2.5s'), 2500);
    });

    test('should extract "seconds" word form', () => {
        assert.strictEqual(extractDuration('ran for 3 seconds'), 3000);
    });

    test('should extract "took Ns" pattern', () => {
        assert.strictEqual(extractDuration('took 1.2s to complete'), 1200);
    });

    test('should extract "elapsed: Nms" pattern', () => {
        assert.strictEqual(extractDuration('elapsed: 750ms'), 750);
    });

    test('should extract "duration=N" bare number as ms', () => {
        assert.strictEqual(extractDuration('duration=3000'), 3000);
    });

    test('should return undefined for no match', () => {
        assert.strictEqual(extractDuration('no timing info here'), undefined);
    });

    test('should return undefined for empty string', () => {
        assert.strictEqual(extractDuration(''), undefined);
    });

    test('should handle "(1234ms)" in parentheses', () => {
        assert.strictEqual(extractDuration('build complete (1234ms)'), 1234);
    });
});
