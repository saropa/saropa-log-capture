/**
 * Unit tests for in-app Crashlytics content (troubleshooting table and help sections).
 */

import * as assert from 'assert';
import {
    CRASHLYTICS_TROUBLESHOOTING_TABLE,
    getTroubleshootingRowsForStep,
} from '../../../modules/crashlytics/crashlytics-troubleshooting';
import { getCrashlyticsHelpSections } from '../../../modules/crashlytics/crashlytics-help-content';

suite('crashlytics-troubleshooting', () => {
    test('CRASHLYTICS_TROUBLESHOOTING_TABLE has five rows with symptom, cause, fix', () => {
        assert.strictEqual(CRASHLYTICS_TROUBLESHOOTING_TABLE.length, 5);
        for (const row of CRASHLYTICS_TROUBLESHOOTING_TABLE) {
            assert.ok(typeof row.symptom === 'string' && row.symptom.length > 0, 'symptom');
            assert.ok(typeof row.cause === 'string' && row.cause.length > 0, 'cause');
            assert.ok(typeof row.fix === 'string' && row.fix.length > 0, 'fix');
        }
    });

    test('getTroubleshootingRowsForStep returns one row per step', () => {
        const gcloud = getTroubleshootingRowsForStep('gcloud');
        const token = getTroubleshootingRowsForStep('token');
        const config = getTroubleshootingRowsForStep('config');
        assert.strictEqual(gcloud.length, 1, 'gcloud');
        assert.strictEqual(token.length, 1, 'token');
        assert.strictEqual(config.length, 1, 'config');
        assert.ok(gcloud[0].symptom.includes('gcloud') || gcloud[0].symptom.includes('Install'), 'gcloud row');
        assert.ok(token[0].symptom.includes('login') || token[0].cause.includes('ADC'), 'token row');
        assert.ok(config[0].symptom.includes('google-services') || config[0].cause.includes('project'), 'config row');
    });
});

suite('crashlytics-help-content', () => {
    test('getCrashlyticsHelpSections returns expected sections with title and html', () => {
        const sections = getCrashlyticsHelpSections();
        const expectedTitles = [
            'Overview',
            'Prerequisites',
            'Authentication',
            'Project configuration',
            'What it queries',
            'Caching',
            'Troubleshooting',
            'Architecture',
        ];
        assert.strictEqual(sections.length, expectedTitles.length);
        for (let i = 0; i < expectedTitles.length; i++) {
            assert.strictEqual(sections[i].title, expectedTitles[i]);
            assert.ok(typeof sections[i].html === 'string' && sections[i].html.length > 0);
        }
    });

    test('Help section html is safe (no unescaped script-like content)', () => {
        const sections = getCrashlyticsHelpSections();
        for (const s of sections) {
            assert.ok(!/<\s*script/i.test(s.html), `Section "${s.title}" should not contain raw script tags`);
        }
    });
});
