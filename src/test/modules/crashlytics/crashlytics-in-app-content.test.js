"use strict";
/**
 * Unit tests for in-app Crashlytics content (troubleshooting table and help sections).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const crashlytics_troubleshooting_1 = require("../../../modules/crashlytics/crashlytics-troubleshooting");
const crashlytics_help_content_1 = require("../../../modules/crashlytics/crashlytics-help-content");
suite('crashlytics-troubleshooting', () => {
    test('CRASHLYTICS_TROUBLESHOOTING_TABLE has five rows with symptom, cause, fix', () => {
        assert.strictEqual(crashlytics_troubleshooting_1.CRASHLYTICS_TROUBLESHOOTING_TABLE.length, 5);
        for (const row of crashlytics_troubleshooting_1.CRASHLYTICS_TROUBLESHOOTING_TABLE) {
            assert.ok(typeof row.symptom === 'string' && row.symptom.length > 0, 'symptom');
            assert.ok(typeof row.cause === 'string' && row.cause.length > 0, 'cause');
            assert.ok(typeof row.fix === 'string' && row.fix.length > 0, 'fix');
        }
    });
    test('getTroubleshootingRowsForStep returns one row per step', () => {
        const gcloud = (0, crashlytics_troubleshooting_1.getTroubleshootingRowsForStep)('gcloud');
        const token = (0, crashlytics_troubleshooting_1.getTroubleshootingRowsForStep)('token');
        const config = (0, crashlytics_troubleshooting_1.getTroubleshootingRowsForStep)('config');
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
        const sections = (0, crashlytics_help_content_1.getCrashlyticsHelpSections)();
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
        const sections = (0, crashlytics_help_content_1.getCrashlyticsHelpSections)();
        for (const s of sections) {
            assert.ok(!/<\s*script/i.test(s.html), `Section "${s.title}" should not contain raw script tags`);
        }
    });
});
//# sourceMappingURL=crashlytics-in-app-content.test.js.map