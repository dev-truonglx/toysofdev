import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ListFilter,
  Search,
  Upload,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  ChevronDown,
  X,
  FileText,
  RotateCcw,
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { FilterOptions, FilterLineResult, RegexPreset } from "./types";
import { filterLogLines } from "./logFilterEngine";
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
  const [logText, setLogText] = useState(DEFAULT_SAMPLE_LOG);
  const [pattern, setPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [invertMatch, setInvertMatch] = useState(false);
  const [contextLines, setContextLines] = useState<number>(0);

  const [debouncedPattern, setDebouncedPattern] = useState(pattern);
  const [copied, setCopied] = useState(false);
  const [copiedLineNumber, setCopiedLineNumber] = useState<number | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"split" | "results" | "source">("split");
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(500);
  const [customExpandedLines, setCustomExpandedLines] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search query to keep input responsive
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPattern(pattern);
    }, 120);
    return () => clearTimeout(handler);
  }, [pattern]);

  // Reset custom expansions when pattern or log text changes
  useEffect(() => {
    setCustomExpandedLines(new Set());
  }, [debouncedPattern, logText]);

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

  const expandAbove = (targetLineNumber: number, count = 5) => {
    const targetIdx = targetLineNumber - 1;
    const startIdx = Math.max(0, targetIdx - count);
    setCustomExpandedLines((prev) => {
      const next = new Set(prev);
      for (let i = startIdx; i < targetIdx; i++) {
        next.add(i);
      }
      return next;
    });
  };

  const expandBelow = (targetLineNumber: number, count = 5) => {
    const targetIdx = targetLineNumber - 1;
    const total = logText ? logText.split(/\r\n|\r|\n/).length : 0;
    const endIdx = Math.min(total - 1, targetIdx + count);
    setCustomExpandedLines((prev) => {
      const next = new Set(prev);
      for (let i = targetIdx + 1; i <= endIdx; i++) {
        next.add(i);
      }
      return next;
    });
  };

  const expandGap = (fromLineNumber: number, toLineNumber: number) => {
    const startIdx = Math.max(0, fromLineNumber - 1);
    const total = logText ? logText.split(/\r\n|\r|\n/).length : 0;
    const endIdx = Math.min(total - 1, toLineNumber - 1);
    const count = endIdx - startIdx + 1;
    if (count > 0) {
      setVisibleLimit((prev) => Math.max(prev, prev + count));
    }
    setCustomExpandedLines((prev) => {
      const next = new Set(prev);
      for (let i = startIdx; i <= endIdx; i++) {
        next.add(i);
      }
      return next;
    });
  };

  const handleCopySingleLine = async (content: string, lineNumber: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedLineNumber(lineNumber);
      setTimeout(() => setCopiedLineNumber(null), 1500);
    } catch (err) {
      console.error("Failed to copy line:", err);
    }
  };

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

  const filterResult = useMemo(() => {
    return filterLogLines(logText, filterOptions);
  }, [logText, filterOptions]);

  const handleApplyPreset = (preset: RegexPreset) => {
    setPattern(preset.pattern);
    setIsRegex(preset.isRegex ?? true);
    if (preset.invertMatch !== undefined) {
      setInvertMatch(preset.invertMatch);
    }
    setShowPresetDropdown(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setLogText(content);
        setVisibleLimit(500);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyMatches = async () => {
    if (!filterResult.lines.length) return;
    const textToCopy = filterResult.lines
      .map((l, idx, arr) => {
        if (idx > 0 && l.lineNumber > arr[idx - 1].lineNumber + 1) {
          return `--\n${l.content}`;
        }
        return l.content;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleExportMatches = () => {
    if (!filterResult.lines.length) return;
    const textToExport = filterResult.lines
      .map((l, idx, arr) => {
        if (idx > 0 && l.lineNumber > arr[idx - 1].lineNumber + 1) {
          return `--\n${l.content}`;
        }
        return l.content;
      })
      .join("\n");
    const blob = new Blob([textToExport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filtered_${loadedFileName || "log"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render highlights inside a single line
  const renderHighlightedContent = (line: FilterLineResult) => {
    if (line.highlights.length === 0 || !line.isMatch) {
      return line.content;
    }

    // Sort ranges ascending by start
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

  const visibleLines = useMemo(() => {
    return filterResult.lines.slice(0, visibleLimit);
  }, [filterResult.lines, visibleLimit]);

  const quickLevelButtons = [
    { label: "ALL", pattern: "", isRegex: false, invert: false, color: "hover:bg-slate-200 dark:hover:bg-slate-800" },
    {
      label: "ERROR",
      pattern: "\\b(FATAL|CRITICAL|ERROR|SEVERE)\\b",
      isRegex: true,
      invert: false,
      color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60",
    },
    {
      label: "WARN",
      pattern: "\\bWARN(ING)?\\b",
      isRegex: true,
      invert: false,
      color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
    },
    {
      label: "INFO",
      pattern: "\\bINFO\\b",
      isRegex: true,
      invert: false,
      color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60",
    },
    {
      label: "DEBUG",
      pattern: "\\b(DEBUG|TRACE)\\b",
      isRegex: true,
      invert: false,
      color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60",
    },
  ];

  const configuration = (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs w-full">
      {/* Context lines picker & Manual expand status */}
      <div className="flex items-center gap-2 flex-wrap text-slate-700 dark:text-slate-300">
        <span className="text-slate-400 font-medium">Context (± lines):</span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
          {[0, 1, 5, 10, 15].map((cnt) => (
            <button
              key={cnt}
              onClick={() => setContextLines(cnt)}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                contextLines === cnt
                  ? "bg-indigo-600 text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
              title={
                cnt === 0
                  ? "Only show matching lines (0 context lines)"
                  : `Show exactly ${cnt} lines before and ${cnt} lines after each match`
              }
            >
              {cnt === 0 ? "0 (None)" : `±${cnt}`}
            </button>
          ))}
        </div>

        {customExpandedLines.size > 0 && (
          <button
            onClick={() => setCustomExpandedLines(new Set())}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/80 text-[11px] font-medium transition-colors"
            title="Reset on-demand expanded lines to base context"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset {customExpandedLines.size} extra lines</span>
          </button>
        )}
      </div>

      {/* View Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-slate-600 dark:text-slate-400">
        <button
          onClick={() => setActiveView("split")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === "split"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Split
        </button>
        <button
          onClick={() => setActiveView("results")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === "results"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Results Only
        </button>
        <button
          onClick={() => setActiveView("source")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === "source"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Source Log
        </button>
      </div>
    </div>
  );

  return (
    <ToolLayout
      id="log-grep"
      title="Log Grep & Filter"
      description="Filter, grep and analyze log lines using literal text or regular expressions with context lines and preset patterns"
      icon={ListFilter}
      categoryName="Text Utilities"
      configuration={configuration}
      error={filterResult.error}
      customPanes={
        <div className="flex flex-col gap-3.5 flex-1 min-h-[600px] w-full">
          {/* Main Search Bar & Filter Options */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-3">
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
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setIsRegex(!isRegex)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
                    isRegex
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                  title="Regular Expression Mode (.*)"
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

              {/* Match Counters */}
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                <span>
                  Matches:{" "}
                  <strong className="text-indigo-600 dark:text-indigo-400">
                    {filterResult.matchedCount}
                  </strong>{" "}
                  / {filterResult.totalSourceLines} lines
                </span>
                <span className="text-slate-400">({filterResult.executionTimeMs}ms)</span>
              </div>
            </div>
          </div>

          {/* Panes Area */}
          <div className="flex-1 grid grid-cols-1 gap-4 min-h-[480px]">
            {/* Split or conditional layout */}
            <div
              className={`flex-1 grid gap-4 ${
                activeView === "split"
                  ? "grid-cols-1 lg:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {/* Pane 1: Source Log Input */}
              {(activeView === "split" || activeView === "source") && (
                <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Source Log</span>
                      {loadedFileName && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-normal">
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
                        accept=".log,.txt,.json,.out"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                        title="Upload log file (.log, .txt, .json)"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Open File</span>
                      </button>
                      <button
                        onClick={() => {
                          setLogText("");
                          setLoadedFileName(null);
                        }}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Clear source text"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    placeholder="Paste or drag & drop log text here..."
                    spellCheck={false}
                    className="flex-1 w-full p-3 font-mono text-xs leading-relaxed bg-transparent resize-none focus:outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}

              {/* Pane 2: Filtered & Highlighted Results */}
              {(activeView === "split" || activeView === "results") && (
                <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex-1">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <ListFilter className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Filtered Results</span>
                      <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                        ({filterResult.lines.length} lines)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyMatches}
                        disabled={filterResult.lines.length === 0}
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
                        disabled={filterResult.lines.length === 0}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                        title="Export matched lines to text file"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>

                  {/* Results Viewer with Line Numbers */}
                  <div className="flex-1 overflow-auto font-mono text-xs bg-slate-50/50 dark:bg-slate-950/70 select-text">
                    {filterResult.lines.length === 0 ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 font-sans gap-2 p-6 select-none">
                        <ListFilter className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-700" />
                        <span className="italic text-center">
                          {debouncedPattern
                            ? "No matching log lines found for current query"
                            : "Enter a search term or regex pattern above to filter lines"}
                        </span>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-900/80">
                        {/* Top omitted lines gap */}
                        {visibleLines.length > 0 && visibleLines[0].lineNumber > 1 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 bg-slate-100/80 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 select-none text-[11px] font-mono text-slate-500">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              ··· {visibleLines[0].lineNumber - 1} lines omitted before line {visibleLines[0].lineNumber} ···
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => expandAbove(visibleLines[0].lineNumber, 5)}
                                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                                title={`Expand 5 lines before line ${visibleLines[0].lineNumber}`}
                              >
                                ▲ +5 above
                              </button>
                              <button
                                onClick={() => expandAbove(visibleLines[0].lineNumber, 10)}
                                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                                title={`Expand 10 lines before line ${visibleLines[0].lineNumber}`}
                              >
                                ▲ +10 above
                              </button>
                              <button
                                onClick={() => expandGap(1, visibleLines[0].lineNumber - 1)}
                                className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-sans font-medium text-indigo-700 dark:text-indigo-300 transition-colors shadow-2xs"
                                title="Expand all lines from beginning of file"
                              >
                                Expand all ({visibleLines[0].lineNumber - 1})
                              </button>
                            </div>
                          </div>
                        )}

                        {visibleLines.map((line, idx) => {
                          const showDivider =
                            idx > 0 && line.lineNumber > visibleLines[idx - 1].lineNumber + 1;
                          const prevLine = idx > 0 ? visibleLines[idx - 1] : null;
                          const omittedCount =
                            showDivider && prevLine ? line.lineNumber - prevLine.lineNumber - 1 : 0;
                          const fromLine = prevLine ? prevLine.lineNumber + 1 : 1;
                          const toLine = line.lineNumber - 1;

                          return (
                            <React.Fragment key={idx}>
                              {showDivider && prevLine && (
                                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 bg-slate-100/80 dark:bg-slate-900/90 border-y border-slate-200/80 dark:border-slate-800/80 select-none text-[11px] font-mono text-slate-500">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                                      ··· {omittedCount} lines omitted (lines {fromLine}–{toLine}) ···
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => expandBelow(prevLine.lineNumber, 5)}
                                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                                      title={`Expand 5 lines after line ${prevLine.lineNumber}`}
                                    >
                                      ▼ +5 below
                                    </button>
                                    <button
                                      onClick={() => expandAbove(line.lineNumber, 5)}
                                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                                      title={`Expand 5 lines before line ${line.lineNumber}`}
                                    >
                                      ▲ +5 above
                                    </button>
                                    <button
                                      onClick={() => expandGap(fromLine, toLine)}
                                      className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-sans font-medium text-indigo-700 dark:text-indigo-300 transition-colors shadow-2xs"
                                      title={`Expand all ${omittedCount} lines in this gap`}
                                    >
                                      Expand all ({omittedCount})
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div
                                className={`group flex items-start hover:bg-slate-100/80 dark:hover:bg-slate-900/90 transition-colors ${
                                  line.isContext
                                    ? "opacity-75 bg-slate-100/30 dark:bg-slate-900/30 italic"
                                    : "bg-indigo-50/20 dark:bg-indigo-950/10"
                                }`}
                              >
                                {/* Line Number Gutter */}
                                <span
                                  className={`w-14 shrink-0 px-2 py-1 text-right select-none pointer-events-none border-r border-slate-200 dark:border-slate-800 font-mono text-[11px] ${
                                    line.isMatch
                                      ? "text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/40 dark:bg-indigo-950/30"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {line.lineNumber}
                                </span>

                                {/* Line Content - fully selectable & copyable */}
                                <div className="flex-1 px-3 py-1 whitespace-pre-wrap break-all text-slate-800 dark:text-slate-200 leading-relaxed select-text cursor-text">
                                  {renderHighlightedContent(line)}
                                </div>

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
                            </React.Fragment>
                          );
                        })}

                        {/* Bottom omitted lines gap */}
                        {visibleLines.length > 0 &&
                          visibleLines[visibleLines.length - 1].lineNumber <
                            filterResult.totalSourceLines && (
                            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 bg-slate-100/80 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800/80 select-none text-[11px] font-mono text-slate-500">
                              <span className="font-semibold text-slate-600 dark:text-slate-400">
                                ··· {filterResult.totalSourceLines -
                                  visibleLines[visibleLines.length - 1].lineNumber} lines omitted after line{" "}
                                {visibleLines[visibleLines.length - 1].lineNumber} ···
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    expandBelow(visibleLines[visibleLines.length - 1].lineNumber, 5)
                                  }
                                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                                  title={`Expand 5 lines after line ${visibleLines[visibleLines.length - 1].lineNumber}`}
                                >
                                  ▼ +5 below
                                </button>
                                <button
                                  onClick={() =>
                                    expandBelow(visibleLines[visibleLines.length - 1].lineNumber, 10)
                                  }
                                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
                                  title={`Expand 10 lines after line ${visibleLines[visibleLines.length - 1].lineNumber}`}
                                >
                                  ▼ +10 below
                                </button>
                                <button
                                  onClick={() =>
                                    expandGap(
                                      visibleLines[visibleLines.length - 1].lineNumber + 1,
                                      filterResult.totalSourceLines,
                                    )
                                  }
                                  className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-sans font-medium text-indigo-700 dark:text-indigo-300 transition-colors shadow-2xs"
                                  title="Expand all remaining lines to end of file"
                                >
                                  Expand all (
                                  {filterResult.totalSourceLines -
                                    visibleLines[visibleLines.length - 1].lineNumber}
                                  )
                                </button>
                              </div>
                            </div>
                          )}

                        {/* Large dataset chunk loader banner */}
                        {filterResult.lines.length > visibleLimit && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-amber-800 dark:text-amber-200 text-xs">
                            <span>
                              Showing first {visibleLimit} of {filterResult.lines.length} lines for smooth performance.
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setVisibleLimit((prev) => prev + 500)}
                                className="px-2.5 py-1 rounded bg-amber-200 dark:bg-amber-900/80 hover:bg-amber-300 text-amber-900 dark:text-amber-100 font-semibold transition-colors"
                              >
                                Load Next 500
                              </button>
                              <button
                                onClick={() => setVisibleLimit(filterResult.lines.length)}
                                className="px-2.5 py-1 rounded bg-amber-200 dark:bg-amber-900/80 hover:bg-amber-300 text-amber-900 dark:text-amber-100 font-semibold transition-colors"
                              >
                                Load All ({filterResult.lines.length})
                              </button>
                            </div>
                          </div>
                        )}
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
