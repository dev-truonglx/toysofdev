import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ListFilter,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  ChevronDown,
  X,
  FileText,
  HardDrive,
  Zap,
  FolderOpen,
  SearchX,
  ArrowRight,
  UnfoldVertical,
  RotateCw,
  AlertCircle,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import {
  FilterOptions,
  FilterLineResult,
  RegexPreset,
  FilterResult,
  FileHandle,
  IndexProgressEvent,
} from "./types";
import {
  filterLogLines,
  isTauri,
  pickLogFileViaTauri,
  openLogFileViaTauri,
  closeLogFileViaTauri,
  searchLogViaTauri,
  cancelSearchViaTauri,
  getLinesViaTauri,
  onIndexProgress,
  onSearchResultSummary,
  getSearchResultsViaTauri,
  exportSearchResultsViaTauri,
  formatFileSize,
} from "./logFilterEngine";
import { LOG_PRESETS } from "./presets";

const DEFAULT_SAMPLE_LOG = `2026-09-22 14:00:01.102 [INFO]  [main] com.devtoys.app.Server: Starting Server v0.0.2 on port 8080
2026-09-22 14:00:02.341 [INFO]  [main] com.devtoys.app.DbPool: HikariPool-1 initialized successfully (10 connections)
2026-09-22 14:00:05.819 [INFO]  [http-nio-8080-exec-1] GET /healthz 200 OK - 2ms
2026-09-22 14:01:12.440 [WARN]  [http-nio-8080-exec-2] com.devtoys.app.Auth: Slow authentication detected for user_id=4812 (took 1840ms)
2026-09-22 14:01:15.110 [INFO]  [http-nio-8080-exec-3] POST /api/v1/auth/login 200 OK - 42ms trace_id=f47ac10b-58cc-4372-a567-0e02b2c3d479
2026-09-22 14:02:18.990 [ERROR] [http-nio-8080-exec-4] com.devtoys.app.PaymentService: Failed to process transaction tx_id=98124
java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30000ms.
    at com.zaxxer.hikari.pool.HikariPool.createTimeoutException(HikariPool.java:696)
    at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:197)
    at com.devtoys.app.PaymentService.charge(PaymentService.java:142)
Caused by: java.net.SocketTimeoutException: Read timed out
    at java.base/sun.nio.ch.NioSocketImpl.timedRead(NioSocketImpl.java:283)
2026-09-22 14:02:20.005 [INFO]  [http-nio-8080-exec-5] GET /healthz 200 OK - 1ms
2026-09-22 14:03:01.554 [DEBUG] [scheduler-1] com.devtoys.app.SyncJob: Processed 42 cache records
2026-09-22 14:03:45.712 [ERROR] [http-nio-8080-exec-6] POST /api/v1/orders 500 Internal Server Error - 3012ms trace_id=3c829e01-1b15-4981-bcf3-94c0a1a09881
2026-09-22 14:04:10.120 [INFO]  [http-nio-8080-exec-7] GET /healthz 200 OK - 1ms
2026-09-22 14:05:00.891 [WARN]  [system-monitor] High CPU usage detected: 89.4% on worker node 2`;

