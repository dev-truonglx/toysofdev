import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Hash,
  Search,
  X,
  ChevronUp,
  Code2,
  ListTree,
  Copy,
  Check,
  ListFilter,
  Loader2,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "../../i18n";

export interface JsonFoldableViewerProps {
  data: unknown;
  rawText?: string;
  defaultShowLineNumbers?: boolean;
  className?: string;
}

export interface JsonLine {
  id: string; // unique path string
  depth: number;
  path: string;
  canFold: boolean;
  isFolded: boolean;
  key?: string;
  prefix?: string;
  suffix?: string;
  valueType?: "string" | "number" | "boolean" | "null";
  primitiveValue?: unknown;
  collapsedSummary?: string;
  isClosingBracket?: boolean;
}

export interface KeyMatch {
  path: string;
  key: string;
  value: unknown;
  ancestorPaths: string[];
}

/**
 * Collect all paths in JSON that represent objects or arrays (can be folded).
 */
export function getAllCollapsiblePaths(val: unknown, current = "$", acc: string[] = []): string[] {
  if (val !== null && typeof val === "object") {
    acc.push(current);
    if (Array.isArray(val)) {
      val.forEach((item, i) => getAllCollapsiblePaths(item, `${current}[${i}]`, acc));
    } else {
      Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
        getAllCollapsiblePaths(v, `${current}.${k}`, acc);
      });
    }
  }
  return acc;
}

/**
 * Search all object keys matching the query string.
 * Optimized with maxMatches to prevent hanging when querying massive JSON structures.
 */
export function searchKeysInJson(
  val: unknown,
  searchQuery: string,
  currentPath = "$",
  currentAncestors: string[] = [],
  results: KeyMatch[] = [],
  maxMatches = 1000,
): KeyMatch[] {
  if (!searchQuery || val === null || typeof val !== "object") return results;
  if (results.length >= maxMatches) return results;

  const q = searchQuery.toLowerCase().trim();
  const nextAncestors = [...currentAncestors, currentPath];

  if (Array.isArray(val)) {
    for (let idx = 0; idx < val.length; idx++) {
      if (results.length >= maxMatches) break;
      searchKeysInJson(val[idx], q, `${currentPath}[${idx}]`, nextAncestors, results, maxMatches);
    }
  } else {
    const entries = Object.entries(val as Record<string, unknown>);
    for (const [k, v] of entries) {
      if (results.length >= maxMatches) break;
      const propPath = `${currentPath}.${k}`;
      if (k.toLowerCase().includes(q)) {
        results.push({
          path: propPath,
          key: k,
          value: v,
          ancestorPaths: nextAncestors,
        });
      }
      searchKeysInJson(v, q, propPath, nextAncestors, results, maxMatches);
    }
  }

  return results;
}

/**
 * Flatten a JSON structure into an array of visible lines taking folding into account.
 */
