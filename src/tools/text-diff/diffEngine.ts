import { invoke } from "@tauri-apps/api/core";

export interface DiffSegment {
  text: string;
  isDiff: boolean;
}

export interface DiffRowSide {
  lineNum?: number;
  text: string;
  segments: DiffSegment[];
  isSpacer: boolean;
}

export interface AlignedRow {
  isChanged: boolean;
  left: DiffRowSide;
  right: DiffRowSide;
}

export interface DiffResult {
  rows: AlignedRow[];
  differencesCount: number;
  isTruncated?: boolean;
  wordDiffDisabled?: boolean;
  totalLinesLeft?: number;
  totalLinesRight?: number;
}

export interface DiffOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  forceAll?: boolean;
}

export const MAX_WORD_DIFF_LINE_LEN = 1000;
export const MAX_FULL_DIFF_LINES = 10_000;
export const HARD_CAP_LINES = 100_000;
export const TRUNCATED_SAFE_LINES = 50_000;

// Binary file extensions that should not be read as plain text
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "tiff", "psd", "raw",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "tgz", "7z", "rar", "bz2", "xz",
  "exe", "dll", "dylib", "so", "bin", "o", "a",
  "wasm", "pyc", "class", "jar", "iso", "dmg",
  "mp3", "wav", "flac", "ogg", "m4a",
  "mp4", "mkv", "avi", "mov", "webm",
  "woff", "woff2", "ttf", "eot", "otf",
  "sqlite", "db"
]);

/**
 * Checks if a filename has a binary extension
 */
export function isBinaryFileName(filename: string): boolean {
  if (!filename) return false;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Checks if a buffer contains null bytes (heuristic for binary file)
 */
export function isBinaryBuffer(bytes: Uint8Array): boolean {
  const len = Math.min(bytes.length, 512);
  for (let i = 0; i < len; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

/**
 * Checks whether we are in a Tauri runtime environment.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/**
 * Normalizes line text based on options
 */
export function normalizeLineText(line: string, options?: DiffOptions): string {
  let res = line;
  if (options?.ignoreCase) {
    res = res.toLowerCase();
  }
  if (options?.ignoreWhitespace) {
    res = res.trim().replace(/\s+/g, " ");
  }
  return res;
}

/**
 * Splits text into lines, handling both \r\n and \n.
 */
export function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith("\r")) {
      lines[i] = lines[i].slice(0, -1);
    }
  }
  return lines;
}



/**
 * Word-level diff using Myers algorithm on word tokens.
 */
export function computeWordDiff(
  s1: string,
  s2: string,
  options?: DiffOptions,
): { left: DiffSegment[]; right: DiffSegment[] } {
  if (s1 === s2) {
    return {
      left: [{ text: s1, isDiff: false }],
      right: [{ text: s2, isDiff: false }],
    };
  }

  // If normalized versions match under ignore options, consider them equal
  if (
    (options?.ignoreWhitespace || options?.ignoreCase) &&
    normalizeLineText(s1, options) === normalizeLineText(s2, options)
  ) {
    return {
      left: [{ text: s1, isDiff: false }],
      right: [{ text: s2, isDiff: false }],
    };
  }

  // Guardrail: if line is too long, mark entire line without token recursion
  if (s1.length > MAX_WORD_DIFF_LINE_LEN || s2.length > MAX_WORD_DIFF_LINE_LEN) {
    return {
      left: [{ text: s1, isDiff: true }],
      right: [{ text: s2, isDiff: true }],
    };
  }

  const tokens1 = Array.from(s1);
  const tokens2 = Array.from(s2);

  const edits = myersDiffTokens(tokens1, tokens2, options);
  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];

  for (const edit of edits) {
    if (edit.type === "equal") {
      pushSegment(left, edit.text, false);
      pushSegment(right, edit.text, false);
    } else if (edit.type === "delete") {
      pushSegment(left, edit.text, true);
    } else if (edit.type === "insert") {
      pushSegment(right, edit.text, true);
    }
  }

  return { left, right };
}

