import * as assert from 'assert';
import * as vscode from 'vscode';
import { resolveCollectionSources } from '../../../modules/collection/collection-source-resolver';
import type { CollectionSource } from '../../../modules/collection/collection-types';
import type { SessionMeta } from '../../../modules/session/session-metadata';

/** Fake metadata store exposing only `loadAllMetadata()`. */
class FakeStore {
    constructor(private readonly data: Map<string, SessionMeta>) {}
    async loadAllMetadata(): Promise<ReadonlyMap<string, SessionMeta>> { return new Map(this.data); }
    // Unused but required to satisfy SessionMetadataStore's shape when we cast.
    async loadMetadata(): Promise<SessionMeta> { return {}; }
    async saveMetadata(): Promise<void> {}
    async deleteMetadata(): Promise<void> {}
}

const LOG_DIR = vscode.Uri.file('/tmp/logs');

suite('resolveCollectionSources', () => {

    test('passes file/session sources through unchanged', async () => {
        const sources: CollectionSource[] = [
            { type: 'session', relativePath: 'a.log', label: 'A', pinnedAt: 1 },
            { type: 'file', relativePath: 'b.txt', label: 'B', pinnedAt: 2 },
        ];
        const store = new FakeStore(new Map());
        const out = await resolveCollectionSources(sources, LOG_DIR, store as never);
        assert.strictEqual(out.length, 2);
        assert.strictEqual(out[0].relativePath, 'a.log');
        assert.strictEqual(out[1].relativePath, 'b.txt');
    });

    test('expands a group source into one session source per current member', async () => {
        const sources: CollectionSource[] = [
            { type: 'group', groupId: 'g1', label: 'My Group', pinnedAt: 100 },
        ];
        const store = new FakeStore(new Map<string, SessionMeta>([
            ['session.log', { groupId: 'g1' }],
            ['session.logcat.log', { groupId: 'g1' }],
            ['other.log', {}], // not part of the group
        ]));
        const out = await resolveCollectionSources(sources, LOG_DIR, store as never);
        const paths = out.map(s => s.relativePath).sort();
        assert.deepStrictEqual(paths, ['session.log', 'session.logcat.log']);
        for (const s of out) {
            assert.strictEqual(s.type, 'session');
            // Label composes "<group label> / <filename>" so search results show provenance.
            assert.ok(s.label.startsWith('My Group / '));
        }
    });

    test('dedupes when a file is pinned directly AND via a group expansion', async () => {
        const sources: CollectionSource[] = [
            { type: 'session', relativePath: 'session.log', label: 'Main', pinnedAt: 1 },
            { type: 'group', groupId: 'g1', label: 'G', pinnedAt: 2 },
        ];
        const store = new FakeStore(new Map<string, SessionMeta>([
            ['session.log', { groupId: 'g1' }],
            ['session.logcat.log', { groupId: 'g1' }],
        ]));
        const out = await resolveCollectionSources(sources, LOG_DIR, store as never);
        const paths = out.map(s => s.relativePath);
        const unique = new Set(paths);
        assert.strictEqual(paths.length, unique.size, 'no duplicates');
        assert.deepStrictEqual([...unique].sort(), ['session.log', 'session.logcat.log']);
    });

    test('returns zero members for a group whose members have all been ungrouped', async () => {
        const sources: CollectionSource[] = [
            { type: 'group', groupId: 'g-gone', label: 'Abandoned', pinnedAt: 1 },
        ];
        // Metadata map contains files, but none carry this groupId.
        const store = new FakeStore(new Map<string, SessionMeta>([
            ['a.log', { groupId: 'other' }],
            ['b.log', {}],
        ]));
        const out = await resolveCollectionSources(sources, LOG_DIR, store as never);
        assert.strictEqual(out.length, 0);
    });

    test('empty input returns empty output', async () => {
        const store = new FakeStore(new Map());
        const out = await resolveCollectionSources([], LOG_DIR, store as never);
        assert.deepStrictEqual(out, []);
    });
});
