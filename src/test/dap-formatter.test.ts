import * as assert from 'assert';
import { formatDapMessage, DapMessage } from '../modules/dap-formatter';

const ts = new Date('2025-06-15T14:30:45.123Z');

suite('formatDapMessage', () => {

    test('should format outgoing request', () => {
        const msg: DapMessage = { type: 'request', command: 'initialize', arguments: { adapterID: 'node' } };
        const result = formatDapMessage(msg, 'outgoing', ts);
        assert.ok(result.includes('[dap->]'));
        assert.ok(result.includes('initialize'));
        assert.ok(result.includes('"adapterID":"node"'));
    });

    test('should format incoming response', () => {
        const msg: DapMessage = { type: 'response', command: 'initialize', success: true, body: { supportsConfigurationDoneRequest: true } };
        const result = formatDapMessage(msg, 'incoming', ts);
        assert.ok(result.includes('[dap<-]'));
        assert.ok(result.includes('initialize'));
    });

    test('should format event with dap:event prefix', () => {
        const msg: DapMessage = { type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 1 } };
        const result = formatDapMessage(msg, 'incoming', ts);
        assert.ok(result.includes('[dap:event]'));
        assert.ok(result.includes('stopped'));
        assert.ok(result.includes('"reason":"breakpoint"'));
    });

    test('should handle message with no body or arguments', () => {
        const msg: DapMessage = { type: 'request', command: 'disconnect' };
        const result = formatDapMessage(msg, 'outgoing', ts);
        assert.ok(result.includes('[dap->]'));
        assert.ok(result.includes('disconnect'));
        assert.ok(!result.includes('undefined'));
    });

    test('should fall back to "unknown" when no command or event', () => {
        const msg: DapMessage = { type: 'request' };
        const result = formatDapMessage(msg, 'outgoing', ts);
        assert.ok(result.includes('unknown'));
    });

    test('should truncate large payloads', () => {
        const largeBody = { data: 'x'.repeat(600) };
        const msg: DapMessage = { type: 'response', command: 'variables', body: largeBody };
        const result = formatDapMessage(msg, 'incoming', ts);
        assert.ok(result.includes('...'));
        assert.ok(result.length < 600);
    });

    test('should include timestamp in output', () => {
        const msg: DapMessage = { type: 'event', event: 'initialized' };
        const result = formatDapMessage(msg, 'incoming', ts);
        assert.ok(result.includes('.123]'));
    });
});
