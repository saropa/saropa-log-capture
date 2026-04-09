import * as assert from 'assert';
import { scoreAsciiArtLine } from '../../../modules/analysis/ascii-art-score';

suite('scoreAsciiArtLine (plan 046)', () => {
    suite('should score high for ASCII art patterns', () => {
        test('consonant-heavy shading (MMMM block) scores above zero', () => {
            // Pure consonant block: consonant cluster + repeated chars
            assert.ok(scoreAsciiArtLine('QMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNhs') >= 25);
        });

        test('mixed punctuation art', () => {
            assert.ok(scoreAsciiArtLine('`-+shdmNMMMMNmdhs+-') >= 40);
        });

        test('gradient shading line with backticks', () => {
            assert.ok(scoreAsciiArtLine('/dMMMMMM/`            ````````') >= 40);
        });

        test('dense symbol line', () => {
            assert.ok(scoreAsciiArtLine('.+NMMMMMMMMMN') >= 40);
        });

        test('repeated heavy chars (@@@@@)', () => {
            assert.ok(scoreAsciiArtLine('@@@@@@@@@@@@@@@@@@@@@') >= 40);
        });

        test('light fill line (dots/dashes)', () => {
            assert.ok(scoreAsciiArtLine('..............++++++++++..............') >= 40);
        });

        test('long single-token art line (low token count)', () => {
            // 1 token, 33 chars — consonant + repeat + low-token bonus
            assert.ok(scoreAsciiArtLine('QMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNhs') >= 50);
        });

        test('long line with two tokens still gets low-token bonus', () => {
            assert.ok(scoreAsciiArtLine('-odMMMNyo/-..````.++:+o+/-  extra') >= 40);
        });
    });

    suite('should score low for normal log lines', () => {
        test('plain English log message', () => {
            assert.ok(scoreAsciiArtLine('Starting application on port 8080') < 40);
        });

        test('stack trace line', () => {
            assert.ok(scoreAsciiArtLine('#0  package:foo/main.dart  foo (package:foo/a.dart:1:1)') < 40);
        });

        test('JSON payload', () => {
            assert.ok(scoreAsciiArtLine('{"user_id": 123, "action": "login"}') < 40);
        });

        test('URL line', () => {
            assert.ok(scoreAsciiArtLine('https://api.example.com/v2/users?page=1') < 40);
        });

        test('Dart package path', () => {
            assert.ok(scoreAsciiArtLine('package:flutter/src/widgets/framework.dart:4587:20') < 40);
        });

        test('normal Drift SQL line', () => {
            assert.ok(scoreAsciiArtLine('Drift: Sent SELECT * FROM "contacts" with args []') < 40);
        });

        test('multi-word log line should not get low-token bonus', () => {
            // 7 tokens — low-token heuristic must not fire
            assert.ok(scoreAsciiArtLine('Connection failed for user id 12345 retry') < 40);
        });

        test('base64 encoded string', () => {
            assert.ok(scoreAsciiArtLine('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') < 40);
        });
    });

    suite('edge cases', () => {
        test('empty string returns 0', () => {
            assert.strictEqual(scoreAsciiArtLine(''), 0);
        });

        test('very short string returns 0', () => {
            assert.strictEqual(scoreAsciiArtLine('ab'), 0);
        });

        test('single space returns 0', () => {
            assert.strictEqual(scoreAsciiArtLine(' '), 0);
        });
    });
});
