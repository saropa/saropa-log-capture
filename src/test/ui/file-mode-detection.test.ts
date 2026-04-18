import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { detectFileMode } from '../../ui/provider/log-viewer-provider-load';
import type { FileMode } from '../../ui/provider/log-viewer-provider-load';

suite('detectFileMode (plan 051)', () => {

    /** Helper: build a URI from a filename and detect its mode. */
    function detect(filename: string): FileMode {
        return detectFileMode(vscode.Uri.file(`/tmp/reports/${filename}`));
    }

    test('should return log for .log files', () => {
        assert.strictEqual(detect('session.log'), 'log');
    });

    test('should return log for .txt files', () => {
        assert.strictEqual(detect('notes.txt'), 'log');
    });

    test('should return markdown for .md files', () => {
        assert.strictEqual(detect('README.md'), 'markdown');
    });

    test('should return markdown for .MD (case insensitive)', () => {
        assert.strictEqual(detect('ABOUT.MD'), 'markdown');
    });

    test('should return json for .json files', () => {
        assert.strictEqual(detect('config.json'), 'json');
    });

    test('should return json for .jsonl files', () => {
        assert.strictEqual(detect('events.jsonl'), 'json');
    });

    test('should return csv for .csv files', () => {
        assert.strictEqual(detect('data.csv'), 'csv');
    });

    test('should return html for .html files', () => {
        assert.strictEqual(detect('report.html'), 'html');
    });

    test('should return html for .htm files', () => {
        assert.strictEqual(detect('page.htm'), 'html');
    });

    test('should return log for unknown extensions', () => {
        assert.strictEqual(detect('output.xml'), 'log');
    });

    test('should return log for files with no extension', () => {
        assert.strictEqual(detect('Makefile'), 'log');
    });

    test('should handle dotfiles gracefully', () => {
        /* .gitignore → extension is "gitignore", not a known mode */
        assert.strictEqual(detect('.gitignore'), 'log');
    });

    test('should handle compound extensions (uses last segment)', () => {
        /* session.unified.jsonl → extension is "jsonl" */
        assert.strictEqual(detect('session.unified.jsonl'), 'json');
    });
});
