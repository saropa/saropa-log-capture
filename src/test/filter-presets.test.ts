import * as assert from 'assert';
import { builtInPresets, FilterPreset } from '../modules/filter-presets';

suite('FilterPresets', () => {

    suite('builtInPresets', () => {
        test('should have at least one built-in preset', () => {
            assert.ok(builtInPresets.length > 0);
        });

        test('should have valid preset structure', () => {
            for (const preset of builtInPresets) {
                assert.ok(preset.name, 'Preset must have a name');
                assert.ok(preset.name.length > 0, 'Preset name must not be empty');
            }
        });

        test('should include Errors Only preset', () => {
            const errorsOnly = builtInPresets.find(p => p.name === 'Errors Only');
            assert.ok(errorsOnly, 'Should have Errors Only preset');
            assert.ok(errorsOnly.levels, 'Errors Only should have levels filter');
        });
    });

    suite('FilterPreset interface', () => {
        test('should allow minimal preset with just name', () => {
            const preset: FilterPreset = { name: 'Test' };
            assert.strictEqual(preset.name, 'Test');
            assert.strictEqual(preset.categories, undefined);
            assert.strictEqual(preset.searchPattern, undefined);
        });

        test('should allow preset with all fields', () => {
            const preset: FilterPreset = {
                name: 'Full Preset',
                categories: ['stderr', 'console'],
                searchPattern: '/error/i',
                exclusionsEnabled: true,
            };
            assert.strictEqual(preset.name, 'Full Preset');
            assert.deepStrictEqual(preset.categories, ['stderr', 'console']);
            assert.strictEqual(preset.searchPattern, '/error/i');
            assert.strictEqual(preset.exclusionsEnabled, true);
        });
    });
});
