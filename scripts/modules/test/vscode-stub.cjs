/**
 * Minimal `vscode` module stub for the `node:test` suites (`run-node-tests.mjs`).
 *
 * WHY this exists: the node:test files are the deliberately "pure, no VS Code
 * API" suite — they run under plain `node --test`, where the real `vscode`
 * module does not exist (it is injected only inside the Extension Development
 * Host). A pure module can still *transitively* reach `vscode`: e.g. the
 * signal-report renderers call `t()` from `src/l10n.ts`, and `l10n.ts` does
 * `import * as vscode from 'vscode'` at module top for `vscode.l10n.t()`. That
 * top-level import made four signal-report test files crash with
 * `Cannot find module 'vscode'` the moment they were localized (commit
 * 41d78a27). Rather than ban localization from any code a node:test touches,
 * we register a faithful-enough stub so the import resolves.
 *
 * Loaded via `node --require` BEFORE the test files (CommonJS preload). It
 * patches `Module._load` so any `require('vscode')` — at any depth — returns
 * this stub instead of throwing.
 *
 * Faithfulness: `l10n.t` and `Uri` are reproduced with real semantics, because
 * those are the surfaces a pure module actually executes rather than merely
 * touches — `t()` for localized strings, and `Uri.file`/`Uri.joinPath`/`fsPath`
 * for any module that derives a real filesystem path (LogSession writes its part
 * files through `node:fs` using one). Everything else is a no-op Proxy so an
 * unexpected `vscode.window.foo()` degrades to `undefined`/no-throw instead of a
 * hard crash — a missing-API access in a pure unit test should not masquerade as
 * a stub bug.
 */
const Module = require('node:module');
const nodePath = require('node:path');

/**
 * Reproduce `vscode.l10n.t()` argument substitution. The real API replaces
 * `{0}`, `{1}`, … with positional args, or `{name}` when a single object arg is
 * passed. The signal-report strings use only the positional `{0}` form, but the
 * named form is supported here too so the stub never diverges from the real API
 * for code that relies on it.
 */
function l10nT(message, ...args) {
  if (typeof message !== 'string') {
    return String(message ?? '');
  }
  // A single plain-object arg selects named substitution ({name}); otherwise
  // every arg is positional ({index}). Mirrors vscode.l10n.t's two call shapes.
  const named =
    args.length === 1 &&
    args[0] !== null &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0]);

  if (named) {
    const map = args[0];
    return message.replace(/\{(\w+)\}/g, (whole, key) =>
      key in map ? String(map[key]) : whole,
    );
  }

  return message.replace(/\{(\d+)\}/g, (whole, index) => {
    const i = Number(index);
    return i < args.length ? String(args[i]) : whole;
  });
}

/**
 * No-op Proxy: any property access returns another no-op-callable Proxy, so a
 * chain like `vscode.window.showInformationMessage(...)` neither throws nor does
 * anything. Functions return `undefined`. Used for every vscode surface except
 * `l10n`, which carries real substitution semantics above.
 */
function makeNoopProxy() {
  const fn = () => undefined;
  return new Proxy(fn, {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString') {
        return () => '';
      }
      return makeNoopProxy();
    },
    apply() {
      return undefined;
    },
  });
}

/**
 * Real `vscode.Uri` semantics for the subset the pure modules actually execute:
 * `file()`, `joinPath()` and `fsPath`. The no-op Proxy below cannot serve these —
 * it returns another Proxy, so `getLogDirUri()` hands back something whose
 * `.fsPath` is a Proxy rather than a path string, and any module that builds a
 * file path from a Uri silently produces garbage instead of failing loudly.
 *
 * Reproduced rather than stubbed because the modules under test do real disk I/O
 * with the result (LogSession writes its parts through `node:fs`), so a faithful
 * path is the difference between exercising the real write/split path and not
 * being able to construct the object at all.
 */
class StubUri {
  constructor(fsPath) {
    this.scheme = 'file';
    this.fsPath = fsPath;
    this.path = fsPath.split('\\').join('/');
    this.authority = '';
    this.query = '';
    this.fragment = '';
  }

  static file(fsPath) {
    return new StubUri(nodePath.resolve(String(fsPath)));
  }

  static joinPath(base, ...segments) {
    return new StubUri(nodePath.resolve(base.fsPath, ...segments.map(String)));
  }

  with(change) {
    return new StubUri(change && change.path ? change.path : this.fsPath);
  }

  toString() {
    return `file://${this.path}`;
  }

  toJSON() {
    return { scheme: this.scheme, path: this.path, fsPath: this.fsPath };
  }
}

/**
 * `workspace.getConfiguration(section)` returning "nothing is configured".
 *
 * The no-op Proxy below cannot serve this: it makes the CALL succeed but returns
 * `undefined`, so the very next `.get(...)` throws — which is why any pure module
 * reaching real settings (the fingerprint scanners classify lines through
 * `getConfig()`) was untestable under node:test rather than merely degraded.
 *
 * `get()` returning `undefined` is the honest answer for a workspace with no
 * user settings: every caller in this codebase funnels the result through a
 * validation helper carrying the packaged default (`clamp`, `ensureBoolean`, …),
 * so the modules under test see exactly their shipped defaults.
 */
const stubConfiguration = {
  get: () => undefined,
  has: () => false,
  inspect: () => undefined,
  update: () => Promise.resolve(),
};

/**
 * `window.createOutputChannel()` returning a real (if silent) channel object.
 *
 * Same shape of gap as `getConfiguration` above: the no-op Proxy lets the CALL
 * succeed but yields `undefined`, so `getExtensionLogger().appendLine(...)`
 * throws. That turns "this pure module logged a warning" — which the scanners do
 * whenever a line cap truncates a scan — into a hard test failure at a point
 * completely unrelated to what is being tested.
 */
function makeStubOutputChannel() {
  return {
    name: 'Saropa Log Capture',
    appendLine: () => undefined,
    append: () => undefined,
    replace: () => undefined,
    clear: () => undefined,
    show: () => undefined,
    hide: () => undefined,
    dispose: () => undefined,
  };
}

const vscodeStub = new Proxy(
  {
    l10n: { t: l10nT },
    Uri: StubUri,
    workspace: new Proxy(
      { getConfiguration: () => stubConfiguration },
      {
        get(target, prop) {
          return prop in target ? target[prop] : makeNoopProxy();
        },
      },
    ),
    window: new Proxy(
      { createOutputChannel: makeStubOutputChannel },
      {
        get(target, prop) {
          return prop in target ? target[prop] : makeNoopProxy();
        },
      },
    ),
  },
  {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      return makeNoopProxy();
    },
  },
);

// Intercept `require('vscode')` at any depth. The original loader handles every
// other specifier unchanged.
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};
