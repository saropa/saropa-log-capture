import * as assert from 'assert';
import { extractTraceId, extractTraceHits, traceBackendUrl } from '../../../modules/integrations/providers/otel-trace-parse';

suite('otel-trace-parse', () => {
    suite('extractTraceId', () => {
        test('should extract a W3C traceparent trace id', () => {
            const id = extractTraceId('traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
            assert.strictEqual(id, '4bf92f3577b34da6a3ce929d0e0e4736');
        });

        test('should extract a trace_id=… key/value form', () => {
            assert.strictEqual(extractTraceId('level=info trace_id=abcdef0123456789 msg=x'), 'abcdef0123456789');
        });

        test('should extract a quoted JSON traceId and lowercase it', () => {
            assert.strictEqual(extractTraceId('{"traceId":"ABCDEF0123456789"}'), 'abcdef0123456789');
        });

        test('should return undefined when no trace id is present', () => {
            assert.strictEqual(extractTraceId('plain line, no trace here'), undefined);
        });

        test('should prefer a user-supplied pattern', () => {
            assert.strictEqual(extractTraceId('myTrace<XYZ123>', /myTrace<([^>]+)>/), 'xyz123');
        });
    });

    suite('extractTraceHits', () => {
        test('should group distinct trace ids with their line numbers', () => {
            const lines = [
                'trace_id=aaaaaaaaaaaaaaaa start',
                'noise',
                'trace_id=aaaaaaaaaaaaaaaa again',
                'trace_id=bbbbbbbbbbbbbbbb other',
            ];
            const hits = extractTraceHits(lines, '', 100);
            assert.strictEqual(hits.length, 2);
            assert.deepStrictEqual(hits.find((h) => h.traceId === 'aaaaaaaaaaaaaaaa')?.lines, [0, 2]);
        });

        test('should cap the number of distinct traces', () => {
            const lines = ['trace_id=aaaaaaaaaaaaaaaa', 'trace_id=bbbbbbbbbbbbbbbb', 'trace_id=cccccccccccccccc'];
            assert.strictEqual(extractTraceHits(lines, '', 2).length, 2);
        });
    });

    suite('traceBackendUrl', () => {
        test('should substitute the {traceId} placeholder', () => {
            assert.strictEqual(traceBackendUrl('https://jaeger/trace/{traceId}', 'abc'), 'https://jaeger/trace/abc');
        });

        test('should return undefined without a placeholder or template', () => {
            assert.strictEqual(traceBackendUrl('https://jaeger/trace/', 'abc'), undefined);
            assert.strictEqual(traceBackendUrl('', 'abc'), undefined);
        });
    });
});
