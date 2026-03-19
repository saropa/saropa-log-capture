import * as assert from 'node:assert';
import {
    extractHeadings,
    extractTokensFromArb,
    extractTokensFromGradle,
    extractTokensFromJson,
    extractTokensFromKeyValueText,
    extractTokensFromMarkdown,
    extractTokensFromRules,
    extractTokensFromSql,
    extractTokensFromStructuredText,
    extractTokensFromText,
    extractTokensFromToml,
    extractTokensFromXml,
    extractTokensFromYaml,
} from '../../../modules/project-indexer/token-extractor';

suite('Token Extractor Core', () => {
    suite('extractHeadings', () => {
        test('extracts H1–H3 with 1-based line numbers', () => {
            const md = '# Title\n\n## Section\n\n### Sub\n';
            const h = extractHeadings(md);
            assert.strictEqual(h.length, 3);
            assert.strictEqual(h[0].level, 1);
            assert.strictEqual(h[0].text, 'Title');
            assert.strictEqual(h[0].line, 1);
            assert.strictEqual(h[1].level, 2);
            assert.strictEqual(h[1].text, 'Section');
            assert.strictEqual(h[1].line, 3);
            assert.strictEqual(h[2].level, 3);
            assert.strictEqual(h[2].text, 'Sub');
            assert.strictEqual(h[2].line, 5);
        });
        test('returns empty for plain text', () => {
            assert.strictEqual(extractHeadings('no headings here').length, 0);
        });
    });

    suite('extractTokensFromText', () => {
        test('lowercases and dedupes', () => {
            const t = extractTokensFromText('Hello World hello');
            assert.ok(t.includes('hello'));
            assert.ok(t.includes('world'));
            assert.strictEqual(t.filter(x => x === 'hello').length, 1);
        });
        test('skips short and stop words', () => {
            const t = extractTokensFromText('the is and ab');
            assert.strictEqual(t.includes('the'), false);
            assert.strictEqual(t.includes('ab'), false);
        });
    });

    suite('extractTokensFromMarkdown', () => {
        test('returns tokens and headings', () => {
            const md = '# Firebase\n\nUse **Firebase** for auth.';
            const { tokens, headings } = extractTokensFromMarkdown(md);
            assert.strictEqual(headings.length, 1);
            assert.strictEqual(headings[0].text, 'Firebase');
            assert.ok(tokens.includes('firebase'));
        });
    });

    suite('extractTokensFromJson', () => {
        test('extracts keys, key paths, and string values', () => {
            const json = JSON.stringify({
                scripts: { build: 'tsc -p .' },
                dependencies: { vscode: '^1.100.0' },
                firebase: { projectId: 'demo-project' },
            });
            const tokens = extractTokensFromJson(json);
            assert.ok(tokens.includes('scripts'));
            assert.ok(tokens.includes('scripts.build'));
            assert.ok(tokens.includes('build'));
            assert.ok(tokens.includes('dependencies'));
            assert.ok(tokens.includes('firebase.projectid'));
            assert.ok(tokens.includes('demo'));
            assert.ok(tokens.includes('project'));
        });

        test('falls back to text tokenization for invalid json', () => {
            const tokens = extractTokensFromJson('{ "name": "saropa", ');
            assert.ok(tokens.includes('name'));
            assert.ok(tokens.includes('saropa'));
        });
    });

    suite('extractTokensFromYaml', () => {
        test('extracts keys, key paths, and string values', () => {
            const yaml = [
                'firebase:',
                '  projectId: demo-project',
                '  app:',
                '    name: "demo app"',
                'scripts:',
                '  build: tsc -p .',
            ].join('\n');
            const tokens = extractTokensFromYaml(yaml);
            assert.ok(tokens.includes('firebase'));
            assert.ok(tokens.includes('firebase.projectid'));
            assert.ok(tokens.includes('firebase.app.name'));
            assert.ok(tokens.includes('scripts.build'));
            assert.ok(tokens.includes('demo'));
            assert.ok(tokens.includes('app'));
        });
    });

    suite('extractTokensFromToml', () => {
        test('extracts tables, keys, key paths, and string values', () => {
            const toml = [
                '[tool.poetry]',
                'name = "saropa-log-capture"',
                'version = "3.9.0"',
                '',
                '[tool.poetry.dependencies]',
                'python = "^3.11"',
                'requests = "^2.31"',
            ].join('\n');
            const tokens = extractTokensFromToml(toml);
            assert.ok(tokens.includes('tool.poetry'));
            assert.ok(tokens.includes('tool.poetry.name'));
            assert.ok(tokens.includes('tool.poetry.dependencies.requests'));
            assert.ok(tokens.includes('saropa'));
            assert.ok(tokens.includes('capture'));
        });
    });

    suite('extractTokensFromArb', () => {
        test('extracts message keys and values', () => {
            const arb = JSON.stringify({
                helloMessage: 'Hello world',
                '@helloMessage': { description: 'Greeting' },
            });
            const tokens = extractTokensFromArb(arb);
            assert.ok(tokens.includes('hellomessage'));
            assert.ok(tokens.includes('hello'));
            assert.ok(tokens.includes('greeting'));
        });
    });

    suite('extractTokensFromRules', () => {
        test('extracts match paths and allow clauses', () => {
            const rules = [
                'service cloud.firestore {',
                '  match /databases/{database}/documents {',
                '    match /users/{userId} {',
                '      allow read, write: if request.auth != null;',
                '    }',
                '  }',
                '}',
            ].join('\n');
            const tokens = extractTokensFromRules(rules);
            assert.ok(tokens.includes('databases'));
            assert.ok(tokens.includes('documents'));
            assert.ok(tokens.includes('users'));
            assert.ok(tokens.includes('write'));
        });
    });

    suite('extractTokensFromXml', () => {
        test('extracts tags and attributes', () => {
            const xml = '<manifest package="com.example.app"><uses-permission android:name="android.permission.INTERNET" /></manifest>';
            const tokens = extractTokensFromXml(xml);
            assert.ok(tokens.includes('manifest'));
            assert.ok(tokens.includes('package'));
            assert.ok(tokens.includes('example'));
            assert.ok(tokens.includes('permission'));
        });
    });

    suite('extractTokensFromGradle', () => {
        test('extracts dependency coordinates and plugin ids', () => {
            const gradle = [
                'plugins { id "com.android.application" }',
                'dependencies {',
                '  implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.0"',
                '}',
            ].join('\n');
            const tokens = extractTokensFromGradle(gradle);
            assert.ok(tokens.includes('com.android.application'));
            assert.ok(tokens.includes('org.jetbrains.kotlin:kotlin-stdlib:1.9.0'));
            assert.ok(tokens.includes('kotlin'));
        });
    });

    suite('extractTokensFromStructuredText', () => {
        test('extracts heading and body tokens', () => {
            const doc = [
                'Getting Started',
                '===============',
                '',
                'Install package and run setup.',
            ].join('\n');
            const tokens = extractTokensFromStructuredText(doc);
            assert.ok(tokens.includes('getting'));
            assert.ok(tokens.includes('started'));
            assert.ok(tokens.includes('install'));
            assert.ok(tokens.includes('setup'));
        });
    });

    suite('extractTokensFromKeyValueText', () => {
        test('extracts keys and values from env/properties style files', () => {
            const content = [
                '# comment',
                'API_BASE_URL=https://api.example.com',
                'feature.flag=true',
                '[database]',
                'host=localhost',
            ].join('\n');
            const tokens = extractTokensFromKeyValueText(content);
            assert.ok(tokens.includes('api'));
            assert.ok(tokens.includes('base'));
            assert.ok(tokens.includes('url'));
            assert.ok(tokens.includes('example'));
            assert.ok(tokens.includes('feature'));
            assert.ok(tokens.includes('flag'));
            assert.ok(tokens.includes('database'));
            assert.ok(tokens.includes('localhost'));
        });
    });

    suite('extractTokensFromSql', () => {
        test('extracts table hints and query terms', () => {
            const sql = 'SELECT * FROM users u JOIN orders o ON u.id=o.user_id; CREATE TABLE audit_logs(id INT);';
            const tokens = extractTokensFromSql(sql);
            assert.ok(tokens.includes('users'));
            assert.ok(tokens.includes('orders'));
            assert.ok(tokens.includes('audit_logs'));
        });
    });
});