export const LogGrep: React.FC = () => {
  const { language } = useTranslation();
  const [logText, setLogText] = useState(DEFAULT_SAMPLE_LOG);
  const [pattern, setPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [invertMatch, setInvertMatch] = useState(false);
  const [contextLines, setContextLines] = useState<number>(0);
  const [customExpandedLines, setCustomExpandedLines] = useState<Set<number>>(new Set());

  const [debouncedPattern, setDebouncedPattern] = useState(pattern);
  const [copied, setCopied] = useState(false);
  const [copiedLineNumber, setCopiedLineNumber] = useState<number | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"split" | "results" | "source">("split");
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // New High-Performance Engine States
  const [fileHandle, setFileHandle] = useState<FileHandle | null>(null);
  const [indexProgress, setIndexProgress] = useState<IndexProgressEvent | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_previewLines, setPreviewLines] = useState<FilterLineResult[]>([]);
  const [streamedMatches, setStreamedMatches] = useState<FilterLineResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamMatchesCount, setStreamMatchesCount] = useState(0);
  const [streamTotalMs, setStreamTotalMs] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Pagination for Search Results
  const [displayLimit, setDisplayLimit] = useState(500);

  // Jump to Line State
  const [jumpLineInput, setJumpLineInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const parentScrollRef = useRef<HTMLDivElement>(null);
  const activeSearchIdRef = useRef<string | null>(null);
  const lastCompletedSearchIdRef = useRef<string | null>(null);
  const currentFileIdRef = useRef<string | null>(null);
  const latestIndexProgressRef = useRef<Map<string, IndexProgressEvent>>(new Map());

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // LRU line cache for virtualized scroll — avoids re-fetching lines
  // that were recently viewed. Capped at LINE_CACHE_MAX to bound memory.
  const LINE_CACHE_MAX = 10_000;
  const lineCacheRef = useRef<Map<number, string>>(new Map());

  // Pending fetch tracker to avoid duplicate concurrent fetches
  const pendingFetchRef = useRef<Set<string>>(new Set());

  // Evict oldest entries when cache exceeds max size
  const evictCache = useCallback(() => {
    const cache = lineCacheRef.current;
    if (cache.size <= LINE_CACHE_MAX) return;
    const excess = cache.size - LINE_CACHE_MAX;
    const iter = cache.keys();
    for (let i = 0; i < excess; i++) {
      const key = iter.next().value;
      if (key !== undefined) cache.delete(key);
    }
  }, []);

  // Keep currentFileIdRef in sync with fileHandle
  useEffect(() => {
    currentFileIdRef.current = fileHandle?.fileId ?? null;
    // Clear cache when file changes
    lineCacheRef.current.clear();
    pendingFetchRef.current.clear();
  }, [fileHandle]);

  // Debounce search query to keep input responsive
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPattern(pattern);
    }, 600);
    return () => clearTimeout(handler);
  }, [pattern]);

  // Reset custom expansions when pattern or log text changes
  useEffect(() => {
    setCustomExpandedLines((prev) => (prev.size === 0 ? prev : new Set()));
  }, [debouncedPattern, logText, selectedFilePath]);

  // Reset display limit when search changes
  useEffect(() => {
    setDisplayLimit(500);
  }, [debouncedPattern, selectedFilePath]);

  const filterOptions: FilterOptions = useMemo(
    () => ({
      pattern: debouncedPattern,
      isRegex,
      matchCase,
      wholeWord,
      invertMatch,
      contextLines,
      customExpandedIndices: Array.from(customExpandedLines),
    }),
    [debouncedPattern, isRegex, matchCase, wholeWord, invertMatch, contextLines, customExpandedLines],
  );

  // Fallback for paste-text mode
  const localFilterResult: FilterResult = useMemo(() => {
    if (selectedFilePath) {
      return {
        lines: [],
        totalSourceLines: 0,
        matchedCount: 0,
        executionTimeMs: 0,
        error: null,
      };
    }
    return filterLogLines(logText, filterOptions);
  }, [selectedFilePath, logText, filterOptions]);

  // Listen to Tauri events for Index Progress and Search Batches
  useEffect(() => {
    let unlistenIndex: (() => void) | null = null;
    let unlistenBatch: (() => void) | null = null;

    onIndexProgress((event) => {
      latestIndexProgressRef.current.set(event.fileId, event);
      // Ignore progress events from old or cancelled files
      if (currentFileIdRef.current && event.fileId !== currentFileIdRef.current) {
        return;
      }
      console.log(
        `%c[LogGrep:Frontend:IndexProgress]%c fileId=${event.fileId.slice(0, 8)} | ${event.percent.toFixed(1)}% | lines: ${event.totalLines.toLocaleString()} | status: ${event.status}`,
        "color: #0ea5e9; font-weight: bold",
        "color: inherit"
      );
      setIndexProgress(event);
      setFileHandle((prev) => {
        if (prev && prev.fileId === event.fileId) {
          return {
            ...prev,
            totalLines: event.totalLines,
            indexStatus: event.status,
          };
        }
        return prev;
      });
    }).then((fn) => {
      unlistenIndex = fn;
    });

    onSearchResultSummary(async (event) => {
      console.log(
        `%c[LogGrep:Frontend:SummaryReceived]%c searchId=${event.searchId.slice(0, 8)} | total=${event.totalMatches} | time=${event.executionTimeMs}ms (activeSearchId=${activeSearchIdRef.current?.slice(0, 8)})`,
        "color: #3b82f6; font-weight: bold",
        "color: inherit"
      );

      // CRITICAL: Ignore batches from old files or cancelled searches!
      if (!currentFileIdRef.current || event.fileId !== currentFileIdRef.current) {
        console.warn(
          `[LogGrep:Frontend:SummaryIgnored] fileId mismatch: event.fileId=${event.fileId} vs current=${currentFileIdRef.current}`
        );
        return;
      }

      if (activeSearchIdRef.current && event.searchId === activeSearchIdRef.current) {
        lastCompletedSearchIdRef.current = event.searchId;
        if (event.error) {
          console.warn(`[LogGrep:Frontend:SearchWarning]`, event.error);
          setStreamError(event.error);
        }

        setStreamMatchesCount(event.totalMatches);
        setStreamTotalMs(event.executionTimeMs);
        setIsStreaming(false);

        if (event.totalMatches > 0) {
          // Fetch initial page
          try {
            const firstPage = await getSearchResultsViaTauri(event.searchId, 0, 500);
            const mapped: FilterLineResult[] = firstPage.map((m) => ({
              lineNumber: m.lineNumber,
              content: m.content,
              isMatch: true,
              isContext: false,
              highlights: m.highlights,
            }));
            setStreamedMatches(mapped);
          } catch (err) {
            console.error("Failed to fetch initial search page", err);
          }
        } else {
          setStreamedMatches([]);
        }
      } else {
        console.warn(
          `[LogGrep:Frontend:SummaryIgnored] searchId mismatch or cancelled: event.searchId=${event.searchId.slice(0, 8)} vs active=${activeSearchIdRef.current?.slice(0, 8)}`
        );
      }
    }).then((fn) => {
      unlistenBatch = fn;
    });

    return () => {
      unlistenIndex?.();
      unlistenBatch?.();
    };
  }, []);

  // Streaming Search Trigger when fileHandle is active
  useEffect(() => {
    if (!fileHandle) return;

    const trimmed = debouncedPattern.trim();

    // If query is empty, reset to preview lines
    if (!trimmed) {
      if (activeSearchIdRef.current) {
        cancelSearchViaTauri(activeSearchIdRef.current);
        activeSearchIdRef.current = null;
      }
      lastCompletedSearchIdRef.current = null;
      setStreamedMatches([]);
      setStreamMatchesCount(0);
      setIsStreaming(false);
      return;
    }

    // Cancel existing search before firing new one
    if (activeSearchIdRef.current) {
      cancelSearchViaTauri(activeSearchIdRef.current);
      activeSearchIdRef.current = null;
    }

    // Generate unique searchId in frontend synchronously to completely eliminate race conditions!
    const newSearchId = crypto.randomUUID();
    activeSearchIdRef.current = newSearchId;

    console.log(
      `%c[LogGrep:Frontend:SearchTrigger]%c searchId=${newSearchId.slice(0, 8)} | fileId=${fileHandle.fileId.slice(0, 8)} | query="${debouncedPattern}" | isRegex=${isRegex} | matchCase=${matchCase}`,
      "color: #8b5cf6; font-weight: bold",
      "color: inherit"
    );

    setStreamedMatches([]);
    setStreamMatchesCount(0);
    setStreamError(null);
    setIsStreaming(true);

    const targetFileId = fileHandle.fileId;

    searchLogViaTauri(targetFileId, debouncedPattern, isRegex, matchCase, newSearchId)
      .then((returnedSearchId) => {
        console.log(
          `%c[LogGrep:Frontend:SearchInvoked]%c searchId=${returnedSearchId?.slice(0, 8)} registered with Rust backend`,
          "color: #10b981; font-weight: bold",
          "color: inherit"
        );
        // If user switched file while searchLogViaTauri was starting, cancel it!
        if (currentFileIdRef.current !== targetFileId && returnedSearchId) {
          cancelSearchViaTauri(returnedSearchId);
        }
      })
      .catch((err) => {
        console.error(`[LogGrep:Frontend:SearchInvokeError]`, err);
        if (activeSearchIdRef.current === newSearchId) {
          setStreamError(String(err));
          setIsStreaming(false);
        }
      });

    return () => {
      if (activeSearchIdRef.current) {
        cancelSearchViaTauri(activeSearchIdRef.current);
        activeSearchIdRef.current = null;
      }
    };
  }, [fileHandle?.fileId, debouncedPattern, isRegex, matchCase]);

  // Total line count for full-file preview mode (lazy loaded)
  const previewTotalLines = fileHandle?.totalLines ?? 0;

  // In preview mode (no search), display total lines count so virtualizer
  // can scroll through the entire file. Lines are fetched on-demand.
  const currentDisplayCount = useMemo(() => {
    if (fileHandle) {
      if (debouncedPattern.trim()) {
        return streamedMatches.length;
      }
      // Full-file preview: virtualizer uses total line count
      return previewTotalLines;
    }
    return localFilterResult.lines.length;
  }, [fileHandle, debouncedPattern, streamedMatches.length, previewTotalLines, localFilterResult.lines.length]);

  // Unified display items list (for search results and paste-text mode)
  const currentDisplayItems: FilterLineResult[] = useMemo(() => {
    if (fileHandle) {
      if (debouncedPattern.trim()) {
        return streamedMatches;
      }
      // In preview mode, items are fetched lazily — return empty array
      // The virtualizer will call getLineContent for each visible row
      return [];
    }
    return localFilterResult.lines.slice(0, displayLimit);
  }, [fileHandle, debouncedPattern, streamedMatches, localFilterResult.lines, displayLimit]);

  // Check if we're in lazy-load preview mode (file open, no search query)
  const isLazyPreviewMode = fileHandle !== null && !debouncedPattern.trim();
  
  const totalMatchesAvailable = fileHandle ? (debouncedPattern.trim() ? streamMatchesCount : 0) : localFilterResult.lines.length;
  const hasMore = !isLazyPreviewMode && currentDisplayItems.length < totalMatchesAvailable;

  // Get line content from cache for preview mode
  const getLineContent = useCallback((lineNumber: number): string | null => {
    return lineCacheRef.current.get(lineNumber) ?? null;
  }, []);

  // Virtualizer for smooth 60fps scrolling
  const rowVirtualizer = useVirtualizer({
    count: isLazyPreviewMode ? currentDisplayCount : currentDisplayItems.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentScrollRef.current,
    estimateSize: () => 26,
    overscan: 30,
  });

  // Lazy-load lines when scrolling in preview mode
  useEffect(() => {
    if (!isLazyPreviewMode || !fileHandle) return;

    const virtualItems = rowVirtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const firstLine = virtualItems[0].index + 1; // 1-indexed
    const lastLine = virtualItems[virtualItems.length - 1].index + 1;

    // Add buffer around viewport for smoother scrolling
    const bufferSize = 50;
    const fetchStart = Math.max(1, firstLine - bufferSize);
    const fetchEnd = Math.min(previewTotalLines, lastLine + bufferSize);

    // Find uncached ranges within the viewport + buffer
    let rangeStart: number | null = null;
    const rangesToFetch: [number, number][] = [];

    for (let line = fetchStart; line <= fetchEnd; line++) {
      if (!lineCacheRef.current.has(line)) {
        if (rangeStart === null) rangeStart = line;
      } else {
        if (rangeStart !== null) {
          rangesToFetch.push([rangeStart, line - 1]);
          rangeStart = null;
        }
      }
    }
    if (rangeStart !== null) {
      rangesToFetch.push([rangeStart, fetchEnd]);
    }

    if (rangesToFetch.length === 0) return;

    // Fetch uncached ranges
    const fetchLines = async () => {
      for (const [start, end] of rangesToFetch) {
        const cacheKey = `${start}-${end}`;
        if (pendingFetchRef.current.has(cacheKey)) continue;
        pendingFetchRef.current.add(cacheKey);

        try {
          const lines = await getLinesViaTauri(fileHandle.fileId, start, end);
          if (currentFileIdRef.current !== fileHandle.fileId) return;

          for (const line of lines) {
            lineCacheRef.current.set(line.lineNumber, line.content);
          }
          evictCache();
          // Trigger re-render by updating a counter
          setPreviewLines((prev) => [...prev]); // Force re-render
        } finally {
          pendingFetchRef.current.delete(cacheKey);
        }
      }
    };

    fetchLines();
  }, [isLazyPreviewMode, fileHandle, previewTotalLines, rowVirtualizer.getVirtualItems(), evictCache]);

  // Handle jump to line
  const handleJumpToLine = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpLineInput, 10);
    if (isNaN(target) || target <= 0) return;

    if (isLazyPreviewMode) {
      // In lazy preview mode, virtualizer index = line number - 1
      const idx = Math.min(target - 1, previewTotalLines - 1);
      if (idx >= 0) {
        rowVirtualizer.scrollToIndex(idx, { align: "center" });
      }
    } else {
      const idx = currentDisplayItems.findIndex((it) => it.lineNumber >= target);
      if (idx !== -1) {
        rowVirtualizer.scrollToIndex(idx, { align: "center" });
      }
    }
  };

  // Close presets dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPresetDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopySingleLine = async (content: string, lineNumber: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedLineNumber(lineNumber);
      setTimeout(() => setCopiedLineNumber(null), 1500);
    } catch (err) {
      console.error("Failed to copy line:", err);
    }
  };

  const handleLoadMoreContext = async (targetLineNumber: number, delta: number = 5) => {
    if (fileHandle) {
      try {
        const start = Math.max(1, targetLineNumber - delta);
        const end = targetLineNumber + delta;
        const fetched = await getLinesViaTauri(fileHandle.fileId, start, end);
        if (fetched && fetched.length > 0) {
          setStreamedMatches((prev) => {
            const map = new Map<number, FilterLineResult>();
            for (const item of prev) {
              map.set(item.lineNumber, item);
            }
            for (const l of fetched) {
              if (!map.has(l.lineNumber)) {
                map.set(l.lineNumber, {
                  lineNumber: l.lineNumber,
                  content: l.content,
                  isMatch: false,
                  isContext: true,
                  highlights: [],
                });
              }
            }
            return Array.from(map.values()).sort((a, b) => a.lineNumber - b.lineNumber);
          });
        }
      } catch (err) {
        console.warn("Failed to fetch context lines:", err);
      }
    } else {
      setCustomExpandedLines((prev) => {
        const next = new Set(prev);
        for (let i = Math.max(0, targetLineNumber - 1 - delta); i <= targetLineNumber - 1 + delta; i++) {
          next.add(i);
        }
        return next;
      });
    }
  };

  // Fetch surrounding context lines in Tauri mode when contextLines > 0 and results are small enough
  useEffect(() => {
    if (!fileHandle || contextLines === 0 || !debouncedPattern.trim() || isStreaming) return;
    if (streamedMatches.length === 0 || streamedMatches.length > 60) return;

    let isCancelled = false;
    const fetchContextForMatches = async () => {
      const matchLines = streamedMatches.filter((m) => m.isMatch).map((m) => m.lineNumber);
      if (matchLines.length === 0) return;

      const ranges: [number, number][] = [];
      for (const lineNum of matchLines) {
        ranges.push([Math.max(1, lineNum - contextLines), lineNum + contextLines]);
      }

      ranges.sort((a, b) => a[0] - b[0]);
      const merged: [number, number][] = [];
      for (const [start, end] of ranges) {
        if (!merged.length || merged[merged.length - 1][1] < start - 1) {
          merged.push([start, end]);
        } else {
          merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);
        }
      }

      const allFetched: { lineNumber: number; content: string }[] = [];
      for (const [s, e] of merged) {
        if (isCancelled) return;
        const res = await getLinesViaTauri(fileHandle.fileId, s, e);
        allFetched.push(...res);
      }

      if (isCancelled) return;
      setStreamedMatches((prev) => {
        const map = new Map<number, FilterLineResult>();
        for (const item of prev) {
          map.set(item.lineNumber, item);
        }
        for (const l of allFetched) {
          if (!map.has(l.lineNumber)) {
            map.set(l.lineNumber, {
              lineNumber: l.lineNumber,
              content: l.content,
              isMatch: false,
              isContext: true,
              highlights: [],
            });
          }
        }
        return Array.from(map.values()).sort((a, b) => a.lineNumber - b.lineNumber);
      });
    };

    fetchContextForMatches();
    return () => {
      isCancelled = true;
    };
  }, [fileHandle, contextLines, isStreaming, debouncedPattern]);

  const isActivelySearching =
    isStreaming || (selectedFilePath !== null && pattern.trim() !== "" && pattern !== debouncedPattern);

  const handleApplyPreset = (preset: RegexPreset) => {
    setPattern(preset.pattern);
    setIsRegex(preset.isRegex ?? true);
    if (preset.invertMatch !== undefined) {
      setInvertMatch(preset.invertMatch);
    }
    setShowPresetDropdown(false);
  };

  const handleCloseFile = () => {
    console.log(`%c[LogGrep:Frontend:FileClose]%c closing fileId=${currentFileIdRef.current}`, "color: #ef4444; font-weight: bold", "color: inherit");
    if (activeSearchIdRef.current) {
      cancelSearchViaTauri(activeSearchIdRef.current);
      activeSearchIdRef.current = null;
    }
    lastCompletedSearchIdRef.current = null;
    if (currentFileIdRef.current) {
      closeLogFileViaTauri(currentFileIdRef.current);
      currentFileIdRef.current = null;
    }
    setSelectedFilePath(null);
    setFileHandle(null);
    setLoadedFileName(null);
    setIndexProgress(null);
    setStreamedMatches([]);
    setStreamMatchesCount(0);
    setStreamTotalMs(0);
    setStreamError(null);
    setPreviewLines([]);
    setCustomExpandedLines(new Set());
  };

  const handleReloadFile = async () => {
    if (!selectedFilePath || !isTauri()) return;
    console.log(`%c[LogGrep:Frontend:FileReload]%c path=${selectedFilePath}`, "color: #f59e0b; font-weight: bold", "color: inherit");
    try {
      if (activeSearchIdRef.current) {
        cancelSearchViaTauri(activeSearchIdRef.current);
        activeSearchIdRef.current = null;
      }
      lastCompletedSearchIdRef.current = null;
      if (currentFileIdRef.current) {
        closeLogFileViaTauri(currentFileIdRef.current);
        currentFileIdRef.current = null;
      }

      setFileHandle(null);
      setIndexProgress(null);
      setStreamedMatches([]);
      setStreamMatchesCount(0);
      setStreamTotalMs(0);
      setStreamError(null);
      setPreviewLines([]);
      setCustomExpandedLines(new Set());

      const handle = await openLogFileViaTauri(selectedFilePath);
      if (handle) {
        console.log(
          `%c[LogGrep:Frontend:FileReload:Success]%c fileId=${handle.fileId.slice(0, 8)} | size=${(handle.fileSize / 1048576).toFixed(2)}MB | status=${handle.indexStatus}`,
          "color: #10b981; font-weight: bold",
          "color: inherit"
        );
        currentFileIdRef.current = handle.fileId;
        const cachedProgress = latestIndexProgressRef.current.get(handle.fileId);
        const actualHandle: FileHandle = cachedProgress ? {
          ...handle,
          totalLines: cachedProgress.totalLines,
          indexStatus: cachedProgress.status,
        } : handle;
        setFileHandle(actualHandle);
        if (cachedProgress) {
          setIndexProgress(cachedProgress);
        }

        const preview = await getLinesViaTauri(handle.fileId, 1, 500);
        if (currentFileIdRef.current === handle.fileId) {
          setPreviewLines(
            preview.map((l) => ({
              lineNumber: l.lineNumber,
              content: l.content,
              isMatch: false,
              isContext: false,
              highlights: [],
            })),
          );
        }
      }
    } catch (err) {
      console.error("[LogGrep:Frontend:FileReload:Error]", err);
    }
  };

  const handleOpenFile = async () => {
    if (isTauri()) {
      try {
        const filePath = await pickLogFileViaTauri();
        if (filePath) {
          console.log(`%c[LogGrep:Frontend:FileOpen:Selected]%c path=${filePath}`, "color: #f59e0b; font-weight: bold", "color: inherit");
          // 1. Cancel previous search & close prior file in Rust
          if (activeSearchIdRef.current) {
            cancelSearchViaTauri(activeSearchIdRef.current);
            activeSearchIdRef.current = null;
          }
          lastCompletedSearchIdRef.current = null;
          if (currentFileIdRef.current) {
            closeLogFileViaTauri(currentFileIdRef.current);
            currentFileIdRef.current = null;
          }

          // 2. Clear UI states immediately
          setSelectedFilePath(filePath);
          const name = filePath.split("/").pop() || filePath.split("\\").pop() || filePath;
          setLoadedFileName(name);
          setFileHandle(null);
          setIndexProgress(null);
          setStreamedMatches([]);
          setStreamMatchesCount(0);
          setStreamTotalMs(0);
          setStreamError(null);
          setPreviewLines([]);
          setCustomExpandedLines(new Set());

          // 3. Open file via Rust Mmap & start background index
          const handle = await openLogFileViaTauri(filePath);
          if (handle) {
            console.log(
              `%c[LogGrep:Frontend:FileOpen:Success]%c fileId=${handle.fileId.slice(0, 8)} | size=${(handle.fileSize / 1048576).toFixed(2)}MB | status=${handle.indexStatus}`,
              "color: #10b981; font-weight: bold",
              "color: inherit"
            );
            currentFileIdRef.current = handle.fileId;
            const cachedProgress = latestIndexProgressRef.current.get(handle.fileId);
            const actualHandle: FileHandle = cachedProgress ? {
              ...handle,
              totalLines: cachedProgress.totalLines,
              indexStatus: cachedProgress.status,
            } : handle;
            setFileHandle(actualHandle);
            if (cachedProgress) {
              setIndexProgress(cachedProgress);
            }

            // Fetch initial 500 lines for immediate preview
            const preview = await getLinesViaTauri(handle.fileId, 1, 500);
            if (currentFileIdRef.current === handle.fileId) {
              setPreviewLines(
                preview.map((l) => ({
                  lineNumber: l.lineNumber,
                  content: l.content,
                  isMatch: false,
                  isContext: false,
                  highlights: [],
                })),
              );
            }
          }
          return;
        }
      } catch (err) {
        console.error("[LogGrep:Frontend:FileOpen:Error]", err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleCloseFile();
    setLoadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setLogText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyMatches = async () => {
    let fullItems: { content: string }[] = [];
    const searchIdToUse = lastCompletedSearchIdRef.current || activeSearchIdRef.current;
    if (fileHandle && searchIdToUse) {
      try {
        fullItems = await getSearchResultsViaTauri(searchIdToUse, 0, streamMatchesCount);
      } catch (err) {
        console.error("Failed to fetch full results for copy:", err);
        return;
      }
    } else {
      fullItems = localFilterResult.lines;
    }

    if (!fullItems.length) return;
    const textToCopy = fullItems.map((l) => l.content).join("\n");
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleExportMatches = async () => {
    console.log("[LogGrep:Frontend:Export] Clicked!", {
      fileHandle: !!fileHandle,
      isStreaming,
      searchIdToExport: lastCompletedSearchIdRef.current || activeSearchIdRef.current,
      streamMatchesCount,
    });

    setExportError(null);
    setExportSuccess(null);

    if (fileHandle) {
      if (isStreaming) {
        setExportError("Đang tìm kiếm, vui lòng đợi hoàn tất trước khi xuất file.");
        return;
      }
      const searchIdToExport = lastCompletedSearchIdRef.current || activeSearchIdRef.current;
      if (!searchIdToExport || streamMatchesCount === 0) {
        setExportError("Không có kết quả nào để xuất file. Vui lòng nhập từ khóa tìm kiếm.");
        return;
      }

      setIsExporting(true);
      try {
        const defaultName = `filtered_${loadedFileName || "log"}.txt`;
        const savedPath = await exportSearchResultsViaTauri(searchIdToExport, defaultName);
        if (savedPath) {
          setExportSuccess(`Đã lưu file thành công (${streamMatchesCount.toLocaleString()} dòng) tới: ${savedPath}`);
          setTimeout(() => setExportSuccess(null), 6000);
        }
      } catch (err) {
        console.error("Failed to export via Tauri:", err);
        setExportError(`Lỗi khi xuất file: ${err}`);
      } finally {
        setIsExporting(false);
      }
    } else {
      const fullItems = localFilterResult.lines;
      if (!fullItems.length) {
        setExportError("Không có dòng nào để xuất.");
        return;
      }
      const textToExport = fullItems.map((l) => l.content).join("\n");
      const blob = new Blob([textToExport], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `filtered_${loadedFileName || "log"}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Render highlights inside a single line
  const renderHighlightedContent = (line: FilterLineResult) => {
    if (line.highlights.length === 0 || !line.isMatch) {
      return line.content;
    }

    const sortedRanges = [...line.highlights].sort((a, b) => a.start - b.start);
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedRanges.forEach((range, idx) => {
      if (range.start > lastIndex) {
        elements.push(line.content.substring(lastIndex, range.start));
      }
      elements.push(
        <mark
          key={idx}
          className="bg-amber-300 dark:bg-amber-500/50 text-amber-950 dark:text-amber-100 font-semibold px-0.5 rounded-sm"
        >
          {line.content.substring(range.start, range.end)}
        </mark>,
      );
      lastIndex = Math.max(lastIndex, range.end);
    });

    if (lastIndex < line.content.length) {
      elements.push(line.content.substring(lastIndex));
    }

    return elements;
  };

  const quickLevelButtons = [
    {
      label: "ERROR",
      pattern: "\\b(ERROR|FATAL|CRITICAL)\\b",
      isRegex: true,
      invert: false,
      color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60",
    },
    {
      label: "WARN",
      pattern: "\\b(WARN|WARNING)\\b",
      isRegex: true,
      invert: false,
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60",
    },
    {
      label: "INFO",
      pattern: "\\bINFO\\b",
      isRegex: true,
      invert: false,
      color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900/60",
    },
    {
      label: "DEBUG",
      pattern: "\\b(DEBUG|TRACE)\\b",
      isRegex: true,
      invert: false,
      color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
    {
      label: "Non-Info Only",
      pattern: "\\b(INFO|DEBUG)\\b",
      isRegex: true,
      invert: true,
      color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900/60",
    },
  ];

  // Dynamic statistics
  const totalSourceLines = fileHandle
    ? (indexProgress?.totalLines || fileHandle.totalLines)
    : localFilterResult.totalSourceLines;

  const matchedCount = fileHandle
    ? (debouncedPattern.trim() ? streamMatchesCount : 0)
    : localFilterResult.matchedCount;

  const fileSizeBytes = fileHandle?.fileSize;
  const executionTimeMs = fileHandle ? streamTotalMs : localFilterResult.executionTimeMs;

  const configuration = (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full text-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Layout:</span>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
            <button
              onClick={() => setActiveView("split")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeView === "split"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setActiveView("results")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeView === "results"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Results Only
            </button>
            <button
              onClick={() => setActiveView("source")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeView === "source"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Source Log
            </button>
          </div>
        </div>

        {/* Context Lines Configuration: 0, ±1, ±5, ±10, ±15 */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {language === "vi" ? "Ngữ cảnh:" : "Context:"}
          </span>
          {[0, 1, 5, 10, 15].map((count) => (
            <button
              key={count}
              onClick={() => setContextLines(count)}
              className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                contextLines === count
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title={
                count === 0
                  ? (language === "vi" ? "Không lấy dòng ngữ cảnh" : "No context lines")
                  : (language === "vi"
                      ? `Lấy ${count} dòng trước và sau kết quả đồng nhất`
                      : `±${count} lines before and after`)
              }
            >
              {count === 0 ? "0" : `±${count}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <ToolLayout
      id="log-grep"
      title="Log Grep & Filter"
      description="Stream, grep and analyze multi-GB logs using Rust SIMD mmap, background trigram indexing, and parallel search"
      icon={ListFilter}
      categoryName="Text Utilities"
      configuration={configuration}
      customPanes={
        <div className="flex flex-col gap-3 flex-1 w-full h-[calc(100vh-210px)] min-h-[500px] overflow-hidden">
          {/* Main Search Bar & Filter Options */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder={
                    isRegex
                      ? "Filter with Regex pattern... (e.g. \\bERROR\\b, \\d{4}-\\d{2}-\\d{2})"
                      : "Search log by keyword or phrase..."
                  }
                  spellCheck={false}
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
                {pattern && (
                  <button
                    onClick={() => setPattern("")}
                    className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mode Toggles */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setIsRegex(!isRegex)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
                    isRegex
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                  title="Toggle Regex (.*)"
                >
                  .*
                </button>
                <button
                  onClick={() => setMatchCase(!matchCase)}
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                    matchCase
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                  title="Match Case (Aa)"
                >
                  Aa
                </button>
                <button
                  onClick={() => setWholeWord(!wholeWord)}
                  disabled={isRegex}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
                    wholeWord && !isRegex
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
                  }`}
                  title="Whole Word (\\b)"
                >
                  \b
                </button>
                <button
                  onClick={() => setInvertMatch(!invertMatch)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
                    invertMatch
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                  title="Invert Match (grep -v)"
                >
                  ! Invert
                </button>
              </div>

              {/* Presets Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Presets</span>
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </button>

                {showPresetDropdown && (
                  <div className="absolute right-0 mt-1.5 w-80 max-h-96 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="p-1.5 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Common Log Patterns
                    </div>
                    <div className="py-1 space-y-0.5">
                      {LOG_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleApplyPreset(preset)}
                          className="w-full text-left p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {preset.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
                              {preset.category}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {preset.description}
                          </span>
                          <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 truncate pt-0.5">
                            {preset.pattern}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Regex Warning Hint */}
            {pattern && !isRegex && /(\b|\||\(|\)|\^|\$)/.test(pattern) && (
              <button
                onClick={() => setIsRegex(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                title="Click to turn on Regex mode"
              >
                <span>⚠️ Ký tự Regex được phát hiện nhưng Regex đang tắt. Nhấn để bật (.*)</span>
              </button>
            )}

            {/* Quick Level Chips & Filter Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px] mr-0.5 font-medium">Quick Levels:</span>
                {quickLevelButtons.map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => {
                      setPattern(btn.pattern);
                      setIsRegex(btn.isRegex);
                      setInvertMatch(btn.invert);
                    }}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-all ${
                      btn.color || "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Match Counters / Preview Mode */}
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                {!debouncedPattern.trim() ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-sans font-medium text-[11px] border border-indigo-200 dark:border-indigo-800">
                      <FileText className="w-3 h-3 text-indigo-500" />
                      {language === "vi" ? "Chế độ Xem trước" : "Preview Mode"}
                    </span>
                    <span>
                      {language === "vi"
                        ? `Xem trước 500 dòng đầu • Dung lượng: ${formatFileSize(fileSizeBytes)}`
                        : `Previewing first 500 lines • Size: ${formatFileSize(fileSizeBytes)}`}
                    </span>
                  </>
                ) : isActivelySearching ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5 animate-pulse">
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {language === "vi"
                        ? `Đang tìm... ${matchedCount.toLocaleString()} kết quả`
                        : `Searching... ${matchedCount.toLocaleString()} matches`}
                    </span>
                  </span>
                ) : (
                  <>
                    <span>
                      {language === "vi" ? "Khớp:" : "Matches:"}{" "}
                      <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {matchedCount.toLocaleString()}
                      </strong>{" "}
                      / {totalSourceLines.toLocaleString()} {language === "vi" ? "dòng" : "lines"}
                      {fileSizeBytes ? (
                        <span className="text-slate-400 font-normal">
                          {" "}({formatFileSize(fileSizeBytes)})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-slate-400">
                      ({executionTimeMs}ms)
                    </span>
                    {fileHandle && (
                      <span
                        className="text-emerald-700 dark:text-emerald-300 font-sans font-medium text-[10px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
                        title={
                          language === "vi"
                            ? "Rayon parallel search + Trigram Bloom filter skip index"
                            : "Rayon parallel search + Trigram Bloom filter skip index"
                        }
                      >
                        ✓ {language === "vi" ? "Đã quét cả file" : "Scanned full file"}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Background Indexing Progress Bar */}
          {fileHandle && fileHandle.indexStatus === "indexing" && (
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 text-xs shrink-0 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <span>
                  {language === "vi"
                    ? `Đang lập chỉ mục nền: ${(indexProgress?.percent || 0).toFixed(1)}%`
                    : `Indexing file in background: ${(indexProgress?.percent || 0).toFixed(1)}%`}
                </span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${indexProgress?.percent || 0}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                {(indexProgress?.totalLines || 0).toLocaleString()} {language === "vi" ? "dòng" : "lines"}
              </span>
            </div>
          )}

          {/* Panes Area */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className={`flex-1 min-h-0 grid gap-4 ${
                activeView === "split"
                  ? "grid-cols-1 lg:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {/* Pane 1: Source Log Input / Disk Streaming Status Card */}
              {(activeView === "split" || activeView === "source") && (
                <div className="flex flex-col h-full min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                    <div className="flex items-center gap-2">
                      {selectedFilePath ? (
                        <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{selectedFilePath ? "Disk File (Rayon & Bloom Index)" : "Source Log"}</span>
                      {loadedFileName && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-normal truncate max-w-xs">
                          {loadedFileName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".log,.txt,.json,.out,.csv"
                      />
                      <button
                        onClick={handleOpenFile}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold transition-colors"
                        title="Open file from disk (handles 40GB+ instantly)"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>{selectedFilePath ? "Change File" : "Open File (40GB+)"}</span>
                      </button>
                      {selectedFilePath && (
                        <>
                          <button
                            onClick={handleReloadFile}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors border border-slate-200 dark:border-slate-700"
                            title={language === "vi" ? "Tải lại file từ ổ đĩa (quét lại nội dung mới nhất)" : "Reload file from disk"}
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>{language === "vi" ? "Tải lại" : "Reload"}</span>
                          </button>
                          <button
                            onClick={handleCloseFile}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors border border-slate-200 dark:border-slate-700"
                            title={language === "vi" ? "Đóng file và chuyển về nhập text" : "Close file"}
                          >
                            <X className="w-3 h-3" />
                            <span>{language === "vi" ? "Đóng" : "Close"}</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleCloseFile}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title={language === "vi" ? "Xóa nguồn" : "Clear source"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {selectedFilePath ? (
                    <div className="flex-1 min-h-0 p-5 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-950/40 overflow-y-auto">
                      <div className="space-y-3.5">
                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                            <HardDrive className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                                {loadedFileName}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                                <Zap className="w-3 h-3" />
                                Rayon + Bloom Filter
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={selectedFilePath}>
                              {selectedFilePath}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-xs">
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-400 text-[11px]">{language === "vi" ? "Dung lượng file" : "File Size"}</span>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                              {formatFileSize(fileSizeBytes)}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-400 text-[11px]">{language === "vi" ? "Tổng số dòng" : "Total Lines"}</span>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                              {fileHandle && fileHandle.indexStatus === "indexing" && totalSourceLines <= 1 
                                ? (language === "vi" ? "Đang đếm..." : "Counting...")
                                : totalSourceLines.toLocaleString()}
                              <span className="text-[10px] text-slate-400 font-normal block">
                                {debouncedPattern.trim() ? (language === "vi" ? "(Toàn bộ file)" : "(Full file)") : (language === "vi" ? "(Xem trước)" : "(Preview)")}
                              </span>
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-400 text-[11px]">{language === "vi" ? "Số dòng khớp" : "Matching Lines"}</span>
                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                              {debouncedPattern.trim() 
                                ? `${matchedCount.toLocaleString()}${streamError?.includes("Reached maximum display limit") ? "+" : ""}`
                                : (language === "vi" ? "Chờ tìm" : "-")}
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed">
                          <p className="font-semibold flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <strong>High-Throughput Streaming Engine</strong>
                          </p>
                          <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                            {language === "vi"
                              ? "Ánh xạ bộ nhớ ảo Zero-Copy với Memmap2. Chia khối 8MB và xây dựng Trigram Bloom Filter nền để loại bỏ khối không liên quan. Rayon song song quét đa luồng, trả kết quả dạng stream qua Tauri Event."
                              : "Zero-copy memory mapping via Memmap2. 8MB block chunking with background Trigram Bloom filters for early rejection. Rayon multi-threaded search streams matches in real-time batches."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                          onClick={handleOpenFile}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>{language === "vi" ? "Mở file khác" : "Open Another File"}</span>
                        </button>
                        <button
                          onClick={handleReloadFile}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                          title={language === "vi" ? "Tải lại file từ ổ đĩa (quét lại nội dung mới nhất)" : "Reload file from disk"}
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>{language === "vi" ? "Tải lại" : "Reload"}</span>
                        </button>
                        <button
                          onClick={handleCloseFile}
                          className="py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                        >
                          {language === "vi" ? "Chuyển sang dán text" : "Switch to Paste Text Mode"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={logText}
                      onChange={(e) => setLogText(e.target.value)}
                      placeholder="Paste or drag & drop log text here..."
                      spellCheck={false}
                      className="flex-1 min-h-0 w-full p-3 font-mono text-xs leading-relaxed bg-transparent resize-none overflow-y-auto focus:outline-none text-slate-800 dark:text-slate-200"
                    />
                  )}
                </div>
              )}

              {/* Pane 2: Filtered & Highlighted Results */}
              {(activeView === "split" || activeView === "results") && (
                <div className="flex flex-col h-full min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex-1">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                    <div className="flex items-center gap-2">
                      <ListFilter className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Filtered Results</span>
                      <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                        ({(isLazyPreviewMode ? previewTotalLines : totalMatchesAvailable).toLocaleString()} lines)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Jump to Line Form */}
                      <form onSubmit={handleJumpToLine} className="flex items-center gap-1">
                        <input
                          type="number"
                          value={jumpLineInput}
                          onChange={(e) => setJumpLineInput(e.target.value)}
                          placeholder={language === "vi" ? "Đến dòng..." : "Line #..."}
                          className="w-20 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="p-1 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                          title="Jump to line"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </form>

                      <button
                        onClick={handleCopyMatches}
                        disabled={currentDisplayItems.length === 0}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                        title="Copy all matching lines"
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copied ? "Copied" : "Copy All"}</span>
                      </button>
                      <button
                        onClick={handleExportMatches}
                        disabled={currentDisplayItems.length === 0 || isExporting}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                        title="Export matched lines to text file"
                      >
                        {isExporting ? (
                          <RotateCw className="w-3 h-3 animate-spin text-indigo-500" />
                        ) : exportSuccess ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>{isExporting ? "Exporting..." : exportSuccess ? "Exported!" : "Export"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Results Viewer with Virtualized Scroll */}
                  <div
                    ref={parentScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-auto font-mono text-xs bg-slate-50/50 dark:bg-slate-950/70 select-text"
                  >
                    {exportSuccess && (
                      <div className="sticky top-0 z-10 w-full flex items-center justify-between p-2 bg-emerald-600 text-white shadow-sm font-sans text-xs gap-2 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 flex-shrink-0" />
                          <span>{exportSuccess}</span>
                        </div>
                        <button onClick={() => setExportSuccess(null)} className="p-0.5 hover:bg-emerald-700 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {exportError && (
                      <div className="sticky top-0 z-10 w-full flex items-center justify-between p-2 bg-rose-600 text-white shadow-sm font-sans text-xs gap-2 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{exportError}</span>
                        </div>
                        <button onClick={() => setExportError(null)} className="p-0.5 hover:bg-rose-700 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {streamError && (
                      <div className="sticky top-0 z-10 w-full flex items-center justify-center p-2 bg-amber-500/90 dark:bg-amber-600/90 text-white shadow-sm font-sans text-xs gap-2 backdrop-blur-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium truncate">{streamError}</span>
                      </div>
                    )}
                    {isActivelySearching && pattern.trim() !== "" && currentDisplayItems.length === 0 ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 font-sans gap-3 p-8 select-none">
                        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm animate-pulse">
                          <Zap className="w-6 h-6 animate-bounce" />
                        </div>
                        <div className="text-center max-w-sm">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {language === "vi"
                              ? `Đang quét toàn bộ file tìm "${pattern}"...`
                              : `Scanning entire file for "${pattern}"...`}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {language === "vi"
                              ? `Rayon đa luồng + Trigram Bloom Filter đang quét ${fileSizeBytes ? formatFileSize(fileSizeBytes) : "file log"}...`
                              : `Rayon multi-threaded search + Bloom filter scanning ${fileSizeBytes ? formatFileSize(fileSizeBytes) : "log file"}...`}
                          </p>
                        </div>
                      </div>
                    ) : !isLazyPreviewMode && currentDisplayItems.length === 0 ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 font-sans gap-3 p-8 select-none">
                        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                          <SearchX className="w-7 h-7 stroke-[1.5]" />
                        </div>
                        <div className="text-center max-w-md">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {debouncedPattern
                              ? (language === "vi" ? "Không tìm thấy kết quả nào" : "No matching results found")
                              : (language === "vi" ? "Chưa có dữ liệu lọc" : "No filter query entered")}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {debouncedPattern
                              ? (language === "vi"
                                  ? `Đã quét toàn bộ file ${fileSizeBytes ? `(${formatFileSize(fileSizeBytes)})` : ""} nhưng không có dòng log nào khớp với "${debouncedPattern}".`
                                  : `Scanned entire file ${fileSizeBytes ? `(${formatFileSize(fileSizeBytes)})` : ""}, but no log lines matched "${debouncedPattern}".`)
                              : (language === "vi"
                                  ? "Nhập từ khóa hoặc biểu thức Regex vào thanh tìm kiếm phía trên để lọc dòng log."
                                  : "Enter a search term or regex pattern above to filter lines.")}
                          </p>
                          {debouncedPattern && (
                            <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
                              <span className="font-semibold">{language === "vi" ? "Gợi ý:" : "Tip:"}</span>
                              <span>
                                {language === "vi"
                                  ? "Thử tắt Phân biệt hoa/thường (Aa), Từ nguyên vẹn (\\b) hoặc kiểm tra lại cú pháp Regex."
                                  : "Try toggling Case Sensitivity (Aa), Whole Word (\\b), or checking Regex syntax."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: `${rowVirtualizer.getTotalSize()}px`,
                          width: "100%",
                          position: "relative",
                        }}
                      >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          // In lazy preview mode, resolve line from LRU cache
                          let line: FilterLineResult | null | undefined;
                          if (isLazyPreviewMode) {
                            const lineNum = virtualRow.index + 1;
                            const cached = getLineContent(lineNum);
                            line = {
                              lineNumber: lineNum,
                              content: cached ?? "",
                              isMatch: false,
                              isContext: false,
                              highlights: [],
                            };
                          } else {
                            line = currentDisplayItems[virtualRow.index];
                          }
                          if (!isLazyPreviewMode && hasMore && virtualRow.index === currentDisplayItems.length) {
                            return (
                              <div
                                key="load-more"
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: `${virtualRow.size}px`,
                                  transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className="flex items-center justify-center border-b border-slate-100/60 dark:border-slate-900/40"
                              >
                                <button
                                  onClick={async () => {
                                    const searchIdToUse = lastCompletedSearchIdRef.current || activeSearchIdRef.current;
                                    if (fileHandle && searchIdToUse) {
                                      const newLimit = displayLimit + 500;
                                      try {
                                        const nextPage = await getSearchResultsViaTauri(searchIdToUse, streamedMatches.length, 500);
                                        const mapped: FilterLineResult[] = nextPage.map((m) => ({
                                          lineNumber: m.lineNumber,
                                          content: m.content,
                                          isMatch: true,
                                          isContext: false,
                                          highlights: m.highlights,
                                        }));
                                        setStreamedMatches(prev => [...prev, ...mapped]);
                                        setDisplayLimit(newLimit);
                                      } catch (err) {
                                        console.error("Failed to load more results", err);
                                      }
                                    } else {
                                      setDisplayLimit((prev) => prev + 500);
                                    }
                                  }}
                                  className="px-4 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm"
                                >
                                  {language === "vi" ? `Tải thêm 500 kết quả... (${totalMatchesAvailable - currentDisplayItems.length} dòng)` : `Load 500 more results... (${totalMatchesAvailable - currentDisplayItems.length} remaining)`}
                                </button>
                              </div>
                            );
                          }

                          if (!line) return null;


                          return (
                            <div
                              key={virtualRow.index}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                              className={`group flex items-center hover:bg-slate-100/80 dark:hover:bg-slate-900/90 transition-colors border-b border-slate-100/60 dark:border-slate-900/40 ${
                                line.isContext
                                  ? "opacity-75 bg-slate-100/30 dark:bg-slate-900/30 italic"
                                  : line.isMatch
                                    ? "bg-indigo-50/20 dark:bg-indigo-950/10"
                                    : ""
                              }`}
                            >
                              {/* Line Number Gutter */}
                              <span
                                className={`w-14 shrink-0 px-2 py-0.5 text-right select-none pointer-events-none border-r border-slate-200 dark:border-slate-800 font-mono text-[11px] ${
                                  line.isMatch
                                    ? "text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/40 dark:bg-indigo-950/30"
                                    : "text-slate-400"
                                }`}
                              >
                                {line.lineNumber}
                              </span>

                              {/* Line Content */}
                              <div className="flex-1 px-3 py-0.5 whitespace-pre break-all text-slate-800 dark:text-slate-200 leading-normal select-text cursor-text overflow-hidden text-ellipsis">
                                {renderHighlightedContent(line)}
                              </div>

                              {/* Hover Load More Context button */}
                              <button
                                onClick={() => handleLoadMoreContext(line.lineNumber, 5)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 mr-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-sans font-medium select-none shrink-0"
                                title={
                                  language === "vi"
                                    ? `Tải thêm ±5 dòng ngữ cảnh xung quanh dòng ${line.lineNumber}`
                                    : `Load ±5 context lines around line ${line.lineNumber}`
                                }
                              >
                                <UnfoldVertical className="w-3 h-3" />
                                <span>±5</span>
                              </button>

                              {/* Hover Copy single line button */}
                              <button
                                onClick={() => handleCopySingleLine(line.content, line.lineNumber)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mr-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 select-none shrink-0"
                                title={`Copy line ${line.lineNumber}`}
                              >
                                {copiedLineNumber === line.lineNumber ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
};