export function flattenJson(
  val: unknown,
  collapsedPaths: Set<string>,
  keyPath: string = "$",
  depth: number = 0,
  keyName?: string,
  isLast: boolean = true,
  t?: { ui?: { keysCount?: string; itemsCount?: string } },
): JsonLine[] {
  const lines: JsonLine[] = [];

  // Helper for counts
  const formatKeysCount = (n: number) =>
    t?.ui?.keysCount ? t.ui.keysCount.replace("{count}", String(n)) : `${n} keys`;
  const formatItemsCount = (n: number) =>
    t?.ui?.itemsCount ? t.ui.itemsCount.replace("{count}", String(n)) : `${n} items`;

  // Object
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val as Record<string, unknown>);
    if (keys.length === 0) {
      lines.push({
        id: keyPath,
        depth,
        path: keyPath,
        canFold: false,
        isFolded: false,
        key: keyName,
        prefix: "{}",
        suffix: isLast ? "" : ",",
      });
      return lines;
    }

    const isFolded = collapsedPaths.has(keyPath);

    if (isFolded) {
      lines.push({
        id: keyPath,
        depth,
        path: keyPath,
        canFold: true,
        isFolded: true,
        key: keyName,
        collapsedSummary: `{ ${formatKeysCount(keys.length)} }`,
        suffix: isLast ? "" : ",",
      });
      return lines;
    }

    // Opening line
    lines.push({
      id: keyPath,
      depth,
      path: keyPath,
      canFold: true,
      isFolded: false,
      key: keyName,
      prefix: "{",
    });

    // Children
    keys.forEach((k, idx) => {
      const childVal = (val as Record<string, unknown>)[k];
      const childPath = `${keyPath}.${k}`;
      const childIsLast = idx === keys.length - 1;
      const childLines = flattenJson(
        childVal,
        collapsedPaths,
        childPath,
        depth + 1,
        k,
        childIsLast,
        t,
      );
      lines.push(...childLines);
    });

    // Closing line
    lines.push({
      id: `${keyPath}:close`,
      depth,
      path: keyPath,
      canFold: false,
      isFolded: false,
      prefix: "}",
      suffix: isLast ? "" : ",",
      isClosingBracket: true,
    });

    return lines;
  }

  // Array
  if (Array.isArray(val)) {
    if (val.length === 0) {
      lines.push({
        id: keyPath,
        depth,
        path: keyPath,
        canFold: false,
        isFolded: false,
        key: keyName,
        prefix: "[]",
        suffix: isLast ? "" : ",",
      });
      return lines;
    }

    const isFolded = collapsedPaths.has(keyPath);

    if (isFolded) {
      lines.push({
        id: keyPath,
        depth,
        path: keyPath,
        canFold: true,
        isFolded: true,
        key: keyName,
        collapsedSummary: `[ ${formatItemsCount(val.length)} ]`,
        suffix: isLast ? "" : ",",
      });
      return lines;
    }

    // Opening line
    lines.push({
      id: keyPath,
      depth,
      path: keyPath,
      canFold: true,
      isFolded: false,
      key: keyName,
      prefix: "[",
    });

    // Items
    val.forEach((item, idx) => {
      const childPath = `${keyPath}[${idx}]`;
      const childIsLast = idx === val.length - 1;
      const childLines = flattenJson(
        item,
        collapsedPaths,
        childPath,
        depth + 1,
        undefined,
        childIsLast,
        t,
      );
      lines.push(...childLines);
    });

    // Closing line
    lines.push({
      id: `${keyPath}:close`,
      depth,
      path: keyPath,
      canFold: false,
      isFolded: false,
      prefix: "]",
      suffix: isLast ? "" : ",",
      isClosingBracket: true,
    });

    return lines;
  }

  // Primitives: string, number, boolean, null
  const valueType = val === null ? "null" : (typeof val as "string" | "number" | "boolean");
  lines.push({
    id: keyPath,
    depth,
    path: keyPath,
    canFold: false,
    isFolded: false,
    key: keyName,
    valueType,
    primitiveValue: val,
    suffix: isLast ? "" : ",",
  });

  return lines;
}

/**
 * Helper to render highlighted search matches in key string.
 */
function renderHighlightedKey(key: string, query: string, isActiveMatch: boolean) {
  if (!query.trim()) return key;

  const lowerKey = key.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const idx = lowerKey.indexOf(lowerQuery);

  if (idx === -1) return key;

  const before = key.substring(0, idx);
  const matched = key.substring(idx, idx + lowerQuery.length);
  const after = key.substring(idx + lowerQuery.length);

  return (
    <>
      {before}
      <mark
        className={`rounded px-0.5 font-bold transition-all ${
          isActiveMatch
            ? "bg-amber-400 text-slate-900 ring-2 ring-indigo-500 shadow-sm dark:bg-amber-400 dark:text-slate-950"
            : "bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100"
        }`}
      >
        {matched}
      </mark>
      {after}
    </>
  );
}

/**
 * Helper to render syntax-colored primitive values.
 */
