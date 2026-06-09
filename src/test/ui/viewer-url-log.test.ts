/**
 * Pins the URL gate for "Open log from URL" / dropped web links: only http(s) is accepted, so a
 * file:/data:/ftp: or junk string can never reach the downloader.
 */
import * as assert from 'assert';
import { isDownloadableUrl } from '../../ui/provider/viewer-url-log';

suite('viewer-url-log: isDownloadableUrl', () => {
    test('accepts http and https URLs', () => {
        assert.strictEqual(isDownloadableUrl('http://example.com/a.log'), true);
        assert.strictEqual(isDownloadableUrl('https://example.com/path/to/file.log'), true);
        assert.strictEqual(isDownloadableUrl('  https://example.com/a.log  '), true, 'trims surrounding space');
        assert.strictEqual(isDownloadableUrl('HTTPS://EXAMPLE.COM/A.LOG'), true, 'scheme is case-insensitive');
    });

    test('rejects non-http schemes and junk', () => {
        assert.strictEqual(isDownloadableUrl('file:///d:/x.log'), false);
        assert.strictEqual(isDownloadableUrl('ftp://example.com/a.log'), false);
        assert.strictEqual(isDownloadableUrl('data:text/plain,hi'), false);
        assert.strictEqual(isDownloadableUrl('javascript:alert(1)'), false);
        assert.strictEqual(isDownloadableUrl('example.com/a.log'), false, 'scheme required');
        assert.strictEqual(isDownloadableUrl(''), false);
        assert.strictEqual(isDownloadableUrl('https://'), false, 'needs a host/path after scheme');
    });
});
