import * as assert from 'assert';
import { SessionMetadataStore, SessionMeta, Annotation } from '../modules/session-metadata';

suite('SessionMetadataStore', () => {

    test('should construct a meta URI from a log URI', () => {
        const store = new SessionMetadataStore();
        // getMetaUri replaces .log with .meta.json
        const fakeUri = { toString: () => 'file:///workspace/reports/test.log' };
        const metaUri = store.getMetaUri(fakeUri as never);
        assert.ok(metaUri.toString().endsWith('.meta.json'));
        assert.ok(!metaUri.toString().includes('.log'));
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
