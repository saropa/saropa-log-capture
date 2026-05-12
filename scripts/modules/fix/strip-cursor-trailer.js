#!/usr/bin/env node
/**
 * Reads a git commit message from stdin and writes it to stdout with any
 * "Made-with: Cursor" trailer line removed. Used by git filter-branch
 * --msg-filter to rewrite history. One-time use; repo keeps the script
 * for documentation.
 */
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const cursorTrailer = /^\s*Made-with:\s*Cursor\s*$/i;
let prev = null;
rl.on('line', (line) => {
  if (prev !== null) process.stdout.write(prev + '\n');
  prev = cursorTrailer.test(line) ? null : line;
});
rl.on('close', () => {
  if (prev !== null) process.stdout.write(prev + '\n');
});
