/**
 * Tests for IntegrationRegistry.runOnSessionStartStreaming() and
 * dispatchProcessId() — the Phase 2 streaming provider pattern.
 */

import * as assert from 'assert';
import { IntegrationRegistry } from '../../../modules/integrations/registry';
import type { IntegrationProvider, IntegrationContext, StreamingWriter } from '../../../modules/integrations/types';

/** Minimal stub context — only the fields the registry actually reads. */
function stubContext(): IntegrationContext {
    return {
        outputChannel: { appendLine: () => { /* no-op */ } },
    } as unknown as IntegrationContext;
}

function stubWriter(): StreamingWriter & { lines: { text: string; category: string }[] } {
    const lines: { text: string; category: string }[] = [];
    return {
        lines,
        writeLine(text: string, category: string) {
            lines.push({ text, category });
        },
    };
}

suite('IntegrationRegistry streaming', () => {
    let registry: IntegrationRegistry;

    setup(() => {
        registry = new IntegrationRegistry();
    });

    test('should call onSessionStartStreaming for enabled providers', () => {
        let called = false;
        const provider: IntegrationProvider = {
            id: 'testStreamer',
            isEnabled: () => true,
            onSessionStartStreaming(_ctx, _writer) { called = true; },
        };
        registry.register(provider);
        registry.runOnSessionStartStreaming(stubContext(), stubWriter());
        assert.strictEqual(called, true);
    });

    test('should skip onSessionStartStreaming for disabled providers', () => {
        let called = false;
        const provider: IntegrationProvider = {
            id: 'disabledStreamer',
            isEnabled: () => false,
            onSessionStartStreaming(_ctx, _writer) { called = true; },
        };
        registry.register(provider);
        registry.runOnSessionStartStreaming(stubContext(), stubWriter());
        assert.strictEqual(called, false);
    });

    test('should skip providers without onSessionStartStreaming', () => {
        // Provider has no streaming method — should not throw
        const provider: IntegrationProvider = {
            id: 'nonStreamer',
            isEnabled: () => true,
        };
        registry.register(provider);
        registry.runOnSessionStartStreaming(stubContext(), stubWriter());
        assert.ok(true, 'No error thrown');
    });

    test('should pass writer to streaming provider', () => {
        const writer = stubWriter();
        const provider: IntegrationProvider = {
            id: 'writerTest',
            isEnabled: () => true,
            onSessionStartStreaming(_ctx, w) {
                w.writeLine('hello', 'test');
            },
        };
        registry.register(provider);
        registry.runOnSessionStartStreaming(stubContext(), writer);
        assert.strictEqual(writer.lines.length, 1);
        assert.strictEqual(writer.lines[0].text, 'hello');
        assert.strictEqual(writer.lines[0].category, 'test');
    });

    test('should catch and log errors from onSessionStartStreaming', () => {
        const logged: string[] = [];
        const ctx = {
            outputChannel: { appendLine: (msg: string) => logged.push(msg) },
        } as unknown as IntegrationContext;
        const provider: IntegrationProvider = {
            id: 'errorStreamer',
            isEnabled: () => true,
            onSessionStartStreaming() { throw new Error('boom'); },
        };
        registry.register(provider);
        // Should not throw — error is caught and logged
        registry.runOnSessionStartStreaming(ctx, stubWriter());
        assert.ok(logged.some(m => m.includes('errorStreamer') && m.includes('boom')));
    });

    test('should catch and log errors from isEnabled in streaming path', () => {
        const logged: string[] = [];
        const ctx = {
            outputChannel: { appendLine: (msg: string) => logged.push(msg) },
        } as unknown as IntegrationContext;
        const provider: IntegrationProvider = {
            id: 'badEnabled',
            isEnabled() { throw new Error('check failed'); },
            onSessionStartStreaming() { /* unreachable */ },
        };
        registry.register(provider);
        registry.runOnSessionStartStreaming(ctx, stubWriter());
        assert.ok(logged.some(m => m.includes('badEnabled') && m.includes('check failed')));
    });

    suite('dispatchProcessId', () => {
        test('should forward PID to providers with onProcessId', () => {
            let receivedPid: number | undefined;
            const provider: IntegrationProvider = {
                id: 'pidListener',
                isEnabled: () => true,
                onProcessId(pid) { receivedPid = pid; },
            };
            registry.register(provider);
            registry.dispatchProcessId(12345);
            assert.strictEqual(receivedPid, 12345);
        });

        test('should skip providers without onProcessId', () => {
            const provider: IntegrationProvider = {
                id: 'noPid',
                isEnabled: () => true,
            };
            registry.register(provider);
            // Should not throw
            registry.dispatchProcessId(99);
            assert.ok(true, 'No error thrown');
        });

        test('should forward PID to multiple providers', () => {
            const pids: number[] = [];
            const a: IntegrationProvider = {
                id: 'a',
                isEnabled: () => true,
                onProcessId(pid) { pids.push(pid); },
            };
            const b: IntegrationProvider = {
                id: 'b',
                isEnabled: () => true,
                onProcessId(pid) { pids.push(pid * 10); },
            };
            registry.register(a);
            registry.register(b);
            registry.dispatchProcessId(7);
            assert.deepStrictEqual(pids, [7, 70]);
        });

        test('should swallow errors from onProcessId', () => {
            const provider: IntegrationProvider = {
                id: 'crashPid',
                isEnabled: () => true,
                onProcessId() { throw new Error('oops'); },
            };
            registry.register(provider);
            // Should not throw
            registry.dispatchProcessId(1);
            assert.ok(true, 'Error swallowed');
        });
    });
});
