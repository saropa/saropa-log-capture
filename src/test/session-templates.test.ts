import * as assert from 'assert';
import { builtInTemplates, createTemplateFromSettings, SessionTemplate } from '../modules/session-templates';

suite('SessionTemplates', () => {

    suite('builtInTemplates', () => {
        test('should have Flutter, Node.js, and Python templates', () => {
            const names = builtInTemplates.map(t => t.name);
            assert.ok(names.includes('Flutter'));
            assert.ok(names.includes('Node.js'));
            assert.ok(names.includes('Python'));
        });

        test('should have valid template structure', () => {
            for (const template of builtInTemplates) {
                assert.ok(template.name, 'Template must have a name');
                assert.ok(template.createdAt, 'Template must have createdAt');
            }
        });

        test('Flutter template should have hot reload split keywords', () => {
            const flutter = builtInTemplates.find(t => t.name === 'Flutter');
            assert.ok(flutter);
            assert.ok(flutter.splitRules?.keywords?.some(k => k.includes('hot')));
        });
    });

    suite('SessionTemplate interface', () => {
        test('should allow minimal template with just name', () => {
            const template: SessionTemplate = {
                name: 'Test',
                createdAt: new Date().toISOString(),
            };
            assert.strictEqual(template.name, 'Test');
            assert.strictEqual(template.watchPatterns, undefined);
        });

        test('should allow template with all fields', () => {
            const template: SessionTemplate = {
                name: 'Full Template',
                description: 'A complete template',
                createdAt: new Date().toISOString(),
                watchPatterns: [{ pattern: 'error', alertType: 'flash' }],
                exclusions: ['verbose'],
                filterPresets: [{ name: 'Errors', searchPattern: '/error/i' }],
                autoTagRules: [{ pattern: 'crash', tag: 'crash' }],
                splitRules: { maxLines: 10000 },
                highlightRules: [{ pattern: 'error', color: 'red' }],
            };
            assert.strictEqual(template.name, 'Full Template');
            assert.strictEqual(template.watchPatterns?.length, 1);
            assert.strictEqual(template.exclusions?.length, 1);
        });
    });

    suite('createTemplateFromSettings', () => {
        test('should create template with name and description', () => {
            const template = createTemplateFromSettings('My Template', 'Test description');
            assert.strictEqual(template.name, 'My Template');
            assert.strictEqual(template.description, 'Test description');
            assert.ok(template.createdAt);
        });

        test('should create template without description', () => {
            const template = createTemplateFromSettings('Simple');
            assert.strictEqual(template.name, 'Simple');
            assert.strictEqual(template.description, undefined);
        });
    });
});
