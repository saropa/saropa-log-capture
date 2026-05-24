/**
 * Unit tests for the CHANGELOG parser behind the crash detail's "may already be fixed" signal
 * (plan 054 Stage 5c-1). Pure string logic — runs under `node --test`.
 */

import * as assert from 'assert';
import { parseChangelogVersions, changelogSince } from '../../../modules/crashlytics/crash-changelog';

const SAMPLE = [
    '# Changelog',
    '',
    '## [Unreleased]',
    'Some pending work.',
    '',
    '## [2026.0301.01]',
    '- Fixed the null crash in contact sync.',
    '',
    '## 2026.0125.01',
    'Older release notes.',
    '',
    '## v2025.1120.01',
    'First tracked release.',
].join('\n');

suite('crash-changelog', () => {
    test('parseChangelogVersions skips Unreleased and prose, keeps versioned headings in order', () => {
        const versions = parseChangelogVersions(SAMPLE);
        assert.deepStrictEqual(versions.map(v => v.version), ['2026.0301.01', '2026.0125.01', '2025.1120.01']);
    });

    test('parseChangelogVersions captures the first summary line, stripping the bullet', () => {
        const versions = parseChangelogVersions(SAMPLE);
        assert.strictEqual(versions[0].summary, 'Fixed the null crash in contact sync.');
    });

    test('changelogSince returns the newer releases above the affected version', () => {
        const result = changelogSince(parseChangelogVersions(SAMPLE), '2026.0125.01');
        assert.strictEqual(result.found, true);
        assert.deepStrictEqual(result.since.map(v => v.version), ['2026.0301.01']);
    });

    test('changelogSince matches with or without a leading v', () => {
        const result = changelogSince(parseChangelogVersions(SAMPLE), 'v2025.1120.01');
        assert.strictEqual(result.found, true);
        // Newest two releases are both after the oldest one.
        assert.deepStrictEqual(result.since.map(v => v.version), ['2026.0301.01', '2026.0125.01']);
    });

    test('changelogSince on the newest version yields found with no newer releases', () => {
        const result = changelogSince(parseChangelogVersions(SAMPLE), '2026.0301.01');
        assert.strictEqual(result.found, true);
        assert.strictEqual(result.since.length, 0);
    });

    test('changelogSince reports not-found for an absent version (no false "nothing changed")', () => {
        const result = changelogSince(parseChangelogVersions(SAMPLE), '1999.0101.01');
        assert.strictEqual(result.found, false);
        assert.strictEqual(result.since.length, 0);
    });
});
