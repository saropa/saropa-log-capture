import * as assert from 'assert';
import { pathToLabel } from '../../../modules/integrations/external-log-tailer';

suite('external-log-tailer', () => {
    suite('pathToLabel', () => {
        test('uses last path segment without extension', () => {
            assert.strictEqual(pathToLabel('logs/app.log'), 'app');
        });
        test('flattens nested path with underscores', () => {
            assert.strictEqual(pathToLabel('logs/nginx/error.log'), 'logs_nginx_error');
        });
        test('returns external for empty stem', () => {
            assert.strictEqual(pathToLabel('.log'), 'external');
        });
    });
});
