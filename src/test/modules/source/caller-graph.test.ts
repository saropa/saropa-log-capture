import test from "node:test";
import assert from "node:assert/strict";
import { findImportOfTarget } from "../../../modules/source/caller-graph";

test("a relative import of the target matches", () => {
  const m = findImportOfTarget(["../payment/payment_handler.dart", "dart:async"], "payment_handler.dart");
  assert.equal(m, "../payment/payment_handler.dart");
});

test("a package import resolving to the target basename matches", () => {
  const m = findImportOfTarget(["package:app/payment_handler.dart"], "payment_handler.dart");
  assert.equal(m, "package:app/payment_handler.dart");
});

test("an extensionless import (TS/JS) matches the target stem", () => {
  const m = findImportOfTarget(["./payment_handler", "react"], "payment_handler.ts");
  assert.equal(m, "./payment_handler");
});

test("matching is case-insensitive", () => {
  assert.equal(findImportOfTarget(["./PaymentHandler"], "paymenthandler.ts"), "./PaymentHandler");
});

test("an unrelated import set returns undefined", () => {
  assert.equal(findImportOfTarget(["./other", "package:app/widget.dart"], "payment_handler.dart"), undefined);
});

test("a same-stem-different-folder import still matches (basename-only comparison)", () => {
  // The matcher is basename-based; resolving folder ambiguity is the host's concern, not this rule.
  assert.equal(findImportOfTarget(["../models/user.dart"], "user.dart"), "../models/user.dart");
});
