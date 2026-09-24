import { describe, it, expect } from "vitest";
import {
  computeJsDiff,
  computeWordDiff,
  splitLines,
  isBinaryFileName,
  isBinaryBuffer,
} from "../diffEngine";

describe("diffEngine", () => {
  it("handles empty texts", () => {
    const res = computeJsDiff("", "");
    expect(res.rows).toEqual([]);
    expect(res.differencesCount).toBe(0);
  });

  it("splits lines and strips carriage returns", () => {
    const lines = splitLines("foo\r\nbar\nbaz\r");
    expect(lines).toEqual(["foo", "bar", "baz"]);
  });

  it("handles identical multi-line texts", () => {
    const text = "line 1\nline 2\nline 3";
    const res = computeJsDiff(text, text);
    expect(res.rows.length).toBe(3);
    expect(res.differencesCount).toBe(0);
    expect(res.rows.every((r) => !r.isChanged)).toBe(true);
    expect(res.rows[0].left.lineNum).toBe(1);
    expect(res.rows[0].right.lineNum).toBe(1);
  });

  it("handles line insertions and deletions", () => {
    const oldText = "A\nB\nC";
    const newText = "A\nC\nD";
    const res = computeJsDiff(oldText, newText);

    expect(res.differencesCount).toBeGreaterThan(0);
    expect(res.rows[0].left.text).toBe("A");
    expect(res.rows[0].isChanged).toBe(false);
  });

  it("performs word-level diff on substituted lines", () => {
    const wordDiff = computeWordDiff("Hello world foo", "Hello react foo");
    expect(wordDiff.left.some((seg) => seg.text === "world" && seg.isDiff)).toBe(true);
    expect(wordDiff.right.some((seg) => seg.text === "react" && seg.isDiff)).toBe(true);
    expect(wordDiff.left.some((seg) => seg.text === "Hello " && !seg.isDiff)).toBe(true);
  });

  it("safely handles long lines without freezing (guardrail)", () => {
    const long1 = "x".repeat(2000);
    const long2 = "y".repeat(2000);
    const wordDiff = computeWordDiff(long1, long2);
    expect(wordDiff.left.length).toBe(1);
    expect(wordDiff.left[0].isDiff).toBe(true);
  });

  it("efficiently handles prefix and suffix trimming on 2000 lines", () => {
    const commonPrefix = Array.from({ length: 1000 }, (_, i) => `Prefix line ${i}`).join("\n");
    const commonSuffix = Array.from({ length: 1000 }, (_, i) => `Suffix line ${i}`).join("\n");
    const oldText = `${commonPrefix}\nMiddle Old Line\n${commonSuffix}`;
    const newText = `${commonPrefix}\nMiddle New Line\n${commonSuffix}`;

    const t0 = performance.now();
    const res = computeJsDiff(oldText, newText);
    const elapsed = performance.now() - t0;

    expect(res.rows.length).toBe(2001);
    expect(res.differencesCount).toBe(1);
    expect(elapsed).toBeLessThan(150); // Should run in < 150ms
  });

  it("supports ignoreWhitespace and ignoreCase options", () => {
    const oldText = "HELLO   WORLD\nFOO";
    const newText = "hello world\nbar";

    const res = computeJsDiff(oldText, newText, { ignoreWhitespace: true, ignoreCase: true });
    expect(res.rows[0].isChanged).toBe(false);
    expect(res.rows[1].isChanged).toBe(true);
    expect(res.differencesCount).toBe(2);
  });

  it("detects binary files by extension and buffer", () => {
    expect(isBinaryFileName("photo.PNG")).toBe(true);
    expect(isBinaryFileName("document.pdf")).toBe(true);
    expect(isBinaryFileName("script.ts")).toBe(false);
    expect(isBinaryFileName("styles.css")).toBe(false);

    const binaryBuffer = new Uint8Array([104, 101, 108, 0, 111]); // contains null byte \0
    const textBuffer = new Uint8Array([104, 101, 108, 108, 111]);
    expect(isBinaryBuffer(binaryBuffer)).toBe(true);
    expect(isBinaryBuffer(textBuffer)).toBe(false);
  });

  it("automatically disables word-level diff when line count exceeds 10,000", () => {
    const n = 10005;
    const oldLines = Array.from({ length: n }, (_, i) => `line ${i}`);
    const newLines = [...oldLines];
    newLines[0] = "line 0 edited";

    const res = computeJsDiff(oldLines.join("\n"), newLines.join("\n"));
    expect(res.wordDiffDisabled).toBe(true);
    expect(res.differencesCount).toBe(1);
    expect(res.rows[0].left.segments.length).toBe(1);
    expect(res.rows[0].left.segments[0].isDiff).toBe(true);
  });

  it("truncates at safety threshold (100,000 lines) unless forceAll is specified", () => {
    // Test truncation on large array
    const n = 100005;
    const oldLines = Array.from({ length: n }, (_, i) => `line ${i}`);
    const res = computeJsDiff(oldLines.join("\n"), "empty");
    expect(res.isTruncated).toBe(true);
    expect(res.rows.length).toBeLessThanOrEqual(50001);
  });

  it("benchmarks JS Myers at different scales", () => {
    for (const n of [1000, 5000, 10000]) {
      const oldLines = Array.from({ length: n }, (_, i) => `function test_${i}() { return ${i}; }`);
      const newLines = [...oldLines];
      for (let i = 0; i < n; i += 20) {
        newLines[i] = `function test_${i}() { return ${i * 2} + 1; }`;
      }
      const t0 = performance.now();
      const res = computeJsDiff(oldLines.join("\n"), newLines.join("\n"));
      const elapsed = performance.now() - t0;
      console.log(`[JS BENCHMARK n=${n}, 5% diff]: ${elapsed.toFixed(2)}ms, diffCount=${res.differencesCount}`);
    }

    for (const n of [1000, 3000]) {
      const oldLines = Array.from({ length: n }, (_, i) => `old unique line ${i}`);
      const newLines = Array.from({ length: n }, (_, i) => `new unique line ${i}`);
      const t0 = performance.now();
      const res = computeJsDiff(oldLines.join("\n"), newLines.join("\n"));
      const elapsed = performance.now() - t0;
      console.log(`[JS BENCHMARK n=${n}, 100% diff]: ${elapsed.toFixed(2)}ms, diffCount=${res.differencesCount}`);
    }
  });
});
