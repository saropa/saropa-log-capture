import * as assert from 'assert';
import { scoreRelevance, daysAgo } from '../modules/analysis-relevance';
import type { SectionData } from '../modules/analysis-relevance';

suite('AnalysisRelevance', () => {

    suite('daysAgo', () => {

        test('should return 0 for today', () => {
            const today = new Date().toISOString().slice(0, 10);
            assert.strictEqual(daysAgo(today), 0);
        });

        test('should return positive for past date', () => {
            const past = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
            assert.strictEqual(daysAgo(past), 3);
        });

        test('should return Infinity for invalid date', () => {
            assert.strictEqual(daysAgo('not-a-date'), Infinity);
        });

        test('should return Infinity for empty string', () => {
            assert.strictEqual(daysAgo(''), Infinity);
        });

        test('should handle ISO date format', () => {
            const result = daysAgo('2020-01-01');
            assert.ok(result > 1000);
        });
    });

    suite('scoreRelevance — empty data', () => {

        test('should return empty findings for empty data', () => {
            const result = scoreRelevance({});
            assert.strictEqual(result.findings.length, 0);
        });

        test('should set section levels for empty data', () => {
            const result = scoreRelevance({});
            assert.strictEqual(result.sectionLevels.get('docs'), 'none');
            assert.strictEqual(result.sectionLevels.get('symbols'), 'none');
            assert.strictEqual(result.sectionLevels.get('imports'), 'none');
        });
    });

    suite('scoreRelevance — blame', () => {

        test('should produce high finding for recent blame', () => {
            const today = new Date().toISOString().slice(0, 10);
            const data: SectionData = {
                blame: { date: today, author: 'alice', hash: 'abc1234' },
            };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.level === 'high' && f.sectionId === 'source'));
            assert.strictEqual(result.sectionLevels.get('source'), 'high');
        });

        test('should set medium for old blame', () => {
            const data: SectionData = {
                blame: { date: '2020-01-01', author: 'bob', hash: 'def5678' },
            };
            const result = scoreRelevance(data);
            // No high finding for old blame
            assert.ok(!result.findings.some(f => f.level === 'high' && f.text.includes('Crash line changed')));
            assert.strictEqual(result.sectionLevels.get('source'), 'medium');
        });
    });

    suite('scoreRelevance — line history', () => {

        test('should produce high finding for recent line commits', () => {
            const today = new Date().toISOString().slice(0, 10);
            const data: SectionData = {
                lineCommits: [{ date: today }],
            };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.level === 'high' && f.sectionId === 'line-history'));
            assert.strictEqual(result.sectionLevels.get('line-history'), 'high');
        });

        test('should set medium for old line commits', () => {
            const data: SectionData = {
                lineCommits: [{ date: '2020-01-01' }],
            };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('line-history'), 'medium');
        });

        test('should set none for empty line commits', () => {
            const data: SectionData = { lineCommits: [] };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('line-history'), 'none');
        });
    });

    suite('scoreRelevance — cross session', () => {

        test('should produce finding for recurring error', () => {
            const data: SectionData = {
                crossSession: { sessionCount: 3, totalOccurrences: 10 },
            };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('3 sessions')));
        });

        test('should not produce finding for single session', () => {
            const data: SectionData = {
                crossSession: { sessionCount: 1, totalOccurrences: 1 },
            };
            const result = scoreRelevance(data);
            assert.ok(!result.findings.some(f => f.text.includes('sessions')));
        });
    });

    suite('scoreRelevance — correlation', () => {

        test('should detect root cause when blame and first-seen align', () => {
            const today = new Date().toISOString().slice(0, 10);
            const data: SectionData = {
                blame: { date: today, author: 'alice', hash: 'abc1234' },
                crossSession: { sessionCount: 2, totalOccurrences: 5, firstSeenDate: today },
            };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('likely introduced by commit')));
        });

        test('should report persisting error when no blame correlation', () => {
            const data: SectionData = {
                blame: { date: '2020-01-01', author: 'bob', hash: 'old1234' },
                crossSession: { sessionCount: 5, totalOccurrences: 20, firstSeenDate: '2020-06-01' },
            };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('persists across')));
        });
    });

    suite('scoreRelevance — docs', () => {

        test('should produce finding when docs reference error', () => {
            const data: SectionData = { docMatchCount: 2 };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.sectionId === 'docs'));
            assert.strictEqual(result.sectionLevels.get('docs'), 'high');
        });

        test('should set none when no doc matches', () => {
            const data: SectionData = { docMatchCount: 0 };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('docs'), 'none');
        });

        test('should use singular for one doc', () => {
            const data: SectionData = { docMatchCount: 1 };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('1 project doc')));
        });
    });

    suite('scoreRelevance — annotations', () => {

        test('should produce finding for BUG annotation', () => {
            const data: SectionData = { annotations: [{ type: 'BUG' }] };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('BUG')));
        });

        test('should produce finding for FIXME annotation', () => {
            const data: SectionData = { annotations: [{ type: 'FIXME' }] };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('FIXME')));
        });

        test('should not produce finding for TODO annotation', () => {
            const data: SectionData = { annotations: [{ type: 'TODO' }] };
            const result = scoreRelevance(data);
            assert.ok(!result.findings.some(f => f.text.includes('TODO')));
        });
    });

    suite('scoreRelevance — affected files', () => {

        test('should produce finding when 3+ files affected', () => {
            const data: SectionData = { affectedFileCount: 5 };
            const result = scoreRelevance(data);
            assert.ok(result.findings.some(f => f.text.includes('5 source files')));
        });

        test('should not produce finding for fewer than 3 files', () => {
            const data: SectionData = { affectedFileCount: 2 };
            const result = scoreRelevance(data);
            assert.ok(!result.findings.some(f => f.sectionId === 'affected-files'));
        });
    });

    suite('scoreRelevance — limits', () => {

        test('should cap findings at 4', () => {
            const today = new Date().toISOString().slice(0, 10);
            const data: SectionData = {
                blame: { date: today, author: 'a', hash: 'h' },
                lineCommits: [{ date: today }],
                crossSession: { sessionCount: 3, totalOccurrences: 10, firstSeenDate: today },
                docMatchCount: 5,
                annotations: [{ type: 'BUG' }],
                affectedFileCount: 10,
            };
            const result = scoreRelevance(data);
            assert.ok(result.findings.length <= 4);
        });

        test('should sort findings high before medium', () => {
            const today = new Date().toISOString().slice(0, 10);
            const data: SectionData = {
                blame: { date: today, author: 'a', hash: 'h' },
                crossSession: { sessionCount: 5, totalOccurrences: 20, firstSeenDate: '2020-01-01' },
            };
            const result = scoreRelevance(data);
            if (result.findings.length >= 2) {
                const levels = result.findings.map(f => f.level);
                const highIdx = levels.indexOf('high');
                const medIdx = levels.indexOf('medium');
                if (highIdx >= 0 && medIdx >= 0) {
                    assert.ok(highIdx < medIdx);
                }
            }
        });
    });

    suite('scoreRelevance — section levels', () => {

        test('should set symbols to medium when present', () => {
            const data: SectionData = { symbolCount: 3 };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('symbols'), 'medium');
        });

        test('should set symbols to none when absent', () => {
            const data: SectionData = { symbolCount: 0 };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('symbols'), 'none');
        });

        test('should set imports to low when present', () => {
            const data: SectionData = { importCount: 5 };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('imports'), 'low');
        });

        test('should set tokens to medium when present', () => {
            const data: SectionData = { tokenMatchCount: 2 };
            const result = scoreRelevance(data);
            assert.strictEqual(result.sectionLevels.get('tokens'), 'medium');
        });
    });
});
