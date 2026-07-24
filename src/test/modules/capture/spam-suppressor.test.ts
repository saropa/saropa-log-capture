import * as assert from 'assert';
import { SpamSuppressor } from '../../../modules/capture/spam-suppressor';

const blastLine = (f: number, a: number): string =>
    `E/BLASTBufferQueue(14935): [SurfaceView[com.app/...MainActivity]#1](f:${f},a:${a}) ` +
    `acquireNextBufferLocked: Can't acquire next buffer. Already acquired max frames`;

suite('SpamSuppressor', () => {

    suite('check', () => {

        test('should allow non-spam lines', () => {
            const s = new SpamSuppressor();
            const r = s.check('normal log output', new Date());
            assert.strictEqual(r.allow, true);
            assert.strictEqual(r.flush, undefined);
        });

        test('should suppress first BLASTBufferQueue line', () => {
            const s = new SpamSuppressor();
            const r = s.check(blastLine(1, 6), new Date());
            assert.strictEqual(r.allow, false);
            assert.strictEqual(r.flush, undefined);
        });

        test('should suppress consecutive BLASTBufferQueue lines with varying fields', () => {
            const s = new SpamSuppressor();
            s.check(blastLine(1, 6), new Date());
            const r = s.check(blastLine(2, 7), new Date());
            assert.strictEqual(r.allow, false);
        });

        test('should flush summary when non-spam line follows a burst', () => {
            const s = new SpamSuppressor();
            const t1 = new Date(2026, 0, 1, 10, 30, 0, 100);
            const t2 = new Date(2026, 0, 1, 10, 30, 1, 500);
            const t3 = new Date(2026, 0, 1, 10, 30, 2, 0);

            s.check(blastLine(1, 6), t1);
            s.check(blastLine(2, 7), t2);
            const r = s.check('normal line', t3);

            assert.strictEqual(r.allow, true);
            assert.ok(r.flush);
            assert.ok(r.flush.summary.includes('2 BLASTBufferQueue'));
            assert.ok(r.flush.summary.includes('10:30:00.100'));
            assert.ok(r.flush.summary.includes('10:30:01.500'));
        });

        test('should use single timestamp when burst is one line', () => {
            const s = new SpamSuppressor();
            const t = new Date(2026, 0, 1, 14, 0, 0, 0);
            s.check(blastLine(1, 6), t);
            const r = s.check('next', new Date());

            assert.ok(r.flush);
            assert.ok(r.flush.summary.includes('1 BLASTBufferQueue'));
            assert.ok(r.flush.summary.includes('14:00:00.000'));
            // No range separator when first === last
            assert.ok(!r.flush.summary.includes('–'));
        });

        test('should not match partial pattern (missing acquireNextBufferLocked)', () => {
            const s = new SpamSuppressor();
            const r = s.check('E/BLASTBufferQueue(14935): some other message', new Date());
            assert.strictEqual(r.allow, true);
        });

        test('should not match partial pattern (missing BLASTBufferQueue)', () => {
            const s = new SpamSuppressor();
            const r = s.check('acquireNextBufferLocked: random context', new Date());
            assert.strictEqual(r.allow, true);
        });
    });

    suite('flush', () => {

        test('should return null when no burst is active', () => {
            const s = new SpamSuppressor();
            assert.strictEqual(s.flush(), null);
        });

        test('should drain active burst and return summary', () => {
            const s = new SpamSuppressor();
            const t1 = new Date(2026, 0, 1, 8, 0, 0, 0);
            const t2 = new Date(2026, 0, 1, 8, 0, 5, 0);
            s.check(blastLine(1, 1), t1);
            s.check(blastLine(2, 2), t2);

            const f = s.flush();
            assert.ok(f);
            assert.ok(f.summary.includes('2 BLASTBufferQueue'));
            assert.strictEqual(f.timestamp.getTime(), t2.getTime());
        });

        test('should return null on second flush (already drained)', () => {
            const s = new SpamSuppressor();
            s.check(blastLine(1, 1), new Date());
            s.flush();
            assert.strictEqual(s.flush(), null);
        });
    });

    suite('reset', () => {

        test('should discard active burst without emitting summary', () => {
            const s = new SpamSuppressor();
            s.check(blastLine(1, 1), new Date());
            s.reset();
            assert.strictEqual(s.flush(), null);
        });

        test('should allow fresh tracking after reset', () => {
            const s = new SpamSuppressor();
            s.check(blastLine(1, 1), new Date());
            s.reset();
            const r = s.check('normal', new Date());
            assert.strictEqual(r.allow, true);
            assert.strictEqual(r.flush, undefined);
        });
    });

    suite('burst transitions', () => {

        test('should handle spam → non-spam → spam correctly', () => {
            const s = new SpamSuppressor();
            const t = new Date(2026, 0, 1, 12, 0, 0, 0);

            s.check(blastLine(1, 1), t);
            s.check(blastLine(2, 2), t);
            const mid = s.check('normal', t);
            assert.strictEqual(mid.allow, true);
            assert.ok(mid.flush, 'first burst should flush');

            s.check(blastLine(3, 3), t);
            const end = s.check('another normal', t);
            assert.strictEqual(end.allow, true);
            assert.ok(end.flush, 'second burst should flush');
            assert.ok(end.flush.summary.includes('1 BLASTBufferQueue'));
        });
    });
});
