/**
 * Tests that the error-classification message handler guards against
 * null/undefined severityKeywords before assigning to the global variable.
 *
 * Bug 003: msg.severityKeywords could propagate a falsy value into
 * currentSeverityKeywords, causing a TypeError on later property access
 * (typeof null === 'object', so a typeof guard does not catch it).
 */
import * as assert from 'node:assert';
import { getErrorClassificationScript } from '../../ui/viewer-decorations/viewer-error-classification';

suite('ErrorClassification null-safety', () => {
    const script = getErrorClassificationScript();

    test('severityKeywords assignment coerces falsy values to null', () => {
        // The assignment must use `|| null` so that undefined or falsy
        // msg.severityKeywords is stored as null, which downstream
        // truthiness guards (currentSeverityKeywords && ...) handle safely.
        assert.ok(
            script.includes('currentSeverityKeywords = msg.severityKeywords || null'),
            'Must coerce falsy severityKeywords to null for downstream truthiness guards',
        );
    });

    test('severityKeywords assignment does not use bare typeof guard before property access', () => {
        // A bare typeof guard passes for null — must not be the sole protection
        // before bracket/dot access on currentSeverityKeywords.
        assert.ok(
            !script.includes("typeof currentSeverityKeywords !== 'undefined' && currentSeverityKeywords["),
            'Must NOT rely on typeof guard alone for null-initialized variable property access',
        );
    });
});
