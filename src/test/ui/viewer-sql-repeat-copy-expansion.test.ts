/**
 * SQL repeat copy expansion — verifies that a "N × SQL repeated:" notification row
 * carries the hidden anchor's full text forward on `collapsedLineText` / `collapsedRawText`
 * so Ctrl+C (and the related markdown/snippet/raw/decorated paths) can expand it back
 * into N real lines in the clipboard.
 *
 * Why this matters: collapsed SQL repeats never enter allLines individually — only the
 * anchor (immediately hidden) and one notification row are stored. Without the captured
 * text, copy-to-clipboard produced a single header line and lost every repeated query.
 *
 * Scope: this file validates the data-side contract (notification item carries the text
 * + repeatCount; tail cleanup leaves it inert). The copy-script expansion itself is a
 * pure string transform exercised through static assertions in viewer-copy.ts tests
 * — no DOM / vscodeApi stubs required.
 */
import * as assert from 'node:assert';
import { loadViewerRepeatSandbox } from './viewer-sql-repeat-compression-sandbox';
import { getCopyScript } from '../../ui/viewer/viewer-copy';

const FLUTTER = 'I/flutter (1): ';

function driftSelect(id: number): string {
    return `${FLUTTER}Drift: Sent SELECT * FROM "activities" ORDER BY rowid LIMIT 1000 with args [${id}]`;
}

interface WithCollapse {
    collapsedLineText?: string;
    collapsedRawText?: string | null;
    sqlRepeatDrilldown?: { repeatCount: number };
    type: string;
    height: number;
}

suite('SQL repeat copy expansion', () => {
    test('notification row captures anchor text on first collapse', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 1_000_000;
        s.addToData(driftSelect(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelect(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelect(3), false, 'stdout', t0 + 200, false, null, undefined, undefined, 'debug');

        const tail = s.allLines.find((l) => l.type === 'repeat-notification') as WithCollapse | undefined;
        assert.ok(tail, 'repeat-notification row should exist');
        assert.strictEqual(tail!.sqlRepeatDrilldown?.repeatCount, 3);
        assert.ok(
            typeof tail!.collapsedLineText === 'string' && tail!.collapsedLineText!.length > 0,
            'collapsedLineText should be populated from the hidden anchor',
        );
        assert.ok(
            tail!.collapsedLineText!.includes('SELECT * FROM'),
            'collapsedLineText should carry the original SQL text verbatim',
        );
    });

    test('collapsedLineText is stable across later repeats (set once, not overwritten)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 2_000_000;
        s.addToData(driftSelect(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelect(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        const tail1 = s.allLines.find((l) => l.type === 'repeat-notification') as WithCollapse | undefined;
        const captured = tail1!.collapsedLineText;

        for (let i = 3; i <= 14; i++) {
            s.addToData(driftSelect(i), false, 'stdout', t0 + i * 50, false, null, undefined, undefined, 'debug');
        }
        const tail2 = s.allLines.find((l) => l.type === 'repeat-notification') as WithCollapse | undefined;
        assert.strictEqual(tail2!.sqlRepeatDrilldown?.repeatCount, 14);
        assert.strictEqual(
            tail2!.collapsedLineText,
            captured,
            'collapsedLineText must not be re-derived on updates (would race with stripped-html changes)',
        );
    });

    test('cleanupTrailingRepeats leaves notification height=0 so expansion is skipped', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 3_000_000;
        s.addToData(driftSelect(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelect(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        /* Marker triggers cleanupTrailingRepeats: anchor un-hides, notification goes inert (h=0). */
        s.addToData('<span>marker</span>', true, 'marker', t0 + 10_000, false, null, undefined, undefined, 'debug');
        const tail = s.allLines.find((l) => l.type === 'repeat-notification') as WithCollapse | undefined;
        assert.ok(tail, 'notification stays in allLines for index stability');
        assert.strictEqual(tail!.height, 0, 'notification height is zeroed post-cleanup');
        /* collapsedLineText may still exist on the object — the copy-side guard is
           height > 0 (see isExpandableRepeatNotification), which this zero value trips. */
    });

    test('copy script expands repeat-notification rows via collapsedLineText', () => {
        const src = getCopyScript();
        assert.ok(src.includes('isExpandableRepeatNotification'), 'copy script defines the expansion guard');
        assert.ok(src.includes('collapsedLineText'), 'copy script references collapsedLineText');
        assert.ok(src.includes('repeatCountForExpansion'), 'copy script references the expansion count helper');
        /* Plain, raw, and decorated paths all go through the expansion. */
        assert.ok(src.includes('function lineToPlainText'), 'plain path routes through lineToPlainText');
        assert.ok(src.includes('function lineToRawText'), 'raw path routes through lineToRawText');
        assert.ok(src.includes('linesToDecoratedText'), 'decorated path exists');
        /* Selection excludes hidden anchor so expansion does not double the content. */
        assert.ok(
            /if \(it\.repeatHidden\) continue;/.test(src),
            'getSelectedLines must skip repeatHidden so expansion is not duplicated',
        );
    });
});
