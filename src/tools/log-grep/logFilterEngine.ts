import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  FilterLineResult,
  FilterOptions,
  FilterResult,
  HighlightRange,
  FileHandle,
  IndexProgressEvent,
  SearchResultSummaryEvent,
  SearchMatchItem,
  LineItem,
} from "./types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * (1024 * 1024))).toFixed(2)} GB`;
}

export async function pickLogFileViaTauri(): Promise<string | null> {
  if (isTauri()) {
    try {
      const path = await invoke<string | null>("pick_log_file");
      return path;
    } catch (err) {
      console.warn("pick_log_file failed via Tauri:", err);
    }
  }
  return null;
}

export async function openLogFileViaTauri(filePath: string): Promise<FileHandle | null> {
  if (isTauri()) {
    return invoke<FileHandle>("open_log_file", { path: filePath });
  }
  return null;
}

export async function closeLogFileViaTauri(fileId: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("close_log_file", { fileId });
    } catch (err) {
      console.warn("close_log_file error:", err);
    }
  }
}

export async function searchLogViaTauri(
  fileId: string,
  query: string,
  isRegex: boolean,
  matchCase: boolean,
  searchId?: string,
): Promise<string | null> {
  if (isTauri()) {
    return invoke<string>("search_log", {
      fileId,
      query,
      isRegex,
      matchCase,
      searchId,
    });
  }
  return null;
}

export async function cancelSearchViaTauri(searchId: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("cancel_search", { searchId });
    } catch (err) {
      console.warn("cancel_search error:", err);
    }
  }
}

export async function getLinesViaTauri(
  fileId: string,
  startLine: number,
  endLine: number,
): Promise<LineItem[]> {
  if (isTauri()) {
    return invoke<LineItem[]>("get_lines", {
      fileId,
      startLine,
      endLine,
    });
  }
  return [];
}

