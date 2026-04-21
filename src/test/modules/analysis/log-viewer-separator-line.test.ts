import * as assert from "assert";
import { isLogViewerSeparatorLine } from "../../../modules/analysis/log-viewer-separator-line";

suite("log-viewer-separator-line (viewer banner / rule detection)", () => {
    suite("before: generic logs are not separators", () => {
        test("plain Drift SQL line is not a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter: Drift: Sent SELECT * FROM "contacts"; with args []'),
                false,
            );
        });
        test("short non-art line is not a separator", () => {
            assert.strictEqual(isLogViewerSeparatorLine("hi"), false);
        });
    });

    suite("logcat-prefixed lines strip prefix before detection", () => {
        test("logcat-prefixed paired │ … │ content line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): │           DRIFT DEBUG SERVER   v3.0.2           │'),
                true,
            );
        });
        test("logcat-prefixed border line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): ┌──────────────────────────────────────────────────┐'),
                true,
            );
        });
        test("logcat-prefixed empty interior row is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): \u2502                                                      \u2502'),
                true,
            );
        });
        test("bracket-prefixed box line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('[log] │         http://127.0.0.1:8643         │'),
                true,
            );
        });
        test("logcat-prefixed plain text is not a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): Starting application...'),
                false,
            );
        });
    });

    suite("double-vertical-bar (║) boxes (e.g. Isar Connect)", () => {
        test("logcat-prefixed ║ content line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ║                     ISAR CONNECT STARTED                     ║'),
                true,
            );
        });
        test("logcat-prefixed ║ URL content line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ║ https://inspect.isar-community.dev/3.3.0/#/37391/Q3SG7NeTAHc ║'),
                true,
            );
        });
        test("logcat-prefixed ╔ border line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ╔══════════════════════════════════════════════════════════════╗'),
                true,
            );
        });
        test("logcat-prefixed ╟ divider line is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter ( 5132): ╟──────────────────────────────────────────────────────────────╢'),
                true,
            );
        });
    });

    suite("after: Drift-style and Unicode box lines", () => {
        test("paired │ … │ interior row (Drift URL line)", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("      │              http://127.0.0.1:8642               │"),
                true,
            );
        });
        test("paired │ … │ title row", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("│           DRIFT DEBUG SERVER   v2.10.0           │"),
                true,
            );
        });
        test("╭/╯ border row (corners counted as art — previously missed without ╭╮╯╰ in set)", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("╭──────────────────────────────────────────────────╮"),
                true,
            );
        });
        test("paired │ │ empty interior row (whitespace only between bars)", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine("\u2502                                                      \u2502"),
                true,
            );
        });
        test("classic === rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine("==============================="), true);
        });
    });

    // --- Drift v3.3.3+ rounded-corner banner (the reported failing case). The
    //     later release switched from light corners (┌┐└┘) to rounded (╭╮╰╯)
    //     with T-connector dividers (├┤). Every row of the banner must be
    //     classified as a separator so art-block grouping keeps the whole frame
    //     together; a missed row splits the block visually.
    suite("Drift v3.3.3 rounded + T-connector banner (all rows)", () => {
        test("╭──╮ top rule is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('╭──────────────────────────────────────────────────╮'),
                true,
            );
        });
        test("├──┤ middle divider rule is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('├──────────────────────────────────────────────────┤'),
                true,
            );
        });
        test("╰──╯ bottom rule is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('╰──────────────────────────────────────────────────╯'),
                true,
            );
        });
        test("│ title │ row with v3.3.3 version is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('│           DRIFT DEBUG SERVER   v3.3.3            │'),
                true,
            );
        });
        test("logcat-prefixed rounded top rule is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): ╭──────────────────────────────────────────────────╮'),
                true,
            );
        });
        test("logcat-prefixed T-connector divider is a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('I/flutter (13876): ├──────────────────────────────────────────────────┤'),
                true,
            );
        });
    });

    // --- Heavy-line variants (used by Rich/Python and some Node libs) ---
    suite("heavy-line banners (┏━┓ ┃ ┣ ┫ ┗ ┛)", () => {
        test("┏━┓ top rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine('┏━━━━━━━━━━━━━━━━━━━━┓'), true);
        });
        test("┃ content ┃ bar-pair", () => {
            assert.strictEqual(isLogViewerSeparatorLine('┃     HEAVY BANNER     ┃'), true);
        });
        test("┣━┫ divider", () => {
            assert.strictEqual(isLogViewerSeparatorLine('┣━━━━━━━━━━━━━━━━━━━━┫'), true);
        });
        test("┗━┛ bottom rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine('┗━━━━━━━━━━━━━━━━━━━━┛'), true);
        });
    });

    // --- Mixed light/double (DOS-era boxes, still seen in .NET / legacy tooling) ---
    suite("mixed light/double banners (╒══╕ ╞══╡ ╘══╛)", () => {
        test("╒══╕ top rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine('╒══════════════════╕'), true);
        });
        test("╞══╡ divider", () => {
            assert.strictEqual(isLogViewerSeparatorLine('╞══════════════════╡'), true);
        });
        test("╘══╛ bottom rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine('╘══════════════════╛'), true);
        });
    });

    // --- ASCII plus-corner banner — relies on the 0.6 art-char ratio,
    //     not the bar-pair regex. ASCII `|` is intentionally excluded
    //     from the bar-pair set so markdown tables stay plain text.
    suite("ASCII plus-corner banners", () => {
        test("+---+ top rule", () => {
            assert.strictEqual(isLogViewerSeparatorLine('+----------------+'), true);
        });
        test("==== classic rule (wider)", () => {
            assert.strictEqual(isLogViewerSeparatorLine('==================='), true);
        });
    });

    // --- Boxen-style: title embedded directly inside the top rule ---
    suite("boxen-style banners (title in rule)", () => {
        test("╭─[ TITLE ]─╮ with bracketed title in top rule", () => {
            // Mostly-art line with a short title; ratio still ≥ 0.6.
            assert.strictEqual(
                isLogViewerSeparatorLine('╭─[ TITLE ]────────────────────────────╮'),
                true,
            );
        });
    });

    // --- Indented banners: detection must ignore leading whitespace on both
    //     the bar-pair and pure-box-rule branches.
    suite("indented banners", () => {
        test("indented rounded-corner rule stays a separator", () => {
            assert.strictEqual(isLogViewerSeparatorLine('      ╭──────────╮'), true);
        });
        test("indented heavy bar-pair stays a separator", () => {
            assert.strictEqual(isLogViewerSeparatorLine('    ┃     text     ┃'), true);
        });
    });

    // --- Negative cases: widening must not false-positive on real log lines ---
    suite("widening must not false-positive on real log lines", () => {
        test("markdown table row is NOT a separator (ASCII | excluded from bar set)", () => {
            assert.strictEqual(isLogViewerSeparatorLine('| col1 | col2 | col3 |'), false);
        });
        test("plain sentence with one box char in middle is NOT a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('Starting worker thread ─ pool size 8'),
                false,
            );
        });
        test("stack frame gutter `│ #N …` is NOT a separator", () => {
            assert.strictEqual(
                isLogViewerSeparatorLine('│ #0  package:foo/main.dart  foo (package:foo/a.dart:1:1)'),
                false,
            );
        });
    });
});
