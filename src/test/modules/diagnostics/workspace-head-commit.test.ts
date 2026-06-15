import * as assert from 'node:assert';
import test from 'node:test';
import { parseHeadRef, findPackedRef } from '../../../modules/diagnostics/workspace-head-commit-parse';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

test('parseHeadRef: symbolic ref → ref, no sha', () => {
  const r = parseHeadRef('ref: refs/heads/main\n');
  assert.strictEqual(r.ref, 'refs/heads/main');
  assert.strictEqual(r.sha, undefined);
});

test('parseHeadRef: detached HEAD → sha, no ref', () => {
  const r = parseHeadRef(SHA + '\n');
  assert.strictEqual(r.sha, SHA);
  assert.strictEqual(r.ref, undefined);
});

test('parseHeadRef: garbage → empty', () => {
  assert.deepStrictEqual(parseHeadRef('not a ref or sha'), {});
});

test('findPackedRef: returns the sha for the named ref', () => {
  const packed = '# pack-refs with: peeled fully-peeled sorted\n' +
    SHA + ' refs/heads/main\n' +
    '0000000000000000000000000000000000000000 refs/tags/v1\n';
  assert.strictEqual(findPackedRef(packed, 'refs/heads/main'), SHA);
});

test('findPackedRef: skips peeled-tag (^) lines and missing refs', () => {
  const packed = SHA + ' refs/tags/v1\n^' + SHA + '\n';
  assert.strictEqual(findPackedRef(packed, 'refs/heads/main'), undefined);
});
