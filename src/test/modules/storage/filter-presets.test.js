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
const filter_presets_1 = require("../../../modules/storage/filter-presets");
suite('FilterPresets', () => {
    suite('builtInPresets', () => {
        test('should have at least one built-in preset', () => {
            assert.ok(filter_presets_1.builtInPresets.length > 0);
        });
        test('should have valid preset structure', () => {
            for (const preset of filter_presets_1.builtInPresets) {
                assert.ok(preset.name, 'Preset must have a name');
                assert.ok(preset.name.length > 0, 'Preset name must not be empty');
            }
        });
        test('should include Errors Only preset', () => {
            const errorsOnly = filter_presets_1.builtInPresets.find(p => p.name === 'Errors Only');
            assert.ok(errorsOnly, 'Should have Errors Only preset');
            assert.ok(errorsOnly.levels, 'Errors Only should have levels filter');
        });
        test('should include Just debug output and Complete (all sources) presets', () => {
            const justDebug = filter_presets_1.builtInPresets.find(p => p.name === 'Just debug output');
            assert.ok(justDebug, 'Should have Just debug output preset');
            assert.deepStrictEqual(justDebug.sources, ['debug']);
            const complete = filter_presets_1.builtInPresets.find(p => p.name === 'Complete (all sources)');
            assert.ok(complete, 'Should have Complete (all sources) preset');
            assert.deepStrictEqual(complete.sources, []);
        });
    });
    suite('FilterPreset interface', () => {
        test('should allow minimal preset with just name', () => {
            const preset = { name: 'Test' };
            assert.strictEqual(preset.name, 'Test');
            assert.strictEqual(preset.categories, undefined);
            assert.strictEqual(preset.searchPattern, undefined);
        });
        test('should allow preset with all fields', () => {
            const preset = {
                name: 'Full Preset',
                categories: ['stderr', 'console'],
                searchPattern: '/error/i',
                exclusionsEnabled: true,
                sources: ['debug'],
            };
            assert.strictEqual(preset.name, 'Full Preset');
            assert.deepStrictEqual(preset.categories, ['stderr', 'console']);
            assert.strictEqual(preset.searchPattern, '/error/i');
            assert.strictEqual(preset.exclusionsEnabled, true);
            assert.deepStrictEqual(preset.sources, ['debug']);
        });
    });
});
//# sourceMappingURL=filter-presets.test.js.map