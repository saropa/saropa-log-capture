import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { executeLoadContent } from '../../ui/provider/log-viewer-provider-load';

function makeHeader(dateIso: string): string {
  return [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    `Date:           ${dateIso}`,
    'Project:        demo',
    '==========================================',
    '',
  ].join('\n');
}

suite('log viewer provider load', () => {
  test('loads split parts so level filters see full session', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-viewer-load-'));
    const logDir = path.join(tmpDir, 'reports', '20260323');
    await fs.mkdir(logDir, { recursive: true });

    const base = '20260323_120000_demo';
    const part1 = path.join(logDir, `${base}.log`);
    const part2 = path.join(logDir, `${base}_002.log`);
    await fs.writeFile(part1, makeHeader('2026-03-23T12:00:00.000Z') + '[12:00:01.000] [console] first-part\n', 'utf-8');
    await fs.writeFile(part2, makeHeader('2026-03-23T12:10:00.000Z') + '[12:10:01.000] [console] second-part-error\n', 'utf-8');

    const messages: unknown[] = [];
    const target = {
      postMessage: (msg: unknown) => { messages.push(msg); },
      setFilename: (_name: string) => {},
      setSessionInfo: (_info: Record<string, string> | null) => {},
      getSeenCategories: () => new Set<string>(),
      setHasPerformanceData: (_has: boolean) => {},
      setCodeQualityPayload: (_payload: unknown) => {},
    };

    const result = await executeLoadContent(target, vscode.Uri.file(part1), () => true);
    assert.ok(result.contentLength >= 2, 'expected content from both split parts');

    const setMax = messages.find((m) => typeof m === 'object' && m !== null && (m as Record<string, unknown>).type === 'setMaxLines') as Record<string, unknown> | undefined;
    assert.ok(setMax, 'expected setMaxLines message when loading full-session content');
    assert.ok(typeof setMax.maxLines === 'number' && setMax.maxLines >= 2, 'expected raised maxLines for full-session data');

    const addLines = messages
      .filter((m) => typeof m === 'object' && m !== null && (m as Record<string, unknown>).type === 'addLines')
      .flatMap((m) => ((m as Record<string, unknown>).lines as Array<Record<string, unknown>>) ?? []);
    const texts = addLines
      .map((l) => l.text)
      .filter((v): v is string => typeof v === 'string');
    assert.ok(texts.some((t) => t.includes('first-part')), 'expected first split part line');
    assert.ok(texts.some((t) => t.includes('second-part-error')), 'expected second split part line');
  });

  test('emits setSessionHeaderLines with the raw header block so the info modal can render it', async () => {
    /* The (i) info modal reads window.__sessionHeaderLines populated by this
       message. If executeLoadContent stops emitting it, the icon stays hidden
       and the modal renders empty even when the file has a proper header. */
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-viewer-load-hdr-'));
    const logDir = path.join(tmpDir, 'reports', '20260323');
    await fs.mkdir(logDir, { recursive: true });

    const logPath = path.join(logDir, '20260323_120000_demo.log');
    await fs.writeFile(logPath, makeHeader('2026-03-23T12:00:00.000Z') + '[12:00:01.000] [console] body\n', 'utf-8');

    const messages: unknown[] = [];
    const target = {
      postMessage: (msg: unknown) => { messages.push(msg); },
      setFilename: (_name: string) => {},
      setSessionInfo: (_info: Record<string, string> | null) => {},
      getSeenCategories: () => new Set<string>(),
      setHasPerformanceData: (_has: boolean) => {},
      setCodeQualityPayload: (_payload: unknown) => {},
    };
    await executeLoadContent(target, vscode.Uri.file(logPath), () => true);

    const hdrMsg = messages.find((m) => typeof m === 'object' && m !== null && (m as Record<string, unknown>).type === 'setSessionHeaderLines') as Record<string, unknown> | undefined;
    assert.ok(hdrMsg, 'expected setSessionHeaderLines after a load with a session header');
    const lines = hdrMsg.headerLines as string[];
    assert.ok(Array.isArray(lines), 'headerLines should be an array');
    assert.ok(lines.some((l) => l.includes('SAROPA LOG CAPTURE')), 'banner line preserved for the modal title');
    assert.ok(lines.some((l) => l.startsWith('Date:')), 'header field preserved');
    assert.ok(lines.some((l) => l.startsWith('Project:')), 'header field preserved');
    assert.ok(!lines.some((l) => l === ''), 'blank trailing line was stripped');
  });
});

