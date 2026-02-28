import * as assert from 'assert';
import { SessionMetadataStore, SessionMeta, Annotation } from '../../../modules/session/session-metadata';

suite('SessionMetadataStore', () => {

    test('getMetaUri returns a URI for metadata (central store or sidecar)', () => {
        const store = new SessionMetadataStore();
        const fakeUri = { toString: () => 'file:///workspace/reports/test.log' };
        const metaUri = store.getMetaUri(fakeUri as never);
        const s = metaUri.toString();
        assert.ok(s.endsWith('.meta.json') || s.includes('session-metadata.json'));
        assert.ok(!s.includes('/test.log'));
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
