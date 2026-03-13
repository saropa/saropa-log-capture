/**
 * Unit tests for share/gist-importer (importFromUrl validation and error messages).
 */

import * as assert from 'assert';
import { importFromUrl } from '../../../modules/share/gist-importer';
import type { InvestigationStore } from '../../../modules/investigation/investigation-store';

suite('GistImporter', () => {
    suite('importFromUrl', () => {
        test('rejects non-https URL', async () => {
            const store = {} as InvestigationStore;
            await assert.rejects(
                () => importFromUrl('http://example.com/investigation.slc', store),
                (err: Error) => err.message.includes('https'),
            );
        });

        test('rejects invalid URL', async () => {
            const store = {} as InvestigationStore;
            await assert.rejects(
                () => importFromUrl('not-a-url', store),
                (err: Error) => err.message.includes('https'),
            );
        });
    });
});
