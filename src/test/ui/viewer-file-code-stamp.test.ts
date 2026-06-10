/**
 * Per-file letter codes for the cumulative cross-session feed (plan 057).
 *
 * Verifies the webview registry + copy provenance helpers as pure string transforms:
 *   - fileCodeLetter() bijective base-26 (A..Z, AA, AB, …)
 *   - stampFileCodeOnNewItems() assigns letters in first-seen order and a per-file
 *     line number that resets at each new file
 *   - copyCodePrefix() / copyCodeLegend() emit codes ONLY when ≥2 files are present
 *     (single-file feeds stay unchanged — the no-letter, no-legend contract)
 *
 * No DOM / vscode needed: both scripts are self-contained JS, so we eval the
 * concatenated source in one Function scope with a shared `allLines` array — the
 * same array the real webview mutates via addToData.
 */
import * as assert from 'node:assert';
import { getFileCodeStampScript } from '../../ui/viewer/viewer-file-code-stamp';
import { getCopyFileCodesScript } from '../../ui/viewer/viewer-copy-file-codes';

interface LineItem { type: string; fileLetter?: string; fileLineNo?: number; }

interface Sandbox {
    allLines: LineItem[];
    fileCodeLetter(n: number): string;
    fileCodeCount(): number;
    stampFileCodeOnNewItems(before: number, uri?: string, ts?: number): void;
    resetFileCodes(): void;
    fileCodeList(): Array<{ letter: string; name: string; path: string; lineCount: number }>;
    copyCodePrefix(item: LineItem): string;
    copyCodeLegend(lines: LineItem[]): string;
}

function loadSandbox(): Sandbox {
    const allLines: LineItem[] = [];
    const body = getFileCodeStampScript() + getCopyFileCodesScript()
        + 'return { fileCodeLetter: fileCodeLetter, fileCodeCount: fileCodeCount,'
        + ' stampFileCodeOnNewItems: stampFileCodeOnNewItems, resetFileCodes: resetFileCodes,'
        + ' fileCodeList: fileCodeList, copyCodePrefix: copyCodePrefix, copyCodeLegend: copyCodeLegend };';
    const make = new Function('allLines', body) as (a: LineItem[]) => Omit<Sandbox, 'allLines'>;
    const api = make(allLines) as Sandbox;
    api.allLines = allLines;
    return api;
}

/** Push a content line and stamp it as having arrived from `uri`. */
function addLine(s: Sandbox, uri: string): void {
    const before = s.allLines.length;
    s.allLines.push({ type: 'line' });
    s.stampFileCodeOnNewItems(before, uri, 1000);
}

suite('per-file letter codes (plan 057)', () => {
    test('fileCodeLetter is bijective base-26 (A..Z, AA, AB, …)', () => {
        const s = loadSandbox();
        assert.strictEqual(s.fileCodeLetter(0), 'A');
        assert.strictEqual(s.fileCodeLetter(25), 'Z');
        assert.strictEqual(s.fileCodeLetter(26), 'AA');
        assert.strictEqual(s.fileCodeLetter(27), 'AB');
        assert.strictEqual(s.fileCodeLetter(51), 'AZ');
        assert.strictEqual(s.fileCodeLetter(52), 'BA');
    });

    test('letters assign in first-seen order; line number resets per file', () => {
        const s = loadSandbox();
        addLine(s, '/logs/a.log');
        addLine(s, '/logs/a.log');
        addLine(s, '/logs/b.log');
        addLine(s, '/logs/a.log');
        assert.deepStrictEqual(
            s.allLines.map((l) => l.fileLetter + String(l.fileLineNo)),
            ['A1', 'A2', 'B1', 'A3'],
            'A keeps its running count across the interleaved B line',
        );
        assert.strictEqual(s.fileCodeCount(), 2);
    });

    test('copy prefix + legend appear only with ≥2 files', () => {
        const s = loadSandbox();
        addLine(s, '/logs/a.log');
        // Single file so far: codes inactive.
        assert.strictEqual(s.copyCodePrefix(s.allLines[0]), '');
        assert.strictEqual(s.copyCodeLegend(s.allLines), '');

        addLine(s, '/logs/b.log');
        // Now ≥2 files: prefix + legend active.
        assert.strictEqual(s.copyCodePrefix(s.allLines[0]), 'A1  ');
        assert.strictEqual(s.copyCodePrefix(s.allLines[1]), 'B1  ');
        assert.strictEqual(
            s.copyCodeLegend(s.allLines),
            '# A = /logs/a.log\n# B = /logs/b.log\n',
            'legend lists each referenced file once, in first-referenced order',
        );
    });

    test('resetFileCodes clears the registry', () => {
        const s = loadSandbox();
        addLine(s, '/logs/a.log');
        addLine(s, '/logs/b.log');
        assert.strictEqual(s.fileCodeCount(), 2);
        s.resetFileCodes();
        assert.strictEqual(s.fileCodeCount(), 0);
        // Next file seen after reset starts at A again.
        addLine(s, '/logs/c.log');
        assert.strictEqual(s.fileCodeList()[0].letter, 'A');
    });

    test('lines with no origin file (single loaded file) are left unstamped', () => {
        const s = loadSandbox();
        const before = s.allLines.length;
        s.allLines.push({ type: 'line' });
        s.stampFileCodeOnNewItems(before, undefined, 1000);
        assert.strictEqual(s.allLines[0].fileLetter, undefined);
        assert.strictEqual(s.fileCodeCount(), 0);
    });
});
