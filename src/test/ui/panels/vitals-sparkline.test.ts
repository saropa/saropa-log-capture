/**
 * Tests for the pure sparkline renderer used by the Vitals panel (and the per-issue trend chart).
 * Pins the "too few points → empty", flat-series, and value→geometry (higher value = higher line)
 * behavior so a future tweak to the SVG math is caught here rather than as a silently wrong chart.
 *
 * Uses the `node:test` API (not the Extension-Host Mocha `suite` globals) so the file runs standalone
 * via `node --test out/test/ui/panels/vitals-sparkline.test.js` — fast, no VS Code dependency.
 */

import { test } from 'node:test';
import * as assert from 'assert';
import { renderSparkline } from '../../../ui/panels/vitals-sparkline';

test('renderSparkline: returns empty string for undefined / fewer than two points', () => {
    assert.strictEqual(renderSparkline(undefined), '');
    assert.strictEqual(renderSparkline([]), '');
    assert.strictEqual(renderSparkline([1.5]), '');
});

test('renderSparkline: renders one polyline point per series value', () => {
    const svg = renderSparkline([1, 2, 3, 4]);
    assert.ok(svg.startsWith('<svg'), 'should produce an svg');
    const points = (svg.match(/points="([^"]+)"/) ?? [])[1] ?? '';
    assert.strictEqual(points.trim().split(/\s+/).length, 4);
});

test('renderSparkline: inverts y so a higher value sits higher (smaller y) in the box', () => {
    // Ascending series: first value (lowest) should have the largest y, last (highest) the smallest.
    const svg = renderSparkline([0, 10], 80, 18);
    const coords = ((svg.match(/points="([^"]+)"/) ?? [])[1] ?? '')
        .trim().split(/\s+/).map(p => Number(p.split(',')[1]));
    assert.ok(coords[0] > coords[1], `first y (${coords[0]}) should be below last y (${coords[1]})`);
});

test('renderSparkline: flat series does not divide by zero and stays within the box', () => {
    const svg = renderSparkline([5, 5, 5], 80, 18);
    const ys = ((svg.match(/points="([^"]+)"/) ?? [])[1] ?? '')
        .trim().split(/\s+/).map(p => Number(p.split(',')[1]));
    ys.forEach(y => assert.ok(Number.isFinite(y) && y >= 0 && y <= 18, `y ${y} in range`));
});
