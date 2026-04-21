import * as assert from 'assert';
import {
    getPrimaryMember,
    generateGroupId,
    buildGroupIndex,
    secondaryCount,
    type PrimaryMemberInput,
    type SessionGroupDescriptor,
    type ResolvedGroupMember,
} from '../../../modules/session/session-groups';
import type { SessionMeta } from '../../../modules/session/session-metadata';

suite('session-groups', () => {

    suite('getPrimaryMember', () => {
        test('throws on empty members array', () => {
            assert.throws(() => getPrimaryMember([]), /empty group/i);
        });

        test('picks the DAP member when present', () => {
            const dartMember: PrimaryMemberInput = { debugAdapterType: 'dart', mtime: 2000 };
            const logcatMember: PrimaryMemberInput = { mtime: 1000 };
            const driftMember: PrimaryMemberInput = { mtime: 1500 };
            // Pass in order where the DAP member is NOT earliest, to verify the rule is
            // "DAP wins" not "earliest wins" when a DAP member exists.
            const primary = getPrimaryMember([logcatMember, driftMember, dartMember]);
            assert.strictEqual(primary, dartMember);
        });

        test('picks earliest DAP member when multiple DAP members exist', () => {
            const firstDap: PrimaryMemberInput = { debugAdapterType: 'dart', mtime: 1000 };
            const secondDap: PrimaryMemberInput = { debugAdapterType: 'dart', mtime: 3000 };
            const logcat: PrimaryMemberInput = { mtime: 2000 };
            const primary = getPrimaryMember([secondDap, logcat, firstDap]);
            assert.strictEqual(primary, firstDap);
        });

        test('picks earliest member in standalone mode (no DAP)', () => {
            const first: PrimaryMemberInput = { mtime: 1000 };
            const second: PrimaryMemberInput = { mtime: 2000 };
            const third: PrimaryMemberInput = { mtime: 3000 };
            const primary = getPrimaryMember([third, second, first]);
            assert.strictEqual(primary, first);
        });

        test('treats empty-string debugAdapterType as non-DAP', () => {
            // Defensive: a SessionMeta could in theory carry an empty string.
            // Our rule should require a non-empty string to qualify as "DAP".
            const emptyDap: PrimaryMemberInput = { debugAdapterType: '', mtime: 2000 };
            const earliest: PrimaryMemberInput = { mtime: 1000 };
            const primary = getPrimaryMember([emptyDap, earliest]);
            assert.strictEqual(primary, earliest);
        });

        test('single-member group returns that member', () => {
            const only: PrimaryMemberInput = { mtime: 1234 };
            assert.strictEqual(getPrimaryMember([only]), only);
        });
    });

    suite('generateGroupId', () => {
        test('returns a non-empty string', () => {
            const id = generateGroupId();
            assert.ok(typeof id === 'string');
            assert.ok(id.length > 0);
        });

        test('returns a new id on each call', () => {
            // Two consecutive calls should collide with vanishingly small probability.
            const a = generateGroupId();
            const b = generateGroupId();
            assert.notStrictEqual(a, b);
        });

        test('returns standard UUID format (8-4-4-4-12 hex)', () => {
            const id = generateGroupId();
            assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });
    });

    suite('buildGroupIndex', () => {
        test('returns empty map when no metadata has groupId', () => {
            const metaMap = new Map<string, SessionMeta>([
                ['a.log', {}],
                ['b.log', { tags: ['foo'] }],
            ]);
            const stats = new Map([
                ['a.log', { mtime: 1000 }],
                ['b.log', { mtime: 2000 }],
            ]);
            const index = buildGroupIndex(metaMap, stats);
            assert.strictEqual(index.size, 0);
        });

        test('skips singleton groups (1 member) as effectively ungrouped', () => {
            // A lone file carrying a groupId is harmless — render it as standalone, not a group.
            const metaMap = new Map<string, SessionMeta>([
                ['a.log', { groupId: 'g1' }],
            ]);
            const stats = new Map([['a.log', { mtime: 1000 }]]);
            const index = buildGroupIndex(metaMap, stats);
            assert.strictEqual(index.size, 0);
        });

        test('builds a descriptor for a 2-member group', () => {
            const metaMap = new Map<string, SessionMeta>([
                ['dart.log', { groupId: 'g1', debugAdapterType: 'dart' }],
                ['logcat.log', { groupId: 'g1' }],
            ]);
            const stats = new Map([
                ['dart.log', { mtime: 2000 }],
                ['logcat.log', { mtime: 1500 }],
            ]);
            const index = buildGroupIndex(metaMap, stats);
            const desc = index.get('g1');
            assert.ok(desc);
            assert.strictEqual(desc.members.length, 2);
            // Members sorted ascending by mtime — logcat first (1500), dart second (2000).
            assert.strictEqual(desc.members[0].relativePath, 'logcat.log');
            assert.strictEqual(desc.members[1].relativePath, 'dart.log');
            // Primary is the DAP member (dart), regardless of mtime order.
            assert.strictEqual(desc.primary.relativePath, 'dart.log');
            assert.strictEqual(desc.earliestMtime, 1500);
            assert.strictEqual(desc.latestMtime, 2000);
        });

        test('drops members whose stats are missing', () => {
            const metaMap = new Map<string, SessionMeta>([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
                ['c.log', { groupId: 'g1' }],
            ]);
            // c.log has no stats — treated as deleted-behind-the-scenes.
            const stats = new Map([
                ['a.log', { mtime: 1000 }],
                ['b.log', { mtime: 2000 }],
            ]);
            const index = buildGroupIndex(metaMap, stats);
            const desc = index.get('g1');
            assert.ok(desc);
            assert.strictEqual(desc.members.length, 2);
        });

        test('collapses to standalone when stats-loss drops below 2 members', () => {
            const metaMap = new Map<string, SessionMeta>([
                ['a.log', { groupId: 'g1' }],
                ['b.log', { groupId: 'g1' }],
            ]);
            // Only one member still has stats — below the 2-member threshold.
            const stats = new Map([['a.log', { mtime: 1000 }]]);
            const index = buildGroupIndex(metaMap, stats);
            assert.strictEqual(index.size, 0);
        });

        test('separates members of different groups', () => {
            const metaMap = new Map<string, SessionMeta>([
                ['a1.log', { groupId: 'g1' }],
                ['a2.log', { groupId: 'g1' }],
                ['b1.log', { groupId: 'g2' }],
                ['b2.log', { groupId: 'g2' }],
            ]);
            const stats = new Map([
                ['a1.log', { mtime: 1000 }],
                ['a2.log', { mtime: 1500 }],
                ['b1.log', { mtime: 5000 }],
                ['b2.log', { mtime: 5500 }],
            ]);
            const index = buildGroupIndex(metaMap, stats);
            assert.strictEqual(index.size, 2);
            assert.strictEqual(index.get('g1')?.members.length, 2);
            assert.strictEqual(index.get('g2')?.members.length, 2);
        });
    });

    suite('secondaryCount', () => {
        test('returns total members minus 1', () => {
            const descriptor: SessionGroupDescriptor<ResolvedGroupMember> = {
                groupId: 'g1',
                members: [
                    { relativePath: 'a.log', mtime: 1 },
                    { relativePath: 'b.log', mtime: 2 },
                    { relativePath: 'c.log', mtime: 3 },
                ],
                primary: { relativePath: 'a.log', mtime: 1 },
                earliestMtime: 1,
                latestMtime: 3,
            };
            assert.strictEqual(secondaryCount(descriptor), 2);
        });
    });
});
