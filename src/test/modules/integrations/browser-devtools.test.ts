import * as assert from 'assert';
import { toBrowserEvent } from '../../../modules/integrations/providers/browser-devtools';

suite('browser-devtools', () => {
    suite('toBrowserEvent', () => {
        test('should return event with all fields from valid input', () => {
            const result = toBrowserEvent({
                message: 'hello',
                timestamp: 1000,
                level: 'error',
                url: 'http://example.com',
                lineNumber: 42,
            });
            assert.deepStrictEqual(result, {
                message: 'hello',
                timestamp: 1000,
                level: 'error',
                url: 'http://example.com',
                lineNumber: 42,
            });
        });

        test('should accept text as alias for message', () => {
            const result = toBrowserEvent({ text: 'from text field', timestamp: 500 });
            assert.strictEqual(result?.message, 'from text field');
        });

        test('should prefer message over text', () => {
            const result = toBrowserEvent({ message: 'primary', text: 'fallback' });
            assert.strictEqual(result?.message, 'primary');
        });

        test('should accept type as alias for level', () => {
            const result = toBrowserEvent({ message: 'x', type: 'warning' });
            assert.strictEqual(result?.level, 'warning');
        });

        test('should accept time as string timestamp', () => {
            const result = toBrowserEvent({ message: 'x', time: '12:34:56.789' });
            assert.strictEqual(result?.time, '12:34:56.789');
            assert.strictEqual(result?.timestamp, undefined);
        });

        test('should return undefined for null', () => {
            assert.strictEqual(toBrowserEvent(null), undefined);
        });

        test('should return undefined for non-object', () => {
            assert.strictEqual(toBrowserEvent('string'), undefined);
            assert.strictEqual(toBrowserEvent(42), undefined);
            assert.strictEqual(toBrowserEvent(true), undefined);
        });

        test('should return undefined when no message or text', () => {
            assert.strictEqual(toBrowserEvent({ timestamp: 1000, level: 'info' }), undefined);
        });

        test('should return undefined for empty message', () => {
            assert.strictEqual(toBrowserEvent({ message: '' }), undefined);
        });

        test('should omit fields with wrong types', () => {
            const result = toBrowserEvent({
                message: 'ok',
                timestamp: 'not-a-number',
                level: 123,
                url: false,
                lineNumber: 'nope',
            });
            assert.deepStrictEqual(result, { message: 'ok' });
        });

        test('should reject NaN and Infinity timestamps', () => {
            assert.strictEqual(toBrowserEvent({ message: 'x', timestamp: NaN })?.timestamp, undefined);
            assert.strictEqual(toBrowserEvent({ message: 'x', timestamp: Infinity })?.timestamp, undefined);
        });

        test('should return event with only message when no other fields', () => {
            const result = toBrowserEvent({ message: 'minimal' });
            assert.deepStrictEqual(result, { message: 'minimal' });
        });
    });
});
