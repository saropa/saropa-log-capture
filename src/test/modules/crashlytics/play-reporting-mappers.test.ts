/**
 * Tests for the Play Developer Reporting → Crashlytics-type mappers (bug_008 W3).
 *
 * These pin the field mapping against the published v1beta1 schema so a future shape change is caught
 * here rather than silently producing blank issues in the panel.
 */

import * as assert from 'assert';
import {
    mapErrorIssue, mapErrorReport, parseReportText, osVersionLabel, deviceModelLabel, issueShortId, issueKind,
} from '../../../modules/crashlytics/play-reporting-mappers';

suite('play-reporting-mappers: mapErrorIssue', () => {
    const base = {
        name: 'apps/com.x/errorIssues/9988',
        type: 'CRASH',
        cause: 'java.lang.NullPointerException',
        location: 'MainActivity.onCreate',
        errorReportCount: '1234',
        distinctUsers: '321',
        firstAppVersion: { versionCode: '40' },
        lastAppVersion: { versionCode: '52' },
    };

    test('maps every field from a full ErrorIssue', () => {
        const issue = mapErrorIssue(base);
        assert.strictEqual(issue.id, 'apps/com.x/errorIssues/9988');
        assert.strictEqual(issue.title, 'java.lang.NullPointerException');
        assert.strictEqual(issue.subtitle, 'MainActivity.onCreate');
        assert.strictEqual(issue.eventCount, 1234);
        assert.strictEqual(issue.userCount, 321);
        assert.strictEqual(issue.isFatal, true);
        assert.strictEqual(issue.kind, 'crash');
        assert.strictEqual(issue.state, 'UNKNOWN');
        assert.strictEqual(issue.firstVersion, '40');
        assert.strictEqual(issue.lastVersion, '52');
    });

    test('CRASH and APPLICATION_NOT_RESPONDING are fatal; NON_FATAL is not', () => {
        assert.strictEqual(mapErrorIssue({ ...base, type: 'CRASH' }).isFatal, true);
        assert.strictEqual(mapErrorIssue({ ...base, type: 'APPLICATION_NOT_RESPONDING' }).isFatal, true);
        assert.strictEqual(mapErrorIssue({ ...base, type: 'NON_FATAL' }).isFatal, false);
        assert.strictEqual(mapErrorIssue({ ...base, type: 'ERROR_TYPE_UNSPECIFIED' }).isFatal, false);
    });

    test('falls back to location when cause is missing, and zero-fills counts', () => {
        const issue = mapErrorIssue({ name: 'apps/x/errorIssues/1', type: 'NON_FATAL', location: 'foo.dart:9' });
        assert.strictEqual(issue.title, 'foo.dart:9');
        assert.strictEqual(issue.eventCount, 0);
        assert.strictEqual(issue.userCount, 0);
        assert.strictEqual(issue.firstVersion, undefined);
    });
});

suite('play-reporting-mappers: parseReportText', () => {
    test('splits a stack blob into frame lines and drops blanks', () => {
        const thread = parseReportText('"main" tid=1\n\n  #00 pc 0x1 libapp.so\n  #01 pc 0x2 libapp.so\n');
        assert.ok(thread);
        assert.strictEqual(thread?.name, 'Crash');
        assert.strictEqual(thread?.frames.length, 3);
        assert.strictEqual(thread?.frames[1].text, '  #00 pc 0x1 libapp.so');
    });

    test('returns undefined for empty / whitespace-only text', () => {
        assert.strictEqual(parseReportText(''), undefined);
        assert.strictEqual(parseReportText('   \n  \n'), undefined);
    });
});

suite('play-reporting-mappers: mapErrorReport', () => {
    test('maps reportText to a crash thread plus device/os/time', () => {
        const ev = mapErrorReport('apps/x/errorIssues/5', {
            reportText: 'Exception\n  at foo',
            deviceModel: { marketingName: 'Pixel 8' },
            osVersion: { apiLevel: '34' },
            eventTime: '2026-05-23T01:38:06Z',
        });
        assert.strictEqual(ev.issueId, 'apps/x/errorIssues/5');
        assert.strictEqual(ev.crashThread?.frames.length, 2);
        assert.strictEqual(ev.deviceModel, 'Pixel 8');
        assert.strictEqual(ev.osVersion, 'API 34');
        assert.strictEqual(ev.eventTime, '2026-05-23T01:38:06Z');
        assert.deepStrictEqual(ev.appThreads, []);
    });

    test('no reportText yields no crash thread', () => {
        assert.strictEqual(mapErrorReport('i', { deviceModel: { marketingName: 'X' } }).crashThread, undefined);
    });
});

suite('play-reporting-mappers: label/id helpers', () => {
    test('deviceModelLabel prefers marketingName, falls back to brand+device, else undefined', () => {
        assert.strictEqual(deviceModelLabel({ marketingName: 'Galaxy S24' }), 'Galaxy S24');
        assert.strictEqual(deviceModelLabel({ deviceId: { buildBrand: 'google', buildDevice: 'shiba' } }), 'google shiba');
        assert.strictEqual(deviceModelLabel(undefined), undefined);
        assert.strictEqual(deviceModelLabel({}), undefined);
    });

    test('osVersionLabel formats apiLevel or returns undefined', () => {
        assert.strictEqual(osVersionLabel({ apiLevel: '33' }), 'API 33');
        assert.strictEqual(osVersionLabel(undefined), undefined);
        assert.strictEqual(osVersionLabel({}), undefined);
    });

    test('issueShortId returns the last path segment', () => {
        assert.strictEqual(issueShortId('apps/com.x/errorIssues/4567'), '4567');
        assert.strictEqual(issueShortId('4567'), '4567');
    });

    test('issueKind maps the Play type enum to a tab category', () => {
        assert.strictEqual(issueKind('CRASH'), 'crash');
        assert.strictEqual(issueKind('APPLICATION_NOT_RESPONDING'), 'anr');
        assert.strictEqual(issueKind('NON_FATAL'), 'nonfatal');
        assert.strictEqual(issueKind('ERROR_TYPE_UNSPECIFIED'), 'unknown');
    });
});
