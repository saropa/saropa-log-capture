import * as assert from 'node:assert';
import { getContextMenuBlockCopyScript } from '../../ui/viewer-context-menu/viewer-context-menu-block-copy';

/**
 * Behavioral tests for the grouped-block copy actions (Copy Error/Warning, Copy Error/Warning
 * JSON):
 *  - the line-number regression where both paths reported the webview's raw `allLines` array
 *    index instead of `sourceLineNo` (the header-aware FILE line number), undercounting by the
 *    session header's length on any real log;
 *  - the `copyContextLines` surrounding-context expansion added alongside that fix, reusing the
 *    setting `copy-with-source` already honors.
 *
 * The helpers live in a `/* javascript *\/`-tagged template literal (concatenated into the shared
 * webview scope at runtime), so — mirroring viewer-copy-json.test.ts's pattern — the generated
 * source is eval'd inside a `Function` with its free variables (`allLines`, `vscodeApi`, etc.)
 * bound as parameters, and the internal functions are exercised directly rather than checked for
 * mere string presence.
 */
suite('Copy Error/Warning block: sourceLineNo + context-line expansion', () => {

    function buildHelpers(
        allLines: Record<string, unknown>[],
        computeIncidentLineRange: (lineIdx: number) => { lo: number; hi: number } | null,
        copyContextLines = 0,
    ): {
        copyIncidentBlockAsJson: (inc: { lo: number; hi: number }, lineData: Record<string, unknown>) => void;
        handleBlockCopyAction: (action: string, lineIdx: number, lineData: Record<string, unknown>) => boolean;
        postMessages: Record<string, unknown>[];
        toasts: string[];
    } {
        const postMessages: Record<string, unknown>[] = [];
        const toasts: string[] = [];
        const vscodeApi = { postMessage: (m: Record<string, unknown>): void => { postMessages.push(m); } };
        const stripTags = (s: string): string => s;
        const showCopyToast = (msg: string): void => { toasts.push(msg); };
        // Stubbed to echo its inputs so the test can assert exactly which line numbers were used,
        // without depending on the real formatter's wording.
        const formatCopyToastMessage = (kind: string, lo: number, hi: number, len: number): string =>
            `${kind}:${lo}-${hi}:${len}`;

        const factory = new Function(
            'allLines', 'stripTags', 'vscodeApi', 'showCopyToast', 'formatCopyToastMessage', 'sessionInfoData',
            'computeIncidentLineRange', 'computeDbTimestampBurstLineRange', 'computeAsciiArtBlockLineRange',
            'copyContextLines',
            getContextMenuBlockCopyScript()
            + '\nreturn { copyIncidentBlockAsJson: copyIncidentBlockAsJson, handleBlockCopyAction: handleBlockCopyAction };',
        );
        const helpers = factory(
            allLines, stripTags, vscodeApi, showCopyToast, formatCopyToastMessage, {},
            computeIncidentLineRange, (): null => null, (): null => null,
            copyContextLines,
        ) as { copyIncidentBlockAsJson: (inc: { lo: number; hi: number }, lineData: Record<string, unknown>) => void;
            handleBlockCopyAction: (action: string, lineIdx: number, lineData: Record<string, unknown>) => boolean };
        return { ...helpers, postMessages, toasts };
    }

    suite('copyIncidentBlockAsJson — sourceLineNo', () => {
        test('uses sourceLineNo, not the array index, when present', () => {
            const allLines = [
                { html: 'a' }, { html: 'b' },
                { html: 'c', sourceLineNo: 105 }, { html: 'd' }, { html: 'e', sourceLineNo: 107 },
            ];
            const { copyIncidentBlockAsJson, postMessages } = buildHelpers(allLines, () => null);
            copyIncidentBlockAsJson({ lo: 2, hi: 4 }, {});
            assert.strictEqual(postMessages.length, 1);
            // Array-index-based numbers would have been lo+1=3, hi+1=5 — the bug this test pins.
            assert.strictEqual(postMessages[0].lineStart, 105);
            assert.strictEqual(postMessages[0].lineEnd, 107);
        });

        test('falls back to the array index when sourceLineNo is absent', () => {
            const allLines = [{ html: 'a' }, { html: 'b' }, { html: 'c' }];
            const { copyIncidentBlockAsJson, postMessages } = buildHelpers(allLines, () => null);
            copyIncidentBlockAsJson({ lo: 0, hi: 2 }, {});
            assert.strictEqual(postMessages[0].lineStart, 1);
            assert.strictEqual(postMessages[0].lineEnd, 3);
        });

        test('a mixed range (one endpoint has sourceLineNo, the other does not) resolves each endpoint independently', () => {
            const allLines = [{ html: 'a', sourceLineNo: 50 }, { html: 'b' }];
            const { copyIncidentBlockAsJson, postMessages } = buildHelpers(allLines, () => null);
            copyIncidentBlockAsJson({ lo: 0, hi: 1 }, {});
            assert.strictEqual(postMessages[0].lineStart, 50);
            assert.strictEqual(postMessages[0].lineEnd, 2); // index fallback: hi + 1
        });
    });

    suite('copy-error-warning-block — sourceLineNo', () => {
        test('the "Copied lines" toast uses sourceLineNo, not the array index (no context expansion)', () => {
            const allLines = [
                { html: 'a' }, { html: 'b', sourceLineNo: 200 }, { html: 'c' }, { html: 'd', sourceLineNo: 203 },
            ];
            const { handleBlockCopyAction, toasts } = buildHelpers(allLines, () => ({ lo: 1, hi: 3 }), 0);
            handleBlockCopyAction('copy-error-warning-block', 1, {});
            assert.strictEqual(toasts.length, 1);
            // Array-index-based numbers would have been 2-4 — the bug this test pins.
            // Text length: joined 'b'+'\n'+'c'+'\n'+'d' = 5 characters.
            assert.strictEqual(toasts[0], 'lines:200-203:5');
        });
    });

    suite('copyContextLines expansion', () => {
        test('copy-error-warning-block includes N lines of context on each side', () => {
            const allLines = [
                { html: 'ctx-2' }, { html: 'ctx-1' }, { html: 'ERR-lo', sourceLineNo: 10 },
                { html: 'ERR-hi', sourceLineNo: 11 }, { html: 'ctx+1' }, { html: 'ctx+2' },
            ];
            // Incident is index [2, 3]; with copyContextLines=2 the copy should span [0, 5].
            const { handleBlockCopyAction, toasts } = buildHelpers(allLines, () => ({ lo: 2, hi: 3 }), 2);
            handleBlockCopyAction('copy-error-warning-block', 2, {});
            assert.strictEqual(toasts.length, 1, 'expanded range must still be non-empty and toast');
            assert.ok(toasts[0].startsWith('lines:1-6:'), `expected file lines 1-6 (index fallback), got: ${toasts[0]}`);
        });

        test('copyContextLines clamps at the start/end of allLines', () => {
            const allLines = [{ html: 'a', sourceLineNo: 1 }, { html: 'b', sourceLineNo: 2 }];
            const { handleBlockCopyAction, toasts } = buildHelpers(allLines, () => ({ lo: 0, hi: 1 }), 5);
            handleBlockCopyAction('copy-error-warning-block', 0, {});
            assert.strictEqual(toasts[0], 'lines:1-2:3'); // clamped to [0, 1], not [-5, 6]
        });

        test('copyIncidentBlockAsJson expands the copied text/range but NOT the reported level', () => {
            const allLines = [
                { html: 'ctx' }, { html: 'ERR', sourceLineNo: 10, level: 'error' }, { html: 'ctx' },
            ];
            const effectiveErrorWarningLevel = (item: { level?: string }): string | null => item?.level === 'error' ? 'error' : null;
            const factory = new Function(
                'allLines', 'stripTags', 'vscodeApi', 'showCopyToast', 'formatCopyToastMessage', 'sessionInfoData',
                'computeIncidentLineRange', 'computeDbTimestampBurstLineRange', 'computeAsciiArtBlockLineRange',
                'copyContextLines', 'effectiveErrorWarningLevel',
                getContextMenuBlockCopyScript() + '\nreturn { copyIncidentBlockAsJson: copyIncidentBlockAsJson };',
            );
            const postMessages: Record<string, unknown>[] = [];
            const vscodeApi = { postMessage: (m: Record<string, unknown>): void => { postMessages.push(m); } };
            const { copyIncidentBlockAsJson } = factory(
                allLines, (s: string) => s, vscodeApi, (): void => {}, (): string => '', {},
                () => null, (): null => null, (): null => null, 1, effectiveErrorWarningLevel,
            ) as { copyIncidentBlockAsJson: (inc: { lo: number; hi: number }, lineData: Record<string, unknown>) => void };
            copyIncidentBlockAsJson({ lo: 1, hi: 1 }, {});
            assert.strictEqual(postMessages[0].level, 'error');
            assert.strictEqual(postMessages[0].errorText, 'ctx\nERR\nctx');
        });
    });
});
