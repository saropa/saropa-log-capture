/**
 * Tests for session-history-grouping utility functions.
 * Covers getTreeItemUri for both single sessions and split groups.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    getTreeItemUri,
    isSplitGroup,
    isSessionGroup,
    groupSessionGroups,
    type SessionMetadata,
    type SplitGroup,
} from '../../ui/session/session-history-grouping';

function makeSession(filename: string, partNumber?: number): SessionMetadata {
    return {
        uri: vscode.Uri.parse(`file:///${filename}`),
        filename,
        size: 100,
        mtime: Date.now(),
        partNumber,
    };
}

/** Build a SessionMetadata with a custom mtime, groupId, and optional debugAdapterType. */
function makeSessionWithGroup(
    filename: string,
    opts: { mtime: number; groupId?: string; debugAdapterType?: string; size?: number },
): SessionMetadata {
    return {
        uri: vscode.Uri.parse(`file:///${filename}`),
        filename,
        size: opts.size ?? 100,
        mtime: opts.mtime,
        groupId: opts.groupId,
        debugAdapterType: opts.debugAdapterType,
    };
}

function makeSplitGroup(parts: SessionMetadata[]): SplitGroup {
    return {
        type: 'split-group',
        baseFilename: 'session',
        parts,
        totalSize: parts.reduce((s, p) => s + p.size, 0),
        mtime: Math.max(...parts.map(p => p.mtime)),
    };
}

suite('session-history-grouping', () => {
    suite('getTreeItemUri', () => {
        test('should return the URI for a single session', () => {
            const session = makeSession('test.log');
            assert.strictEqual(getTreeItemUri(session).toString(), session.uri.toString());
        });

        test('should return the first part URI for a split group (sorted by partNumber)', () => {
            const part3 = makeSession('session_003.log', 3);
            const part1 = makeSession('session_001.log', 1);
            const part2 = makeSession('session_002.log', 2);
            const group = makeSplitGroup([part3, part1, part2]);
            assert.strictEqual(getTreeItemUri(group).toString(), part1.uri.toString());
        });

        test('should handle split group with undefined partNumbers (falls back to 0)', () => {
            const partA = makeSession('a.log');
            const partB = makeSession('b.log');
            const group = makeSplitGroup([partB, partA]);
            // Both partNumber undefined → both treated as 0 → original order preserved
            assert.strictEqual(getTreeItemUri(group).toString(), partB.uri.toString());
        });
    });

    suite('isSplitGroup', () => {
        test('should return true for a SplitGroup', () => {
            const group = makeSplitGroup([makeSession('a.log')]);
            assert.strictEqual(isSplitGroup(group), true);
        });

        test('should return false for a SessionMetadata', () => {
            const session = makeSession('test.log');
            assert.strictEqual(isSplitGroup(session), false);
        });
    });

    suite('groupSessionGroups', () => {
        test('passes ungrouped items through unchanged', () => {
            const a = makeSessionWithGroup('a.log', { mtime: 1000 });
            const b = makeSessionWithGroup('b.log', { mtime: 2000 });
            const out = groupSessionGroups([a, b]);
            assert.strictEqual(out.length, 2);
            assert.strictEqual(isSessionGroup(out[0]), false);
            assert.strictEqual(isSessionGroup(out[1]), false);
        });

        test('keeps singleton-groupId items as standalone (not wrapped)', () => {
            const loner = makeSessionWithGroup('loner.log', { mtime: 1000, groupId: 'g1' });
            const out = groupSessionGroups([loner]);
            assert.strictEqual(out.length, 1);
            assert.strictEqual(isSessionGroup(out[0]), false);
        });

        test('wraps \u22652 items sharing a groupId into a SessionGroup', () => {
            const dart = makeSessionWithGroup('session.log', {
                mtime: 2000, groupId: 'g1', debugAdapterType: 'dart',
            });
            const logcat = makeSessionWithGroup('session.logcat.log', { mtime: 1500, groupId: 'g1' });
            const out = groupSessionGroups([dart, logcat]);
            assert.strictEqual(out.length, 1);
            const group = out[0];
            assert.ok(isSessionGroup(group));
            if (!isSessionGroup(group)) { return; } // narrow for TS
            assert.strictEqual(group.groupId, 'g1');
            assert.strictEqual(group.members.length, 2);
            // Members sorted ascending by mtime \u2014 logcat (1500) before dart (2000).
            assert.strictEqual((group.members[0] as SessionMetadata).filename, 'session.logcat.log');
            assert.strictEqual((group.members[1] as SessionMetadata).filename, 'session.log');
            // Primary is the DAP member regardless of order.
            assert.strictEqual((group.primary as SessionMetadata).filename, 'session.log');
            // Derived fields reflect the primary plus summed size.
            assert.strictEqual(group.filename, 'session.log');
            assert.strictEqual(group.size, 200);
            assert.strictEqual(group.mtime, 1500);
            assert.strictEqual(group.latestMtime, 2000);
        });

        test('earliest-mtime member wins when no DAP member is present', () => {
            const drift = makeSessionWithGroup('drift.log', { mtime: 3000, groupId: 'g2' });
            const logcat = makeSessionWithGroup('logcat.log', { mtime: 1000, groupId: 'g2' });
            const out = groupSessionGroups([drift, logcat]);
            const group = out[0];
            assert.ok(isSessionGroup(group));
            if (!isSessionGroup(group)) { return; }
            assert.strictEqual((group.primary as SessionMetadata).filename, 'logcat.log');
        });

        test('separates members of different groups', () => {
            const a1 = makeSessionWithGroup('a1.log', { mtime: 1000, groupId: 'g1' });
            const a2 = makeSessionWithGroup('a2.log', { mtime: 1500, groupId: 'g1' });
            const b1 = makeSessionWithGroup('b1.log', { mtime: 5000, groupId: 'g2' });
            const b2 = makeSessionWithGroup('b2.log', { mtime: 5500, groupId: 'g2' });
            const out = groupSessionGroups([a1, a2, b1, b2]);
            const groups = out.filter(isSessionGroup);
            assert.strictEqual(groups.length, 2);
            assert.strictEqual(groups[0].members.length, 2);
            assert.strictEqual(groups[1].members.length, 2);
        });

        test('mixes ungrouped items alongside one session group', () => {
            const grouped1 = makeSessionWithGroup('g-a.log', { mtime: 1000, groupId: 'g1' });
            const grouped2 = makeSessionWithGroup('g-b.log', { mtime: 1500, groupId: 'g1' });
            const loner = makeSessionWithGroup('loner.log', { mtime: 2000 });
            const out = groupSessionGroups([grouped1, grouped2, loner]);
            assert.strictEqual(out.length, 2);
            assert.strictEqual(out.filter(isSessionGroup).length, 1);
            assert.strictEqual(out.filter(i => !isSessionGroup(i)).length, 1);
        });
    });
});