function pushSegment(segments: DiffSegment[], text: string, isDiff: boolean) {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.isDiff === isDiff) {
    last.text += text;
  } else {
    segments.push({ text, isDiff });
  }
}

/**
 * Token-level Myers Diff (O(ND)) for words
 */
interface TokenEdit {
  type: "equal" | "delete" | "insert";
  text: string;
}

function myersDiffTokens(tokens1: string[], tokens2: string[], options?: DiffOptions): TokenEdit[] {
  const n = tokens1.length;
  const m = tokens2.length;
  const max = n + m;

  if (max === 0) return [];

  const norm1 = options?.ignoreCase ? tokens1.map((t) => t.toLowerCase()) : tokens1;
  const norm2 = options?.ignoreCase ? tokens2.map((t) => t.toLowerCase()) : tokens2;

  // V array indexed from -max to max, offset by max
  const v = new Int32Array(2 * max + 1);
  const trace: Int32Array[] = [];

  let foundD = -1;
  for (let d = 0; d <= max; d++) {
    const vCopy = new Int32Array(v);
    trace.push(vCopy);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }

      let y = x - k;
      while (x < n && y < m && norm1[x] === norm2[y]) {
        x++;
        y++;
      }

      v[k + max] = x;

      if (x >= n && y >= m) {
        foundD = d;
        break;
      }
    }

    if (foundD !== -1) break;
  }

  // Backtrack to find edits
  const edits: TokenEdit[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d > 0; d--) {
    const vPrev = trace[d];
    const k = x - y;

    let prevK: number;
    if (k === -d || (k !== d && vPrev[k - 1 + max] < vPrev[k + 1 + max])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = vPrev[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: "equal", text: tokens1[x] });
    }

    if (d > 0) {
      if (x === prevX) {
        y--;
        edits.unshift({ type: "insert", text: tokens2[y] });
      } else {
        x--;
        edits.unshift({ type: "delete", text: tokens1[x] });
      }
    }
  }

  while (x > 0 && y > 0) {
    x--;
    y--;
    edits.unshift({ type: "equal", text: tokens1[x] });
  }

  return edits;
}

/**
 * High-performance Line Diff using Myers with Line Hashing & Prefix/Suffix Trimming
 */
