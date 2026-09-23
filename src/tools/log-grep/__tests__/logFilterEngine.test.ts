import { describe, it, expect } from "vitest";
import { filterLogLines, formatFileSize } from "../logFilterEngine";

describe("logFilterEngine unit tests", () => {
  const sampleLog = `2026-09-22 10:00:00 [INFO] Starting server
2026-09-22 10:00:01 [WARN] High memory usage
2026-09-22 10:00:02 [ERROR] Database connection lost
2026-09-22 10:00:03 [INFO] Retrying connection
2026-09-22 10:00:04 [ERROR] Timeout connecting to DB
2026-09-22 10:00:05 [INFO] Recovery successful`;

  it("filters literal search case-insensitively", () => {
    const result = filterLogLines(sampleLog, {
      pattern: "error",
      isRegex: false,
      matchCase: false,
      wholeWord: false,
      invertMatch: false,
    });

    expect(result.matchedCount).toBe(2);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].lineNumber).toBe(3);
    expect(result.lines[1].lineNumber).toBe(5);
  });

  it("filters with case sensitivity", () => {
    const result = filterLogLines(sampleLog, {
      pattern: "error",
      isRegex: false,
      matchCase: true,
      wholeWord: false,
      invertMatch: false,
    });

    expect(result.matchedCount).toBe(0);
  });

  it("filters with regex pattern", () => {
    const result = filterLogLines(sampleLog, {
      pattern: "\\[(ERROR|WARN)\\]",
      isRegex: true,
      matchCase: true,
      wholeWord: false,
      invertMatch: false,
    });

    expect(result.matchedCount).toBe(3);
    expect(result.lines.map((l) => l.lineNumber)).toEqual([2, 3, 5]);
  });

  it("supports context lines", () => {
    const result = filterLogLines(sampleLog, {
      pattern: "lost",
      isRegex: false,
      matchCase: false,
      wholeWord: false,
      invertMatch: false,
      contextLines: 1,
    });

    expect(result.matchedCount).toBe(1);
    expect(result.lines.map((l) => l.lineNumber)).toEqual([2, 3, 4]);
    expect(result.lines[0].isContext).toBe(true);
    expect(result.lines[1].isMatch).toBe(true);
    expect(result.lines[2].isContext).toBe(true);
  });

  it("supports inverted matches", () => {
    const result = filterLogLines(sampleLog, {
      pattern: "INFO",
      isRegex: false,
      matchCase: true,
      wholeWord: false,
      invertMatch: true,
    });

    expect(result.matchedCount).toBe(3);
    expect(result.lines.map((l) => l.lineNumber)).toEqual([2, 3, 5]);
  });

  it("formats file sizes correctly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe("2.50 GB");
  });
});
