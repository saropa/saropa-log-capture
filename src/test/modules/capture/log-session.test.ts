import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { LogSession } from '../../../modules/capture/log-session';
import { defaultSplitRules } from '../../../modules/misc/file-splitter';

function makeSessionConfig(logDir: string, maxLines = 1000): any {
  return {
    includeTimestamp: true,
    includeSourceLocation: false,
    includeElapsedTime: false,
    logDirectory: logDir,
    redactEnvVars: [],
    splitRules: defaultSplitRules(),
    maxLines,
  };
}

function makeSessionContext(workspaceRoot: string): any {
  return {
    date: new Date('2026-03-23T10:00:00.000Z'),
    projectName: 'queue-test',
    debugAdapterType: 'dart',
    configurationName: 'debug',
    configuration: {},
    vscodeVersion: '1.105.0',
    extensionVersion: '3.12.1',
    os: process.platform,
    workspaceFolder: { uri: vscode.Uri.file(workspaceRoot), name: 'ws', index: 0 },
  };
}

suite('LogSession queue safety', () => {
  test('stop drains queued lines before closing stream', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-session-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();
    for (let i = 0; i < 40; i++) {
      session.appendLine(`queued-line-${i}`, 'console', new Date(`2026-03-23T10:00:${String(i % 60).padStart(2, '0')}.000Z`));
    }
    await session.stop();

    const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
    for (let i = 0; i < 40; i++) {
      assert.ok(body.includes(`queued-line-${i}`), `expected queued-line-${i} to be written before stop`);
    }
  });

  test('maxLines rotates parts and preserves newest lines', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-split-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 3), () => {});
    await session.start();
    for (let i = 0; i < 7; i++) {
      session.appendLine(`roll-line-${i}`, 'console', new Date(`2026-03-23T10:01:${String(i % 60).padStart(2, '0')}.000Z`));
    }
    await session.stop();

    const dir = path.dirname(session.fileUri.fsPath);
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.log')).sort();
    assert.ok(names.length >= 3, 'expected split parts to be created');

    let merged = '';
    for (const name of names) {
      merged += await fs.readFile(path.join(dir, name), 'utf-8');
    }
    for (let i = 0; i < 7; i++) {
      assert.ok(merged.includes(`roll-line-${i}`), `expected roll-line-${i} across split parts`);
    }
  });
});