export async function onIndexProgress(
  callback: (event: IndexProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<IndexProgressEvent>("index-progress", (e) => {
    callback(e.payload);
  });
}

export async function onSearchResultSummary(
  callback: (event: SearchResultSummaryEvent) => void,
): Promise<UnlistenFn> {
  return listen<SearchResultSummaryEvent>("search-result-summary", (e) => {
    callback(e.payload);
  });
}

export async function getSearchResultsViaTauri(
  searchId: string,
  offset: number,
  limit: number,
): Promise<SearchMatchItem[]> {
  if (isTauri()) {
    return invoke<SearchMatchItem[]>("get_search_results", {
      searchId,
      offset,
      limit,
    });
  }
  return [];
}

export async function exportSearchResultsViaTauri(
  searchId: string,
  suggestedFilename?: string,
  destPath?: string,
): Promise<string | null> {
  if (isTauri()) {
    return invoke<string | null>("export_search_results", {
      searchId,
      suggestedFilename,
      destPath,
    });
  }
  return null;
}

export async function grepLogFileViaTauri(
  filePath: string,
  options: FilterOptions,
): Promise<FilterResult> {
  return invoke<FilterResult>("grep_log_file", {
    filePath,
    options: {
      pattern: options.pattern,
      isRegex: options.isRegex,
      matchCase: options.matchCase,
      wholeWord: options.wholeWord,
      invertMatch: options.invertMatch,
      contextLines: options.contextLines,
      customExpandedIndices: options.customExpandedIndices,
    },
  });
}

export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterLogLines(source: string, options: FilterOptions): FilterResult {
  const startTime = performance.now();

  if (!source) {
    return {
      lines: [],
      totalSourceLines: 0,
      matchedCount: 0,
      executionTimeMs: 0,
      error: null,
    };
  }

  // Split lines while preserving actual line count
  const rawLines = source.split(/\r\n|\r|\n/);
  const totalSourceLines = rawLines.length;

  const trimmedPattern = options.pattern.trim();

  // If no search pattern, return all lines as non-matching
  if (!trimmedPattern) {
    return {
      lines: rawLines.map((content, idx) => ({
        lineNumber: idx + 1,
        content,
        isMatch: false,
        isContext: false,
        highlights: [],
      })),
      totalSourceLines,
      matchedCount: 0,
      executionTimeMs: Math.round(performance.now() - startTime),
      error: null,
    };
  }

  try {
    let regex: RegExp | null = null;
    let needle = options.pattern;
    let needleLower = options.pattern.toLowerCase();

    if (options.isRegex) {
      let flags = "g";
      if (!options.matchCase) flags += "i";
      regex = new RegExp(options.pattern, flags);
    } else if (options.wholeWord) {
      let flags = "g";
      if (!options.matchCase) flags += "i";
      regex = new RegExp(`\\b${escapeRegex(options.pattern)}\\b`, flags);
    }

    const matchedIndices: number[] = [];
    const highlightsMap = new Map<number, HighlightRange[]>();

    const timeoutLimit = 350; // ReDoS prevention timeout in ms

    for (let i = 0; i < rawLines.length; i++) {
      if (i % 2000 === 0 && performance.now() - startTime > timeoutLimit) {
        throw new Error(
          "Regex execution timeout (> 350ms). The expression may be causing catastrophic backtracking (ReDoS).",
        );
      }

      const line = rawLines[i];
      let isLineMatched = false;
      const ranges: HighlightRange[] = [];

      if (regex) {
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        let matchCount = 0;

        while ((m = regex.exec(line)) !== null && matchCount < 200) {
          isLineMatched = true;
          if (m[0].length > 0) {
            ranges.push({ start: m.index, end: m.index + m[0].length });
          }
          matchCount++;

          // Handle zero-length regex matches safely
          if (m[0].length === 0) {
            if (regex.lastIndex >= line.length) break;
            regex.lastIndex++;
          }
        }
      } else {
        // Plain text literal search
        const target = options.matchCase ? line : line.toLowerCase();
        const search = options.matchCase ? needle : needleLower;
        const searchLen = search.length;

        if (searchLen > 0) {
          let pos = target.indexOf(search);
          while (pos !== -1) {
            isLineMatched = true;
            ranges.push({ start: pos, end: pos + searchLen });
            pos = target.indexOf(search, pos + searchLen);
          }
        }
      }

      // Handle invert match
      const finalMatched = options.invertMatch ? !isLineMatched : isLineMatched;

      if (finalMatched) {
        matchedIndices.push(i);
        if (!options.invertMatch && ranges.length > 0) {
          highlightsMap.set(i, ranges);
        }
      }
    }

    const matchedCount = matchedIndices.length;

    // Expand context lines if requested and not invert match
    const includedIndicesSet = new Set<number>();
    const directMatchesSet = new Set<number>(matchedIndices);

    const context = Math.max(0, Math.min(100, options.contextLines || 0));

    if (context > 0 && !options.invertMatch) {
      for (const idx of matchedIndices) {
        const start = Math.max(0, idx - context);
        const end = Math.min(rawLines.length - 1, idx + context);
        for (let c = start; c <= end; c++) {
          includedIndicesSet.add(c);
        }
      }
    } else {
      for (const idx of matchedIndices) {
        includedIndicesSet.add(idx);
      }
    }

    // Include any lines specifically expanded on-demand by user
    if (options.customExpandedIndices && options.customExpandedIndices.length > 0) {
      for (const idx of options.customExpandedIndices) {
        if (idx >= 0 && idx < rawLines.length) {
          includedIndicesSet.add(idx);
        }
      }
    }

    // Sort indices ascending
    const sortedIndices = Array.from(includedIndicesSet).sort((a, b) => a - b);

    const resultLines: FilterLineResult[] = sortedIndices.map((idx) => {
      const isDirectMatch = directMatchesSet.has(idx);
      return {
        lineNumber: idx + 1,
        content: rawLines[idx],
        isMatch: isDirectMatch,
        isContext: !isDirectMatch,
        highlights: highlightsMap.get(idx) || [],
      };
    });

    return {
      lines: resultLines,
      totalSourceLines,
      matchedCount,
      executionTimeMs: Math.round(performance.now() - startTime),
      error: null,
    };
  } catch (err: unknown) {
    return {
      lines: [],
      totalSourceLines,
      matchedCount: 0,
      executionTimeMs: Math.round(performance.now() - startTime),
      error: err instanceof Error ? err.message : "Invalid filter query or Regex error",
    };
  }
}
