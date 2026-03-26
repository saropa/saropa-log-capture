"use strict";
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
const session_templates_1 = require("../../../modules/session/session-templates");
suite('SessionTemplates', () => {
    suite('builtInTemplates', () => {
        test('should have Flutter, Node.js, and Python templates', () => {
            const names = session_templates_1.builtInTemplates.map(t => t.name);
            assert.ok(names.includes('Flutter'));
            assert.ok(names.includes('Node.js'));
            assert.ok(names.includes('Python'));
        });
        test('should have valid template structure', () => {
            for (const template of session_templates_1.builtInTemplates) {
                assert.ok(template.name, 'Template must have a name');
                assert.ok(template.createdAt, 'Template must have createdAt');
            }
        });
        test('Flutter template should have hot reload split keywords', () => {
            const flutter = session_templates_1.builtInTemplates.find(t => t.name === 'Flutter');
            assert.ok(flutter);
            assert.ok(flutter.splitRules?.keywords?.some(k => k.includes('hot')));
        });
    });
    suite('SessionTemplate interface', () => {
        test('should allow minimal template with just name', () => {
            const template = {
                name: 'Test',
                createdAt: new Date().toISOString(),
            };
            assert.strictEqual(template.name, 'Test');
            assert.strictEqual(template.watchPatterns, undefined);
        });
        test('should allow template with all fields', () => {
            const template = {
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
            const template = (0, session_templates_1.createTemplateFromSettings)('My Template', 'Test description');
            assert.strictEqual(template.name, 'My Template');
            assert.strictEqual(template.description, 'Test description');
            assert.ok(template.createdAt);
        });
        test('should create template without description', () => {
            const template = (0, session_templates_1.createTemplateFromSettings)('Simple');
            assert.strictEqual(template.name, 'Simple');
            assert.strictEqual(template.description, undefined);
        });
    });
});
//# sourceMappingURL=session-templates.test.js.map