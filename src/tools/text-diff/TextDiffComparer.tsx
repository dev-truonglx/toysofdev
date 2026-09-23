import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  GitCompare,
  Copy,
  Clipboard,
  Trash2,
  Check,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Columns,
  AlignJustify,
  Sparkles,
  Loader2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import { computeDiff, AlignedRow, DiffSegment, splitLines } from "./diffEngine";

const ROW_HEIGHT = 24; // Fixed 24px height per row
const OVERSCAN = 15; // Extra rows rendered above and below viewport

interface UnifiedLine {
  type: "equal" | "delete" | "insert";
  leftLineNum?: number;
  rightLineNum?: number;
  text: string;
  segments: DiffSegment[];
  isOriginalChanged: boolean;
}

export const TextDiffComparer: React.FC = () => {
  const { t, language } = useTranslation();
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [showInputs, setShowInputs] = useState(true);
  const [copiedSide, setCopiedSide] = useState<"left" | "right" | null>(null);

  // Diff engine state
  const [alignedRows, setAlignedRows] = useState<AlignedRow[]>([]);
  const [totalDifferences, setTotalDifferences] = useState(0);
  const [isComputing, setIsComputing] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [wordDiffDisabled, setWordDiffDisabled] = useState(false);
  const [forceAll, setForceAll] = useState(false);

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(500);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Async diff with debounce & race-condition cancellation
  useEffect(() => {
    let isCurrent = true;
    setIsComputing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await computeDiff(oldText, newText, { forceAll });
        if (isCurrent) {
          setAlignedRows(result.rows);
          setTotalDifferences(result.differencesCount);
          setIsTruncated(result.isTruncated || false);
          setWordDiffDisabled(result.wordDiffDisabled || false);
          setIsComputing(false);
        }
      } catch (err) {
        if (isCurrent) {
          console.error("Diff calculation error:", err);
          setIsComputing(false);
        }
      }
    }, 120);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [oldText, newText, forceAll]);

  // Monitor viewport container height
  useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setViewportHeight(el.clientHeight);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode]);

  // Flatten rows for unified mode so each element has exactly ROW_HEIGHT
  const unifiedLines: UnifiedLine[] = useMemo(() => {
    if (viewMode !== "unified") return [];
    const lines: UnifiedLine[] = [];

    for (const row of alignedRows) {
      if (!row.isChanged) {
        lines.push({
          type: "equal",
          leftLineNum: row.left.lineNum,
          rightLineNum: row.right.lineNum,
          text: row.left.text,
          segments: row.left.segments,
          isOriginalChanged: false,
        });
      } else {
        if (!row.left.isSpacer) {
          lines.push({
            type: "delete",
            leftLineNum: row.left.lineNum,
            rightLineNum: undefined,
            text: row.left.text,
            segments: row.left.segments,
            isOriginalChanged: true,
          });
        }
        if (!row.right.isSpacer) {
          lines.push({
            type: "insert",
            leftLineNum: undefined,
            rightLineNum: row.right.lineNum,
            text: row.right.text,
            segments: row.right.segments,
            isOriginalChanged: true,
          });
        }
      }
    }

    return lines;
  }, [alignedRows, viewMode]);

  // Total items in the active virtual list
  const totalItems = viewMode === "split" ? alignedRows.length : unifiedLines.length;
  const totalHeight = totalItems * ROW_HEIGHT;

  // Virtual window calculation
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalItems, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const topPadding = startIndex * ROW_HEIGHT;
  const bottomPadding = Math.max(0, (totalItems - endIndex) * ROW_HEIGHT);

  const visibleSplitRows = useMemo(() => {
    if (viewMode !== "split") return [];
    return alignedRows.slice(startIndex, endIndex);
  }, [alignedRows, startIndex, endIndex, viewMode]);

  const visibleUnifiedLines = useMemo(() => {
    if (viewMode !== "unified") return [];
    return unifiedLines.slice(startIndex, endIndex);
  }, [unifiedLines, startIndex, endIndex, viewMode]);

  // Handle synchronized virtual scrolling
  const handleLeftScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    const { scrollTop: newScrollTop, scrollLeft: newScrollLeft } = e.currentTarget;
    if (rightScrollRef.current) {
      isSyncingRight.current = true;
      if (Math.abs(rightScrollRef.current.scrollTop - newScrollTop) > 0.5) {
        rightScrollRef.current.scrollTop = newScrollTop;
      }
      if (Math.abs(rightScrollRef.current.scrollLeft - newScrollLeft) > 0.5) {
        rightScrollRef.current.scrollLeft = newScrollLeft;
      }
    }
    setScrollTop(newScrollTop);
  }, []);

  const handleRightScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    const { scrollTop: newScrollTop, scrollLeft: newScrollLeft } = e.currentTarget;
    if (leftScrollRef.current) {
      isSyncingLeft.current = true;
      if (Math.abs(leftScrollRef.current.scrollTop - newScrollTop) > 0.5) {
        leftScrollRef.current.scrollTop = newScrollTop;
      }
      if (Math.abs(leftScrollRef.current.scrollLeft - newScrollLeft) > 0.5) {
        leftScrollRef.current.scrollLeft = newScrollLeft;
      }
    }
    setScrollTop(newScrollTop);
  }, []);

  const handleUnifiedScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Compute maximum line lengths for stable synchronized horizontal scrolling
  const maxSplitCharCount = useMemo(() => {
    let max = 0;
    for (const row of alignedRows) {
      if (!row.left.isSpacer && row.left.text.length > max) max = row.left.text.length;
      if (!row.right.isSpacer && row.right.text.length > max) max = row.right.text.length;
    }
    return max;
  }, [alignedRows]);

  const maxUnifiedCharCount = useMemo(() => {
    let max = 0;
    for (const line of unifiedLines) {
      if (line.text.length > max) max = line.text.length;
    }
    return max;
  }, [unifiedLines]);

  // Draw high-performance Canvas Minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalItems === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const scale = canvasHeight / totalItems;

    if (viewMode === "split") {
      for (let i = 0; i < alignedRows.length; i++) {
        const row = alignedRows[i];
        if (!row.isChanged) continue;

        const y = i * scale;
        const h = Math.max(1.5, scale);

        const isDel = !row.left.isSpacer && row.right.isSpacer;
        const isAdd = row.left.isSpacer && !row.right.isSpacer;
        const isMod = !row.left.isSpacer && !row.right.isSpacer;

        if (isMod) {
          ctx.fillStyle = "#f87171";
          ctx.fillRect(0, y, canvasWidth / 2, h);
          ctx.fillStyle = "#2dd4bf";
          ctx.fillRect(canvasWidth / 2, y, canvasWidth / 2, h);
        } else if (isDel) {
          ctx.fillStyle = "#f87171";
          ctx.fillRect(0, y, canvasWidth, h);
        } else if (isAdd) {
          ctx.fillStyle = "#2dd4bf";
          ctx.fillRect(0, y, canvasWidth, h);
        }
      }
    } else {
      for (let i = 0; i < unifiedLines.length; i++) {
        const line = unifiedLines[i];
        if (line.type === "equal") continue;

        const y = i * scale;
        const h = Math.max(1.5, scale);

        ctx.fillStyle = line.type === "delete" ? "#f87171" : "#2dd4bf";
        ctx.fillRect(0, y, canvasWidth, h);
      }
    }
  }, [alignedRows, unifiedLines, totalItems, totalHeight, viewportHeight, viewMode]);

  // Click on minimap to jump
  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || totalHeight === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const targetRatio = clickY / rect.height;
    const targetScrollTop = Math.max(0, targetRatio * totalHeight - viewportHeight / 2);

    if (viewMode === "split") {
      if (leftScrollRef.current) leftScrollRef.current.scrollTop = targetScrollTop;
      if (rightScrollRef.current) rightScrollRef.current.scrollTop = targetScrollTop;
    } else {
      if (unifiedScrollRef.current) unifiedScrollRef.current.scrollTop = targetScrollTop;
    }
    setScrollTop(targetScrollTop);
  };

  const leftLineCount = oldText ? splitLines(oldText).length : 0;
  const rightLineCount = newText ? splitLines(newText).length : 0;
  const leftCharCount = oldText.length;
  const rightCharCount = newText.length;

  const copyText = (text: string, side: "left" | "right") => {
    navigator.clipboard.writeText(text);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 1500);
  };

  const pasteText = async (setter: (val: string) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      setter(text);
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  const handleSwap = () => {
    const temp = oldText;
    setOldText(newText);
    setNewText(temp);
  };

  const handleClearAll = () => {
    setOldText("");
    setNewText("");
    setForceAll(false);
  };

  // Render character/word diff segments
  const renderSegments = (
    segments: DiffSegment[],
    isSpacer: boolean,
    side: "left" | "right",
    isChanged: boolean,
    fallbackText?: string,
  ) => {
    if (isSpacer) return <span className="opacity-0 select-none">{" "}</span>;
    if (!segments || segments.length === 0) {
      const text = fallbackText || " ";
      const display = text.length > 2500 ? text.slice(0, 2500) + "..." : text;
      return <span>{display}</span>;
    }

    return segments.map((seg, idx) => {
      const text = seg.text.length > 2500 ? seg.text.slice(0, 2500) + "..." : seg.text;
      if (seg.isDiff) {
        if (side === "left") {
          return (
            <span
              key={idx}
              className="bg-[#fca5a5] text-[#7f1d1d] dark:bg-rose-900/90 dark:text-rose-100 font-medium px-0.5 rounded-xs"
            >
              {text}
            </span>
          );
        } else {
          return (
            <span
              key={idx}
              className="bg-[#99f6e4] text-[#115e59] dark:bg-teal-900/90 dark:text-teal-100 font-medium px-0.5 rounded-xs"
            >
              {text}
            </span>
          );
        }
      }

      if (isChanged) {
        return (
          <span
            key={idx}
            className={side === "left" ? "text-[#991b1b] dark:text-rose-200" : "text-[#0f766e] dark:text-teal-200"}
          >
            {seg.text}
          </span>
        );
      }

      return <span key={idx}>{seg.text}</span>;
    });
  };

  // Header configuration toolbar
  const config = (
    <div className="flex flex-wrap items-center justify-between gap-2 w-full">
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === "split"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{t.diff.split}</span>
          </button>
          <button
            onClick={() => setViewMode("unified")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === "unified"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span>{t.diff.unified}</span>
          </button>
        </div>

        {/* Swap button */}
        <button
          onClick={handleSwap}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          title={t.diff.swap}
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">{t.diff.swap}</span>
        </button>

        {/* Clear all */}
        <button
          onClick={handleClearAll}
          disabled={!oldText && !newText}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40"
          title={t.diff.clearAll}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.diff.clearAll}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle Inputs button */}
        <button
          onClick={() => setShowInputs((prev) => !prev)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
        >
          {showInputs ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>{t.diff.collapseInputs}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>{t.diff.showInputs} ({leftLineCount} / {rightLineCount} {t.common.lines})</span>
            </>
          )}
        </button>

        {/* Differences count badge & Computing spinner */}
        <div className="flex items-center gap-1.5">
          {isComputing && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
              totalDifferences > 0
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}
          >
            {totalDifferences > 0 ? `${totalDifferences} ${t.diff.differencesCount}` : t.diff.allMatching}
          </span>
          {wordDiffDisabled && (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-medium border bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
              title={t.diff.fastDiffActive}
            >
              <Zap className="w-3.5 h-3.5 text-sky-500" />
              <span>Fast Line Diff</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ToolLayout
      id="text-diff-comparer"
      title={t.tools["text-diff-comparer"]?.title || "Text Diff / Comparer"}
      description={t.tools["text-diff-comparer"]?.description || "Compare two blocks of text"}
      icon={GitCompare}
      categoryName={t.categories["text"]?.title || "Text Utilities"}
      configuration={config}
      customPanes={
        <div className="flex flex-col flex-1 gap-4 overflow-hidden">
          {/* Truncation warning banner */}
          {isTruncated && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{t.diff.truncatedWarning}</span>
              </div>
              <button
                onClick={() => setForceAll(true)}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors text-xs shrink-0 shadow-xs cursor-pointer"
              >
                {t.diff.compareAllAnyway}
              </button>
            </div>
          )}

          {/* Large text info note (> 50,000 lines) */}
          {!isTruncated && (leftLineCount > 50000 || rightLineCount > 50000) && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs shrink-0">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-500" />
              <span>{t.diff.largeFileWarning}</span>
            </div>
          )}

          {/* 1. INPUT TEXTAREAS */}
          {showInputs && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
              {/* Left Input: Original */}
              <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs select-none">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {t.diff.original}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {leftLineCount} {t.common.lines} • {leftCharCount} {t.common.characters}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => pasteText(setOldText)}
                      className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors"
                      title={t.common.paste}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => copyText(oldText, "left")}
                      className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors"
                      title={t.common.copy}
                    >
                      {copiedSide === "left" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setOldText("")}
                      disabled={!oldText}
                      className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 transition-colors disabled:opacity-30"
                      title={t.common.clear}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={oldText}
                  onChange={(e) => setOldText(e.target.value)}
                  placeholder={t.ui.originalTextPlaceholder}
                  spellCheck={false}
                  className="w-full h-36 p-3 resize-y bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>

              {/* Right Input: Modified */}
              <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs select-none">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {t.diff.modified}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {rightLineCount} {t.common.lines} • {rightCharCount} {t.common.characters}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => pasteText(setNewText)}
                      className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors"
                      title={t.common.paste}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => copyText(newText, "right")}
                      className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors"
                      title={t.common.copy}
                    >
                      {copiedSide === "right" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setNewText("")}
                      disabled={!newText}
                      className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 transition-colors disabled:opacity-30"
                      title={t.common.clear}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={t.ui.modifiedTextPlaceholder}
                  spellCheck={false}
                  className="w-full h-36 p-3 resize-y bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* 2. VIRTUALIZED DIFF RESULTS CONTAINER */}
          <div className="flex flex-col flex-1 min-h-[380px] rounded-xl border border-slate-300/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            {/* Diff Results Sub-Header with Legend */}
            <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-300/80 dark:border-slate-800 text-xs shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewMode === "split" ? t.diff.split : t.diff.unified}
                </span>

                {/* Legend Badges */}
                <div className="hidden sm:flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#fee2e2] border border-[#fca5a5]" />
                    {t.diff.original}
                  </span>
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#ccfbf1] border border-[#99f6e4]" />
                    {t.diff.modified}
                  </span>
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[repeating-linear-gradient(-45deg,transparent,transparent_2px,rgba(148,163,184,0.5)_2px,rgba(148,163,184,0.5)_4px)] border border-slate-300 dark:border-slate-600" />
                    {t.diff.spacer}
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                {totalItems} {t.common.lines}
              </span>
            </div>

            {/* Empty State */}
            {totalItems === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-400">
                <Sparkles className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium">{t.diff.noData}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === "vi"
                    ? "Nhập hoặc dán văn bản vào hai ô phía trên để bắt đầu so sánh"
                    : "Paste or type text into the input boxes above to compare"}
                </p>
              </div>
            ) : (
              /* ACTIVE DIFF VIEW WITH VIRTUAL SCROLLING & CANVAS MINIMAP */
              <div
                ref={viewportContainerRef}
                className="flex flex-1 overflow-hidden relative"
              >
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Split Column Headers */}
                  {viewMode === "split" && (
                    <div className="grid grid-cols-2 divide-x divide-slate-300/80 dark:divide-slate-800 shrink-0 border-b border-slate-200 dark:border-slate-800 select-none">
                      <div className="px-3 py-1 bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {language === "vi" ? "Gốc (Original)" : "Original"}
                      </div>
                      <div className="px-3 py-1 bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {language === "vi" ? "Đã sửa (Modified)" : "Modified"}
                      </div>
                    </div>
                  )}

                  {/* Content Viewport */}
                  {viewMode === "split" ? (
                    /* A. SIDE-BY-SIDE SYNCHRONIZED SPLIT PANES */
                    <div className="flex flex-1 h-full overflow-hidden divide-x divide-slate-300/80 dark:divide-slate-800">
                      {/* Left Scroll Pane (Original) */}
                      <div
                        ref={leftScrollRef}
                        onScroll={handleLeftScroll}
                        onWheel={(e) => {
                          if (rightScrollRef.current && e.deltaY) {
                            rightScrollRef.current.scrollTop += e.deltaY;
                          }
                        }}
                        className="flex-1 h-full overflow-x-auto overflow-y-hidden font-mono text-xs leading-6 bg-white dark:bg-slate-900 select-text"
                      >
                        <div style={{ minWidth: maxSplitCharCount > 0 ? `max(100%, ${maxSplitCharCount + 12}ch)` : "100%" }}>
                          {/* Top Virtual Spacer */}
                          <div style={{ height: topPadding }} />

                          {/* Left Rows */}
                          {visibleSplitRows.map((row, index) => {
                            const idx = startIndex + index;
                            const hasLeftNumber = row.left.lineNum !== undefined;
                            const isPureDel = !row.left.isSpacer && row.right.isSpacer;
                            const isMod = !row.left.isSpacer && !row.right.isSpacer && row.isChanged;

                            let leftGutter = "text-slate-400 dark:text-slate-500 font-normal bg-slate-50/90 dark:bg-slate-850/90";
                            let leftBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";
                            if (isPureDel) {
                              leftGutter = "bg-[#fca5a5] text-[#7f1d1d] dark:bg-rose-700 dark:text-rose-100 font-semibold";
                              leftBg = "bg-[#fca5a5]/80 text-[#4c0519] dark:bg-rose-900/60 dark:text-rose-100 font-medium";
                            } else if (isMod) {
                              leftGutter = "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950 dark:text-rose-300 font-semibold";
                              leftBg = "bg-[#fee2e2]/60 dark:bg-rose-950/20";
                            }

                            return (
                              <div
                                key={idx}
                                className={`flex h-6 min-h-[24px] w-full ${row.left.isSpacer ? "bg-transparent" : leftBg}`}
                              >
                                {/* Sticky Line Number Gutter */}
                                <div
                                  className={`w-10 h-6 sticky left-0 z-10 flex items-center justify-end pr-2 text-[11px] select-none shrink-0 border-r border-slate-200/80 dark:border-slate-800 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] ${
                                    row.left.isSpacer ? "bg-white dark:bg-slate-900 text-transparent" : leftGutter
                                  }`}
                                >
                                  {hasLeftNumber ? row.left.lineNum : ""}
                                </div>

                                {/* Code text or spacer */}
                                {row.left.isSpacer ? (
                                  <div className="flex-1 h-6 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(203,213,225,0.4)_5px,rgba(203,213,225,0.4)_10px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(51,65,85,0.35)_5px,rgba(51,65,85,0.35)_10px)] select-none opacity-85" />
                                ) : (
                                  <div className="px-3 whitespace-pre text-slate-900 dark:text-slate-100 flex items-center h-6">
                                    {isPureDel
                                      ? row.left.text
                                      : renderSegments(row.left.segments, false, "left", isMod, row.left.text)}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Bottom Virtual Spacer */}
                          <div style={{ height: bottomPadding }} />
                        </div>
                      </div>

                      {/* Right Scroll Pane (Modified) */}
                      <div
                        ref={rightScrollRef}
                        onScroll={handleRightScroll}
                        className="flex-1 h-full overflow-x-auto overflow-y-auto font-mono text-xs leading-6 bg-white dark:bg-slate-900 select-text"
                      >
                        <div style={{ minWidth: maxSplitCharCount > 0 ? `max(100%, ${maxSplitCharCount + 12}ch)` : "100%" }}>
                          {/* Top Virtual Spacer */}
                          <div style={{ height: topPadding }} />

                          {/* Right Rows */}
                          {visibleSplitRows.map((row, index) => {
                            const idx = startIndex + index;
                            const hasRightNumber = row.right.lineNum !== undefined;
                            const isPureAdd = row.left.isSpacer && !row.right.isSpacer;
                            const isMod = !row.left.isSpacer && !row.right.isSpacer && row.isChanged;

                            let rightGutter = "text-slate-400 dark:text-slate-500 font-normal bg-slate-50/90 dark:bg-slate-850/90";
                            let rightBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";
                            if (isPureAdd) {
                              rightGutter = "bg-[#5eead4] text-[#134e4a] dark:bg-teal-700 dark:text-teal-100 font-semibold";
                              rightBg = "bg-[#5eead4]/80 text-[#042f2e] dark:bg-teal-900/60 dark:text-teal-100 font-medium";
                            } else if (isMod) {
                              rightGutter = "bg-[#ccfbf1] text-[#0f766e] dark:bg-teal-950 dark:text-teal-300 font-semibold";
                              rightBg = "bg-[#ccfbf1]/50 dark:bg-teal-950/20";
                            }

                            return (
                              <div
                                key={idx}
                                className={`flex h-6 min-h-[24px] w-full ${row.right.isSpacer ? "bg-transparent" : rightBg}`}
                              >
                                {/* Sticky Line Number Gutter */}
                                <div
                                  className={`w-10 h-6 sticky left-0 z-10 flex items-center justify-end pr-2 text-[11px] select-none shrink-0 border-r border-slate-200/80 dark:border-slate-800 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] ${
                                    row.right.isSpacer ? "bg-white dark:bg-slate-900 text-transparent" : rightGutter
                                  }`}
                                >
                                  {hasRightNumber ? row.right.lineNum : ""}
                                </div>

                                {/* Code text or spacer */}
                                {row.right.isSpacer ? (
                                  <div className="flex-1 h-6 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(203,213,225,0.4)_5px,rgba(203,213,225,0.4)_10px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(51,65,85,0.35)_5px,rgba(51,65,85,0.35)_10px)] select-none opacity-85" />
                                ) : (
                                  <div className="px-3 whitespace-pre text-slate-900 dark:text-slate-100 flex items-center h-6">
                                    {isPureAdd
                                      ? row.right.text
                                      : renderSegments(row.right.segments, false, "right", isMod, row.right.text)}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Bottom Virtual Spacer */}
                          <div style={{ height: bottomPadding }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* B. UNIFIED VIRTUAL ROWS */
                    <div
                      ref={unifiedScrollRef}
                      onScroll={handleUnifiedScroll}
                      className="flex-1 h-full overflow-x-auto overflow-y-auto font-mono text-xs leading-6 bg-white dark:bg-slate-900 select-text"
                    >
                      <div style={{ minWidth: maxUnifiedCharCount > 0 ? `max(100%, ${maxUnifiedCharCount + 20}ch)` : "100%" }}>
                        {/* Top Virtual Spacer */}
                        <div style={{ height: topPadding }} />

                        {/* Unified Rows */}
                        {visibleUnifiedLines.map((line, index) => {
                          const idx = startIndex + index;
                          const isDel = line.type === "delete";
                          const isAdd = line.type === "insert";

                          let rowBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";
                          let leftGutterBg = "bg-slate-50/90 dark:bg-slate-850/90 text-slate-400 dark:text-slate-500";
                          let rightGutterBg = "bg-slate-50/90 dark:bg-slate-850/90 text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-800";
                          let markerBg = "bg-slate-50/90 dark:bg-slate-850/90 text-slate-300 dark:text-slate-600";
                          let textColor = "text-slate-800 dark:text-slate-200";

                          if (isDel) {
                            rowBg = "bg-[#fee2e2]/60 dark:bg-rose-950/20 hover:bg-[#fee2e2]/80 dark:hover:bg-rose-950/30 transition-colors";
                            leftGutterBg = "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-900/40 dark:text-rose-300 font-semibold";
                            rightGutterBg = "bg-[#fee2e2] text-slate-400 dark:text-slate-600 border-r border-rose-200 dark:border-rose-900/40";
                            markerBg = "bg-[#fee2e2] text-rose-600 dark:text-rose-400 font-bold";
                            textColor = "text-[#991b1b] dark:text-rose-100";
                          } else if (isAdd) {
                            rowBg = "bg-[#ccfbf1]/50 dark:bg-teal-950/20 hover:bg-[#ccfbf1]/70 dark:hover:bg-teal-950/30 transition-colors";
                            leftGutterBg = "bg-[#ccfbf1] text-slate-400 dark:text-slate-600";
                            rightGutterBg = "bg-[#ccfbf1] text-[#0f766e] dark:bg-teal-900/40 dark:text-teal-300 font-semibold border-r border-teal-200 dark:border-teal-900/40";
                            markerBg = "bg-[#ccfbf1] text-teal-600 dark:text-teal-400 font-bold";
                            textColor = "text-[#0f766e] dark:text-teal-100";
                          }

                          return (
                            <div
                              key={idx}
                              className={`flex items-center h-6 min-h-[24px] w-full ${rowBg}`}
                            >
                              {/* Sticky Left Line Number */}
                              <div
                                className={`w-10 h-6 sticky left-0 z-10 flex items-center justify-end pr-2 text-[11px] select-none shrink-0 ${leftGutterBg}`}
                              >
                                {line.leftLineNum ?? ""}
                              </div>

                              {/* Sticky Right Line Number */}
                              <div
                                className={`w-10 h-6 sticky left-10 z-10 flex items-center justify-end pr-2 text-[11px] select-none shrink-0 ${rightGutterBg}`}
                              >
                                {line.rightLineNum ?? ""}
                              </div>

                              {/* Sticky Marker (+ / -) */}
                              <div
                                className={`w-6 h-6 sticky left-20 z-10 flex items-center justify-center text-xs select-none shrink-0 border-r border-slate-200/40 dark:border-slate-800/40 ${markerBg}`}
                              >
                                {isDel ? "-" : isAdd ? "+" : " "}
                              </div>

                              {/* Text content */}
                              <div className={`px-3 whitespace-pre flex items-center h-6 ${textColor}`}>
                                {isDel || isAdd
                                  ? renderSegments(line.segments, false, isDel ? "left" : "right", true, line.text)
                                  : line.text}
                              </div>
                            </div>
                          );
                        })}

                        {/* Bottom Virtual Spacer */}
                        <div style={{ height: bottomPadding }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rightmost High-Performance Canvas Minimap (Overview Ruler) */}
                <div className="w-3.5 shrink-0 bg-slate-100/60 dark:bg-slate-850/60 border-l border-slate-200 dark:border-slate-800 flex select-none relative">
                  <canvas
                    ref={canvasRef}
                    width={14}
                    height={viewportHeight}
                    onClick={handleMinimapClick}
                    className="w-full h-full cursor-pointer"
                    title={language === "vi" ? "Bấm vào minimap để cuộn nhanh đến vị trí" : "Click minimap to jump"}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};