function renderPrimitiveValue(
  val: unknown,
  type?: "string" | "number" | "boolean" | "null",
) {
  if (type === "string") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 whitespace-pre-wrap break-all">
        "{String(val)}"
      </span>
    );
  }
  if (type === "number") {
    return (
      <span className="text-amber-600 dark:text-amber-400 font-semibold">{String(val)}</span>
    );
  }
  if (type === "boolean") {
    return (
      <span className="text-purple-600 dark:text-purple-400 font-bold">{String(val)}</span>
    );
  }
  if (type === "null") {
    return <span className="text-rose-500 dark:text-rose-400 italic">null</span>;
  }
  return <span className="text-slate-700 dark:text-slate-300">{String(val)}</span>;
}

/**
 * Isolated, memoized Card component for individual search matches.
 * Previews complex child objects/arrays with a sensible line limit to prevent DOM bloat.
 */
interface JsonMatchCardProps {
  match: KeyMatch;
  index: number;
  searchQuery: string;
  showLineNumbers: boolean;
  collapsedPaths: Set<string>;
  toggleFold: (path: string) => void;
  onCopyPath: (path: string) => void;
  onCopyValue: (val: unknown, path: string) => void;
  isPathCopied: boolean;
  isValueCopied: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

const JsonMatchCard: React.FC<JsonMatchCardProps> = React.memo(
  ({
    match,
    index,
    searchQuery,
    showLineNumbers,
    collapsedPaths,
    toggleFold,
    onCopyPath,
    onCopyValue,
    isPathCopied,
    isValueCopied,
    t,
  }) => {
    const [showAllSubLines, setShowAllSubLines] = useState(false);
    const isComplex = match.value !== null && typeof match.value === "object";

    const subLines = useMemo(() => {
      if (!isComplex) return [];
      return flattenJson(match.value, collapsedPaths, match.path, 0, undefined, true, t);
    }, [isComplex, match.value, collapsedPaths, match.path, t]);

    const visibleSubLines = useMemo(() => {
      return showAllSubLines ? subLines : subLines.slice(0, 30);
    }, [showAllSubLines, subLines]);

    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
        {/* Card Header: Match #, JSONPath, Copy Path */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 font-sans">
              #{index + 1}
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-300 truncate font-medium">
              {match.path}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onCopyValue(match.value, match.path)}
              title={t.ui.copyValue}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              {isValueCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onCopyPath(match.path)}
              title={t.ui.copyPath}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              {isPathCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Matching Key & Corresponding Data */}
        <div>
          <div className="text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
            "{renderHighlightedKey(match.key, searchQuery, false)}":
          </div>

          <div className="pl-3">
            {isComplex ? (
              <div className="border-l-2 border-indigo-200 dark:border-indigo-800/80 pl-2 py-0.5">
                {visibleSubLines.map((subLine, subIdx) => (
                  <div
                    key={subLine.id}
                    className="flex items-center leading-5 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                  >
                    {showLineNumbers && (
                      <div className="w-8 shrink-0 pr-2 text-right text-[10px] select-none text-slate-400 dark:text-slate-600 font-mono">
                        {subIdx + 1}
                      </div>
                    )}
                    <div
                      className="flex items-center flex-1 overflow-hidden"
                      style={{
                        paddingLeft: `${subLine.depth * 1.25 + 1.25}rem`,
                      }}
                    >
                      {subLine.canFold ? (
                        <button
                          type="button"
                          onClick={() => toggleFold(subLine.path)}
                          className="w-4 h-4 -ml-4 mr-1 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
                        >
                          {subLine.isFolded ? (
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-500 font-bold" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4 -ml-4 mr-1 shrink-0" />
                      )}
                      {subLine.key && (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-1">
                          "{subLine.key}":
                        </span>
                      )}
                      {subLine.isFolded ? (
                        <button
                          type="button"
                          onClick={() => toggleFold(subLine.path)}
                          className="px-1 py-0.5 rounded text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          {subLine.collapsedSummary}
                        </button>
                      ) : subLine.primitiveValue !== undefined ||
                        subLine.valueType === "null" ? (
                        renderPrimitiveValue(subLine.primitiveValue, subLine.valueType)
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400 font-bold">
                          {subLine.prefix}
                        </span>
                      )}
                      {subLine.suffix && (
                        <span className="text-slate-400 dark:text-slate-500">
                          {subLine.suffix}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {subLines.length > 30 && !showAllSubLines && (
                  <button
                    type="button"
                    onClick={() => setShowAllSubLines(true)}
                    className="mt-1.5 text-[11px] font-sans text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + {subLines.length - 30} lines...
                  </button>
                )}
              </div>
            ) : (
              <div className="leading-relaxed">
                {renderPrimitiveValue(
                  match.value,
                  match.value === null ? "null" : (typeof match.value as "string" | "number" | "boolean"),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export const JsonFoldableViewer: React.FC<JsonFoldableViewerProps> = ({
  data,
  rawText = "",
  defaultShowLineNumbers = true,
  className = "",
}) => {
  const { t } = useTranslation();
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  
  // Real-time input state for immediate 60fps typing without lag
  const [searchInputValue, setSearchInputValue] = useState("");
  // Debounced search query
  const [searchQuery, setSearchQuery] = useState("");
  
  const [matchIndex, setMatchIndex] = useState(0);
  const [filterOnly, setFilterOnly] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(defaultShowLineNumbers);
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(40);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input by 280ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInputValue.trim());
      setDisplayCount(40);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInputValue]);

  const isSearching = searchInputValue.trim() !== searchQuery;

  // Collect all matches when search query changes (capped at 1000 for peak performance)
  const matches = useMemo(() => {
    if (!searchQuery.trim() || data === undefined) return [];
    return searchKeysInJson(data, searchQuery.trim(), "$", [], [], 1000);
  }, [data, searchQuery]);

  // Set of matched paths for O(1) membership check during tree render
  const matchedPathsSet = useMemo(() => {
    return new Set(matches.map((m) => m.path));
  }, [matches]);

  // When search matches change, auto-expand all ancestors so matches are visible in tree
  useEffect(() => {
    if (matches.length > 0) {
      setCollapsedPaths((prev) => {
        let changed = false;
        const next = new Set(prev);
        matches.forEach((m) => {
          m.ancestorPaths.forEach((anc) => {
            if (next.has(anc)) {
              next.delete(anc);
              changed = true;
            }
          });
        });
        return changed ? next : prev;
      });
      setMatchIndex(0);
    } else {
      setMatchIndex(0);
    }
  }, [matches]);

  // Flatten JSON into lines based on current collapsedPaths
  const lines = useMemo(() => {
    if (data === undefined) return [];
    return flattenJson(data, collapsedPaths, "$", 0, undefined, true, t);
  }, [data, collapsedPaths, t]);

  // TanStack Virtualizer for full tree rendering: 60fps scrolling with zero DOM lag on 10,000+ lines
  const rowVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 24,
    overscan: 25,
  });

  // Scroll active match into view in full tree mode via virtualizer scrollToIndex
  useEffect(() => {
    if (!filterOnly && matches.length > 0 && matches[matchIndex]) {
      const activePath = matches[matchIndex].path;
      const targetIdx = lines.findIndex((l) => l.path === activePath);
      if (targetIdx !== -1) {
        rowVirtualizer.scrollToIndex(targetIdx, { align: "center", behavior: "smooth" });
      }
    }
  }, [filterOnly, matchIndex, matches, lines, rowVirtualizer]);

  const toggleFold = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedPaths(new Set());
  };

  const handleCollapseAll = () => {
    if (data === undefined) return;
    const all = getAllCollapsiblePaths(data);
    setCollapsedPaths(new Set(all));
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    setMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    setMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If user presses Enter while debounce is pending, flush immediately!
      if (searchInputValue.trim() !== searchQuery) {
        setSearchQuery(searchInputValue.trim());
        setDisplayCount(40);
        return;
      }
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === "Escape") {
      setSearchInputValue("");
      setSearchQuery("");
      setDisplayCount(40);
    }
  };

  const handleClearSearch = () => {
    setSearchInputValue("");
    setSearchQuery("");
    setDisplayCount(40);
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch (err) {
      console.error("Failed to copy path:", err);
    }
  };

  const handleCopyValue = async (val: unknown, path: string) => {
    try {
      const str = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
      await navigator.clipboard.writeText(str);
      setCopiedPath(`val:${path}`);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch (err) {
      console.error("Failed to copy value:", err);
    }
  };

  if (data === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-400 italic font-sans">
        {t.toolLayout.outputPlaceholder}
      </div>
    );
  }

  const activeMatchedPath = matches[matchIndex]?.path;
  const isSearchActive = Boolean(searchQuery.trim());
  const visibleMatches = matches.slice(0, displayCount);

  return (
    <div className={`flex flex-col h-full w-full bg-transparent overflow-hidden ${className}`}>
      {/* Controls & Quick Key Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs shrink-0 select-none">
        {/* Search Box for Keys with Debounce & Spinner */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px] max-w-md">
          <div className="relative flex items-center w-full">
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 absolute left-2.5 text-indigo-500 animate-spin pointer-events-none" />
            ) : (
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t.ui.searchKeyPlaceholder}
              className="w-full pl-8 pr-16 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
            />
            {searchInputValue && (
              <div className="absolute right-1.5 flex items-center gap-1">
                {isSearching && (
                  <span className="text-[10px] text-indigo-500 font-sans hidden sm:inline mr-0.5 animate-pulse">
                    {t.ui.searching}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                  title={t.common.clear}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Search Controls: Filter Mode Toggle & Matches Nav */}
          {isSearchActive && (
            <div className="flex items-center gap-1 shrink-0 font-sans">
              {/* Filter Mode Toggle */}
              <button
                type="button"
                onClick={() => setFilterOnly((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all cursor-pointer ${
                  filterOnly
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-700 dark:text-indigo-300 shadow-xs"
                    : "bg-white border-slate-300 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50"
                }`}
                title={filterOnly ? t.ui.showFullTree : t.ui.filterMatchesOnly}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {filterOnly ? t.ui.filterMatchesOnly : t.ui.showFullTree}
                </span>
              </button>

              {/* Prev / Next Match (active when viewing full tree) */}
              {!filterOnly && (
                <>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
                    {matches.length > 0
                      ? `${matchIndex + 1}/${matches.length}`
                      : t.ui.noMatches}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matches.length <= 1}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Previous match (Shift+Enter)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matches.length <= 1}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Next match (Enter)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Toolbar Buttons: Expand/Collapse All, Line Numbers, View Mode */}
        <div className="flex items-center gap-1 shrink-0">
          {(!isSearchActive || !filterOnly) && (
            <>
              <button
                type="button"
                onClick={handleExpandAll}
                className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                title={t.ui.expandAll}
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">{t.ui.expandAll}</span>
              </button>

              <button
                type="button"
                onClick={handleCollapseAll}
                className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                title={t.ui.collapseAll}
              >
                <ChevronsDownUp className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">{t.ui.collapseAll}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowLineNumbers((prev) => !prev)}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              showLineNumbers
                ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title={t.ui.toggleLineNumbers}
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === "tree"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              title={t.ui.treeView}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.ui.treeView}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === "raw"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              title={t.ui.rawView}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.ui.rawView}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      {viewMode === "raw" ? (
        <div className="flex-1 w-full overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 select-text">
          <pre className="whitespace-pre-wrap break-all">{rawText}</pre>
        </div>
      ) : isSearchActive && filterOnly ? (
        /* Filtered Search Results: Shows ONLY matching Key and Data */
        <div className="flex-1 w-full overflow-auto p-3 space-y-3 font-mono text-xs select-text">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] pb-1 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {t.ui.matchingResults} ({matches.length >= 1000 ? "1000+" : matches.length})
            </span>
            <span className="text-slate-400">"{searchQuery.trim()}"</span>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic font-sans text-xs">
              {t.ui.noMatches}
            </div>
          ) : (
            <>
              {visibleMatches.map((m, idx) => (
                <JsonMatchCard
                  key={m.path}
                  match={m}
                  index={idx}
                  searchQuery={searchQuery}
                  showLineNumbers={showLineNumbers}
                  collapsedPaths={collapsedPaths}
                  toggleFold={toggleFold}
                  onCopyPath={handleCopyPath}
                  onCopyValue={handleCopyValue}
                  isPathCopied={copiedPath === m.path}
                  isValueCopied={copiedPath === `val:${m.path}`}
                  t={t}
                />
              ))}

              {matches.length > displayCount && (
                <div className="pt-2 pb-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setDisplayCount((prev) => prev + 40)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors shadow-xs cursor-pointer"
                  >
                    {t.ui.showMoreResults.replace(
                      "{count}",
                      String(Math.min(40, matches.length - displayCount)),
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Full Tree View: Virtualized document with line numbers, fold/unfold & search highlights */
        <div
          ref={containerRef}
          className="flex-1 w-full overflow-auto py-2 font-mono text-xs leading-6 select-text"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              minWidth: "max-content",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const line = lines[virtualRow.index];
              if (!line) return null;
              const lineIndex = virtualRow.index;
              const isTargetMatch = activeMatchedPath === line.path;
              const isMatch = matchedPathsSet.has(line.path);

              return (
                <div
                  key={line.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  id={`json-line-${line.path}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    minWidth: "max-content",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`group flex items-center hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors ${
                    isTargetMatch
                      ? "bg-amber-100/80 dark:bg-amber-950/40 ring-1 ring-amber-400/90"
                      : isMatch
                        ? "bg-amber-50/60 dark:bg-amber-950/20"
                        : ""
                  }`}
                >
                  {/* Line Number Gutter */}
                  {showLineNumbers && (
                    <div className="w-12 shrink-0 pr-3 text-right text-[11px] select-none text-slate-400 dark:text-slate-600 border-r border-slate-200/80 dark:border-slate-800/80 font-mono">
                      {lineIndex + 1}
                    </div>
                  )}

                  {/* Line Code Content: paddingLeft 1.5rem + depth * 1.25rem prevents folding chevron from being obscured */}
                  <div
                    className="flex items-center flex-1 overflow-hidden pr-2 min-w-0"
                    style={{
                      paddingLeft: `${line.depth * 1.25 + 1.5}rem`,
                    }}
                  >
                    {/* Fold / Unfold Button with -ml-5 to leave 4px clear margin from the gutter border */}
                    {line.canFold ? (
                      <button
                        type="button"
                        onClick={() => toggleFold(line.path)}
                        className="w-4 h-4 -ml-5 mr-1 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
                        title={line.isFolded ? t.ui.expandAll : t.ui.collapseAll}
                      >
                        {line.isFolded ? (
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-500 font-bold" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 -ml-5 mr-1 shrink-0" />
                    )}

                    {/* Key */}
                    {line.key !== undefined && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-1 shrink-0">
                        "
                        {renderHighlightedKey(
                          line.key,
                          searchQuery,
                          isTargetMatch,
                        )}
                        ":
                      </span>
                    )}

                    {/* Value / Collapsed Summary / Bracket */}
                    {line.isFolded ? (
                      <button
                        type="button"
                        onClick={() => toggleFold(line.path)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-sans font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 transition-colors cursor-pointer select-none"
                      >
                        <span>{line.collapsedSummary}</span>
                      </button>
                    ) : line.primitiveValue !== undefined || line.valueType === "null" ? (
                      renderPrimitiveValue(line.primitiveValue, line.valueType)
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400 font-bold">
                        {line.prefix}
                      </span>
                    )}

                    {/* Suffix (e.g. comma) */}
                    {line.suffix && (
                      <span className="text-slate-400 dark:text-slate-500 select-none">
                        {line.suffix}
                      </span>
                    )}

                    {/* Quick Copy JSONPath Action on Hover */}
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1 pl-2 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyPath(line.path)}
                        title={`${t.ui.copyPath}: ${line.path}`}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedPath === line.path ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
