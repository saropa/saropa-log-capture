/**
 * Tests for session-history-grouping utility functions.
 * Covers getTreeItemUri for both single sessions and split groups.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getTreeItemUri, isSplitGroup, type SessionMetadata, type SplitGroup } from '../../ui/session/session-history-grouping';

function makeSession(filename: string, partNumber?: number): SessionMetadata {
    return {
        uri: vscode.Uri.parse(`file:///${filename}`),
        filename,
        size: 100,
        mtime: Date.now(),
        partNumber,
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
});
