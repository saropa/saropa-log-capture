import * as assert from 'assert';
import { SessionMetadataStore, SessionMeta, Annotation, isOurSidecar } from '../../../modules/session/session-metadata';

suite('SessionMetadataStore', () => {

    test('getMetaUri returns undefined when no workspace folder is available', () => {
        const store = new SessionMetadataStore();
        const fakeUri = { toString: () => 'file:///workspace/reports/test.log' };
        const metaUri = store.getMetaUri(fakeUri as never);
        // Outside a real workspace, getCentralMetaUri returns undefined (no sidecar fallback)
        assert.strictEqual(metaUri, undefined);
    });

    test('Annotation interface should hold expected fields', () => {
        const ann: Annotation = {
            lineIndex: 5,
            text: 'This is a note',
            timestamp: '2026-01-27T12:00:00.000Z',
        };
        assert.strictEqual(ann.lineIndex, 5);
        assert.strictEqual(ann.text, 'This is a note');
        assert.ok(ann.timestamp.length > 0);
    });

    test('SessionMeta interface should support optional fields', () => {
        const meta: SessionMeta = {};
        assert.strictEqual(meta.displayName, undefined);
        assert.strictEqual(meta.tags, undefined);
        assert.strictEqual(meta.annotations, undefined);
    });

    test('isOurSidecar should match files with severity count fields', () => {
        assert.strictEqual(isOurSidecar({ errorCount: 0, warningCount: 0, perfCount: 0, fwCount: 0, infoCount: 10 }), true);
        assert.strictEqual(isOurSidecar({ errorCount: 5 }), true);
        assert.strictEqual(isOurSidecar({ infoCount: 100 }), true);
        assert.strictEqual(isOurSidecar({ fwCount: 0 }), true);
        assert.strictEqual(isOurSidecar({ warningCount: 3 }), true);
    });

    test('isOurSidecar should reject non-matching content', () => {
        assert.strictEqual(isOurSidecar(null), false);
        assert.strictEqual(isOurSidecar('string'), false);
        assert.strictEqual(isOurSidecar(42), false);
        assert.strictEqual(isOurSidecar([]), false);
        assert.strictEqual(isOurSidecar({}), false);
        assert.strictEqual(isOurSidecar({ name: 'some other tool' }), false);
        assert.strictEqual(isOurSidecar({ errorCount: 'not a number' }), false);
    });

    test('SessionMeta should hold all fields when populated', () => {
        const meta: SessionMeta = {
            displayName: 'My Session',
            tags: ['bug', 'prod'],
            annotations: [
                { lineIndex: 0, text: 'First line note', timestamp: '2026-01-27T12:00:00.000Z' },
            ],
        };
        assert.strictEqual(meta.displayName, 'My Session');
        assert.strictEqual(meta.tags?.length, 2);
        assert.strictEqual(meta.annotations?.length, 1);
        assert.strictEqual(meta.annotations?.[0].lineIndex, 0);
    });
});
