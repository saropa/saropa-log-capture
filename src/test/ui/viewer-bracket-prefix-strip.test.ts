/**
 * Regression tests for bracket-prefix stripping in structured line parsing and renderItem.
 *
 * Flutter DAP adapters prepend bracket metadata like [11:49:55.128] [logcat] before
 * the actual log format. These tests verify that:
 * - The structured parser skips leading [bracket] pairs to find the real format
 * - The renderItem source-tag strip handles multiple consecutive bracket pairs
 * - Existing bracket-based formats (sda-log, bracketed) still match directly
 */
import * as assert from 'node:assert';
import { getStructuredLineParserScript } from '../../ui/viewer/viewer-structured-line-parser';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';

suite('structured parser bracket-prefix skip', () => {
    const parserScript = getStructuredLineParserScript();

    test('tryStructuredFormats helper function must exist', () => {
        assert.ok(
            parserScript.includes('function tryStructuredFormats(text, formatId)'),
            'bracket-skip refactor requires tryStructuredFormats to avoid duplicating format-chain logic',
        );
    });

    test('leadingBracketRe regex must be defined for bracket detection', () => {
        assert.ok(
            parserScript.includes('var leadingBracketRe ='),
            'leadingBracketRe must exist to detect and skip leading [bracket] pairs',
        );
    });

    test('parseStructuredPrefix retries after stripping bracket pairs', () => {
        /* The retry loop strips leading [bracket] pairs and calls tryStructuredFormats
           again, so lines like [11:49:55] [logcat] 04-13 ... can match logcat-threadtime. */
        assert.ok(
            parserScript.includes('leadingBracketRe.exec(stripped)'),
            'parseStructuredPrefix must use leadingBracketRe to strip bracket pairs',
        );
        assert.ok(
            parserScript.includes('tryStructuredFormats(stripped, formatId)'),
            'parseStructuredPrefix must retry format matching on stripped text',
        );
    });

    test('prefixLen uses original plain length so brackets are included in strip', () => {
        /* Both the direct-match and bracket-skip paths must compute prefixLen against
           the original `plain` parameter, not the `stripped` variable. This ensures
           stripHtmlPrefix removes brackets + structured prefix in one pass. */
        const lines = parserScript.split('\n');
        const prefixLenAssignments = lines.filter(
            (l: string) => l.includes('result.prefixLen = plain.length - result.msg.length'),
        );
        assert.ok(
            prefixLenAssignments.length >= 2,
            'prefixLen must be computed from plain.length in both direct-match and bracket-skip paths',
        );
    });

    test('bracket-skip loop is capped at 3 attempts', () => {
        assert.ok(
            parserScript.includes('attempt < 3'),
            'bracket-skip loop must be bounded to prevent runaway stripping',
        );
    });

    test('direct match still tried first (sda-log and bracketed formats start with brackets)', () => {
        /* The first tryStructuredFormats call must use the original plain text, not
           stripped text, so formats like sda-log ([log] 14:32:05 ...) and bracketed
           ([2026-01-01T...] [ERROR] ...) still match without bracket stripping. */
        const fnBody = parserScript.slice(
            parserScript.indexOf('function parseStructuredPrefix('),
        );
        const firstTry = fnBody.indexOf('tryStructuredFormats(plain, formatId)');
        const stripLoop = fnBody.indexOf('leadingBracketRe.exec(stripped)');
        assert.ok(firstTry >= 0, 'direct match on plain text must exist');
        assert.ok(stripLoop >= 0, 'bracket-skip loop must exist');
        assert.ok(
            firstTry < stripLoop,
            'direct match on original text must come BEFORE bracket-skip loop',
        );
    });
});

suite('renderItem multi-bracket source-tag strip', () => {
    const renderScript = getViewerDataHelpersRender();

    test('source-tag strip regex handles multiple consecutive bracket pairs', () => {
        /* Before this fix, the regex was /^\[...\]\s?/ which only stripped one bracket.
           Now it must use the + quantifier to strip all leading bracket pairs.
           The emitted JS (after template-literal escaping) uses single backslashes. */
        assert.ok(
            renderScript.includes('(?:\\[[^\\]]+\\]\\s?)+'),
            'source-tag strip regex must use + quantifier to match multiple consecutive bracket pairs',
        );
    });

    test('structured prefix strip still takes priority over source-tag strip', () => {
        /* When structuredPrefixLen > 0, stripHtmlPrefix handles everything (including
           brackets). The source-tag strip is only a fallback for lines that did not
           match any structured format. */
        const lines = renderScript.split('\n');
        const structuredBranch = lines.findIndex(
            (l: string) => l.includes('structuredLineParsing') && l.includes('structuredPrefixLen > 0'),
        );
        const sourceTagBranch = lines.findIndex(
            (l: string) => l.includes('stripSourceTagPrefix') && l.includes('item.sourceTag'),
        );
        assert.ok(structuredBranch >= 0, 'structured prefix branch must exist');
        assert.ok(sourceTagBranch >= 0, 'source-tag strip branch must exist');
        assert.ok(
            structuredBranch < sourceTagBranch,
            'structured prefix strip must be checked BEFORE source-tag fallback',
        );
    });
});