export function computeJsDiff(oldText: string, newText: string, options?: DiffOptions): DiffResult {
  const rawLines1 = splitLines(oldText);
  const rawLines2 = splitLines(newText);

  const totalLinesLeft = rawLines1.length;
  const totalLinesRight = rawLines2.length;

  if (totalLinesLeft === 0 && totalLinesRight === 0) {
    return {
      rows: [],
      differencesCount: 0,
      isTruncated: false,
      wordDiffDisabled: false,
      totalLinesLeft: 0,
      totalLinesRight: 0,
    };
  }

  const isTruncated = !options?.forceAll && (totalLinesLeft > HARD_CAP_LINES || totalLinesRight > HARD_CAP_LINES);
  const lines1 = isTruncated ? rawLines1.slice(0, TRUNCATED_SAFE_LINES) : rawLines1;
  const lines2 = isTruncated ? rawLines2.slice(0, TRUNCATED_SAFE_LINES) : rawLines2;

  const wordDiffDisabled = lines1.length > MAX_FULL_DIFF_LINES || lines2.length > MAX_FULL_DIFF_LINES;

  const lines1Norm = options?.ignoreWhitespace || options?.ignoreCase
    ? lines1.map((l) => normalizeLineText(l, options))
    : lines1;

  const lines2Norm = options?.ignoreWhitespace || options?.ignoreCase
    ? lines2.map((l) => normalizeLineText(l, options))
    : lines2;

  // 1. Prefix trimming
  let prefixCount = 0;
  while (
    prefixCount < lines1.length &&
    prefixCount < lines2.length &&
    lines1Norm[prefixCount] === lines2Norm[prefixCount]
  ) {
    prefixCount++;
  }

  // 2. Suffix trimming
  let suffixCount = 0;
  while (
    suffixCount < lines1.length - prefixCount &&
    suffixCount < lines2.length - prefixCount &&
    lines1Norm[lines1.length - 1 - suffixCount] === lines2Norm[lines2.length - 1 - suffixCount]
  ) {
    suffixCount++;
  }

  const rows: AlignedRow[] = [];
  let differencesCount = 0;

  // Add unchanged prefix rows
  for (let i = 0; i < prefixCount; i++) {
    const text1 = lines1[i];
    const text2 = lines2[i];
    rows.push({
      isChanged: false,
      left: {
        lineNum: i + 1,
        text: text1,
        segments: [{ text: text1, isDiff: false }],
        isSpacer: false,
      },
      right: {
        lineNum: i + 1,
        text: text2,
        segments: [{ text: text2, isDiff: false }],
        isSpacer: false,
      },
    });
  }

  // 3. Middle slices
  const mid1Norm = lines1Norm.slice(prefixCount, lines1.length - suffixCount);
  const mid2Norm = lines2Norm.slice(prefixCount, lines2.length - suffixCount);

  if (mid1Norm.length > 0 || mid2Norm.length > 0) {
    // Line Hashing: Map normalized lines to 32-bit integers
    const lineMap = new Map<string, number>();
    let nextId = 1;

    const hashLines = (lines: string[]): Int32Array => {
      const arr = new Int32Array(lines.length);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let id = lineMap.get(line);
        if (id === undefined) {
          id = nextId++;
          lineMap.set(line, id);
        }
        arr[i] = id;
      }
      return arr;
    };

    const ids1 = hashLines(mid1Norm);
    const ids2 = hashLines(mid2Norm);

    // Run Myers diff on the integer hashes
    const n = ids1.length;
    const m = ids2.length;
    const max = n + m;

    const v = new Int32Array(2 * max + 1);
    const trace: Int32Array[] = [];

    let foundD = -1;
    for (let d = 0; d <= max; d++) {
      trace.push(new Int32Array(v));

      for (let k = -d; k <= d; k += 2) {
        let x: number;
        if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
          x = v[k + 1 + max];
        } else {
          x = v[k - 1 + max] + 1;
        }

        let y = x - k;
        while (x < n && y < m && ids1[x] === ids2[y]) {
          x++;
          y++;
        }

        v[k + max] = x;

        if (x >= n && y >= m) {
          foundD = d;
          break;
        }
      }

      if (foundD !== -1) break;
    }

    // Backtrack to extract line hunks
    interface LineStep {
      type: "equal" | "delete" | "insert";
      oldIdx?: number;
      newIdx?: number;
    }

    const steps: LineStep[] = [];
    let x = n;
    let y = m;

    for (let d = trace.length - 1; d > 0; d--) {
      const vPrev = trace[d];
      const k = x - y;

      let prevK: number;
      if (k === -d || (k !== d && vPrev[k - 1 + max] < vPrev[k + 1 + max])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = vPrev[prevK + max];
      const prevY = prevX - prevK;

      while (x > prevX && y > prevY) {
        x--;
        y--;
        steps.unshift({ type: "equal", oldIdx: x, newIdx: y });
      }

      if (d > 0) {
        if (x === prevX) {
          y--;
          steps.unshift({ type: "insert", newIdx: y });
        } else {
          x--;
          steps.unshift({ type: "delete", oldIdx: x });
        }
      }
    }

    while (x > 0 && y > 0) {
      x--;
      y--;
      steps.unshift({ type: "equal", oldIdx: x, newIdx: y });
    }

    // Group steps into hunks
    let i = 0;
    while (i < steps.length) {
      if (steps[i].type === "equal") {
        const oi = prefixCount + steps[i].oldIdx!;
        const ni = prefixCount + steps[i].newIdx!;
        const text1 = lines1[oi];
        const text2 = lines2[ni];
        rows.push({
          isChanged: false,
          left: {
            lineNum: oi + 1,
            text: text1,
            segments: [{ text: text1, isDiff: false }],
            isSpacer: false,
          },
          right: {
            lineNum: ni + 1,
            text: text2,
            segments: [{ text: text2, isDiff: false }],
            isSpacer: false,
          },
        });
        i++;
      } else {
        const deletes: number[] = [];
        const inserts: number[] = [];

        while (i < steps.length && steps[i].type !== "equal") {
          if (steps[i].type === "delete") {
            deletes.push(prefixCount + steps[i].oldIdx!);
          } else if (steps[i].type === "insert") {
            inserts.push(prefixCount + steps[i].newIdx!);
          }
          i++;
        }

        const maxDiff = Math.max(deletes.length, inserts.length);
        for (let k = 0; k < maxDiff; k++) {
          const hasOld = k < deletes.length;
          const hasNew = k < inserts.length;

          if (hasOld && hasNew) {
            const oi = deletes[k];
            const ni = inserts[k];
            const s1 = lines1[oi];
            const s2 = lines2[ni];
            const wordDiff = wordDiffDisabled
              ? {
                  left: [{ text: s1, isDiff: true }],
                  right: [{ text: s2, isDiff: true }],
                }
              : computeWordDiff(s1, s2, options);

            const isReallyEqual = wordDiff.left.every((s) => !s.isDiff) && wordDiff.right.every((s) => !s.isDiff);
            if (!isReallyEqual) {
              differencesCount++;
            }

            rows.push({
              isChanged: !isReallyEqual,
              left: {
                lineNum: oi + 1,
                text: s1,
                segments: wordDiff.left,
                isSpacer: false,
              },
              right: {
                lineNum: ni + 1,
                text: s2,
                segments: wordDiff.right,
                isSpacer: false,
              },
            });
          } else if (hasOld && !hasNew) {
            const oi = deletes[k];
            const s1 = lines1[oi];
            differencesCount++;
            rows.push({
              isChanged: true,
              left: {
                lineNum: oi + 1,
                text: s1,
                segments: [{ text: s1, isDiff: true }],
                isSpacer: false,
              },
              right: {
                lineNum: undefined,
                text: "",
                segments: [],
                isSpacer: true,
              },
            });
          } else if (!hasOld && hasNew) {
            const ni = inserts[k];
            const s2 = lines2[ni];
            differencesCount++;
            rows.push({
              isChanged: true,
              left: {
                lineNum: undefined,
                text: "",
                segments: [],
                isSpacer: true,
              },
              right: {
                lineNum: ni + 1,
                text: s2,
                segments: [{ text: s2, isDiff: true }],
                isSpacer: false,
              },
            });
          }
        }
      }
    }
  }

  // Add unchanged suffix rows
  const suffixStartOld = lines1.length - suffixCount;
  const suffixStartNew = lines2.length - suffixCount;
  for (let i = 0; i < suffixCount; i++) {
    const oi = suffixStartOld + i;
    const ni = suffixStartNew + i;
    const text1 = lines1[oi];
    const text2 = lines2[ni];
    rows.push({
      isChanged: false,
      left: {
        lineNum: oi + 1,
        text: text1,
        segments: [{ text: text1, isDiff: false }],
        isSpacer: false,
      },
      right: {
        lineNum: ni + 1,
        text: text2,
        segments: [{ text: text2, isDiff: false }],
        isSpacer: false,
      },
    });
  }

  return {
    rows,
    differencesCount,
    isTruncated,
    wordDiffDisabled,
    totalLinesLeft,
    totalLinesRight,
  };
}

/**
 * Main entry point: Calls Rust native backend in Tauri, falls back to TypeScript Myers diff in browser.
 */
export async function computeDiff(
  oldText: string,
  newText: string,
  options?: DiffOptions,
): Promise<DiffResult> {
  if (isTauri()) {
    try {
      const result = await invoke<DiffResult>("compute_text_diff", {
        oldText,
        newText,
        ignoreWhitespace: options?.ignoreWhitespace,
        ignoreCase: options?.ignoreCase,
        forceAll: options?.forceAll,
      });
      return result;
    } catch (err) {
      console.warn("Tauri native diff failed or unavailable, falling back to JS Myers diff:", err);
    }
  }

  // Fallback to high-performance JS Myers
  return computeJsDiff(oldText, newText, options);
}
