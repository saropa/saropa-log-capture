import * as assert from 'assert';
import { extractHeadings, extractTokensFromText, extractTokensFromMarkdown } from '../../../modules/project-indexer/token-extractor';

suite('Token Extractor', () => {

    suite('extractHeadings', () => {
        test('extracts H1–H3 with 1-based line numbers', () => {
            const md = '# Title\n\n## Section\n\n### Sub\n';
            const h = extractHeadings(md);
            assert.strictEqual(h.length, 3);
            assert.strictEqual(h[0].level, 1);
            assert.strictEqual(h[0].text, 'Title');
            assert.strictEqual(h[0].line, 1);
            assert.strictEqual(h[1].level, 2);
            assert.strictEqual(h[1].text, 'Section');
            assert.strictEqual(h[1].line, 3);
            assert.strictEqual(h[2].level, 3);
            assert.strictEqual(h[2].text, 'Sub');
            assert.strictEqual(h[2].line, 5);
        });
        test('returns empty for plain text', () => {
            assert.strictEqual(extractHeadings('no headings here').length, 0);
        });
    });

    suite('extractTokensFromText', () => {
        test('lowercases and dedupes', () => {
            const t = extractTokensFromText('Hello World hello');
            assert.ok(t.includes('hello'));
            assert.ok(t.includes('world'));
            assert.strictEqual(t.filter(x => x === 'hello').length, 1);
        });
        test('skips short and stop words', () => {
            const t = extractTokensFromText('the is and ab');
            assert.strictEqual(t.includes('the'), false);
            assert.strictEqual(t.includes('ab'), false);
        });
    });

    suite('extractTokensFromMarkdown', () => {
        test('returns tokens and headings', () => {
            const md = '# Firebase\n\nUse **Firebase** for auth.';
            const { tokens, headings } = extractTokensFromMarkdown(md);
            assert.strictEqual(headings.length, 1);
            assert.strictEqual(headings[0].text, 'Firebase');
            assert.ok(tokens.includes('firebase'));
        });
    });
});
