import test from "node:test";
import assert from "node:assert/strict";
import { classifyErrorSemantics } from "../../../modules/analysis/error-semantics";

test("network failures classify as network", () => {
  assert.equal(classifyErrorSemantics("SocketException: Connection refused (port 8080)"), "network");
  assert.equal(classifyErrorSemantics("TimeoutException after 5000ms: Future not completed"), "network");
  assert.equal(classifyErrorSemantics("ClientException: Failed host lookup: 'api.example.com'"), "network");
  assert.equal(classifyErrorSemantics("connect ECONNREFUSED 127.0.0.1:5432"), "network");
});

test("filesystem errors classify as filesystem", () => {
  assert.equal(classifyErrorSemantics("PathNotFoundException: Cannot open file"), "filesystem");
  assert.equal(classifyErrorSemantics("Error: ENOENT: no such file or directory, open 'x'"), "filesystem");
});

test("validation/parse errors classify as validation", () => {
  assert.equal(classifyErrorSemantics("FormatException: Unexpected character"), "validation");
  assert.equal(classifyErrorSemantics("RangeError (index): Invalid value: Not in range 0..3"), "validation");
  assert.equal(classifyErrorSemantics("type 'Null' is not a subtype of type 'String'"), "validation");
});

test("permission takes precedence over filesystem when both could match", () => {
  assert.equal(classifyErrorSemantics("FileSystemException: permission denied, open '/etc/x'"), "permission");
});

test("memory and concurrency categories", () => {
  assert.equal(classifyErrorSemantics("java.lang.OutOfMemoryError: Java heap space"), "memory");
  assert.equal(classifyErrorSemantics("ConcurrentModificationException"), "concurrency");
});

test("unrecognized text and empty input fall back to other", () => {
  assert.equal(classifyErrorSemantics("Something entirely unexpected happened"), "other");
  assert.equal(classifyErrorSemantics(""), "other");
});
