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
 * Faithfulness: only `l10n.t` is reproduced with real semantics because that is
 * the only surface a pure module actually executes. Everything else is a no-op
 * Proxy so an unexpected `vscode.window.foo()` degrades to `undefined`/no-throw
 * instead of a hard crash — a missing-API access in a pure unit test should not
 * masquerade as a stub bug.
 */
const Module = require('node:module');

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

const vscodeStub = new Proxy(
  { l10n: { t: l10nT } },
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
