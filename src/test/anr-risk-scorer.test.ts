import * as assert from 'assert';
import { scanAnrRisk } from '../modules/anr-risk-scorer';

suite('AnrRiskScorer', () => {

    test('should return score 0 for clean session', () => {
        const result = scanAnrRisk('hello world\nstarting server\nall good');
        assert.strictEqual(result.score, 0);
        assert.strictEqual(result.level, 'low');
        assert.strictEqual(result.signals.length, 0);
    });

    test('should return score 0 for empty input', () => {
        const result = scanAnrRisk('');
        assert.strictEqual(result.score, 0);
        assert.strictEqual(result.level, 'low');
    });

    test('should detect ANR keyword and score medium', () => {
        const result = scanAnrRisk('Application Not Responding in com.example');
        assert.strictEqual(result.score, 25);
        assert.strictEqual(result.level, 'medium');
        assert.strictEqual(result.signals.length, 1);
        assert.ok(result.signals[0].includes('ANR keyword'));
    });

    test('should detect multiple ANR keywords with cap', () => {
        const lines = Array.from({ length: 5 }, () => 'ANR in com.example.app').join('\n');
        const result = scanAnrRisk(lines);
        // 5 * 25 = 125, capped at 50 for ANR keyword, then capped at 100 total
        assert.strictEqual(result.score, 50);
        assert.strictEqual(result.level, 'medium');
    });

    test('should detect choreographer warnings', () => {
        const result = scanAnrRisk('I/Choreographer: Skipped 30 frames');
        assert.ok(result.score > 0);
        assert.ok(result.signals.some(s => s.includes('Choreographer')));
    });

    test('should detect GC pauses', () => {
        const result = scanAnrRisk('gc pause 200ms\ngc pause 150ms\ngc pause 100ms');
        assert.ok(result.score >= 24); // 3 * 8 = 24
        assert.ok(result.signals.some(s => s.includes('GC pause')));
    });

    test('should detect dropped frames', () => {
        const result = scanAnrRisk('Skipped 47 frames!\nskipped 12 frames');
        assert.ok(result.score >= 6); // 2 * 3 = 6
        assert.ok(result.signals.some(s => s.includes('Dropped frame')));
    });

    test('should detect jank indicators', () => {
        const result = scanAnrRisk('Doing too much work on the main thread');
        assert.ok(result.score >= 10);
        assert.ok(result.signals.some(s => s.includes('Jank')));
    });

    test('should compute composite score from multiple signal types', () => {
        const body = [
            'I/Choreographer: Skipped 30 frames',
            'I/Choreographer: Skipped 12 frames',
            'gc pause 200ms',
            'Application Not Responding',
            'Doing too much work on the main thread',
        ].join('\n');
        const result = scanAnrRisk(body);
        // choreographer: 2*5=10, gcPause: 1*8=8, anr: 1*25=25, jank: 1*10=10 = 53
        assert.strictEqual(result.level, 'high');
        assert.ok(result.signals.length >= 4);
    });

    test('should cap total score at 100', () => {
        const lines = [
            ...Array.from({ length: 10 }, () => 'ANR in com.example'),
            ...Array.from({ length: 10 }, () => 'gc pause 100ms'),
            ...Array.from({ length: 10 }, () => 'I/Choreographer: Skipped 30 frames'),
            ...Array.from({ length: 10 }, () => 'jank detected'),
        ].join('\n');
        const result = scanAnrRisk(lines);
        assert.strictEqual(result.score, 100);
        assert.strictEqual(result.level, 'high');
    });

    test('should be case-insensitive', () => {
        const result = scanAnrRisk('CHOREOGRAPHER warning\nGC PAUSE detected');
        assert.ok(result.score > 0);
        assert.ok(result.signals.length >= 2);
    });

    test('should handle input dispatching timed out pattern', () => {
        const result = scanAnrRisk('Input dispatching timed out (Waiting because no window)');
        assert.strictEqual(result.score, 25);
        assert.ok(result.signals.some(s => s.includes('ANR keyword')));
    });
});
