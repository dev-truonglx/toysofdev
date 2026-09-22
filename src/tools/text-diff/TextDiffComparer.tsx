import React, { useState, useMemo, useRef } from "react";
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
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

interface DiffSegment {
  text: string;
  isDiff: boolean;
}

interface AlignedRow {
  isChanged: boolean;
  left: {
    lineNum?: number;
    text: string;
    segments: DiffSegment[];
    isSpacer: boolean;
  };
  right: {
    lineNum?: number;
    text: string;
    segments: DiffSegment[];
    isSpacer: boolean;
  };
}

// Compute Longest Common Subsequence of lines with minimal index displacement
function computeLineLCS(lines1: string[], lines2: string[]): { oldIdx: number; newIdx: number }[] {
  const m = lines1.length;
  const n = lines2.length;
  const dp: { len: number; disp: number }[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => ({ len: 0, disp: 0 })),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        const prev = dp[i - 1][j - 1];
        dp[i][j] = {
          len: prev.len + 1,
          disp: prev.disp + Math.abs(i - 1 - (j - 1)),
        };
      } else {
        const top = dp[i - 1][j];
        const left = dp[i][j - 1];
        if (top.len > left.len) {
          dp[i][j] = { ...top };
        } else if (left.len > top.len) {
          dp[i][j] = { ...left };
        } else {
          dp[i][j] = top.disp <= left.disp ? { ...top } : { ...left };
        }
      }
    }
  }

  let i = m;
  let j = n;
  const matches: { oldIdx: number; newIdx: number }[] = [];
  while (i > 0 && j > 0) {
    if (lines1[i - 1] === lines2[j - 1]) {
      const diag = dp[i - 1][j - 1];
      const curr = dp[i][j];
      if (curr.len === diag.len + 1) {
        matches.unshift({ oldIdx: i - 1, newIdx: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    const top = dp[i - 1][j];
    const left = dp[i][j - 1];
    if (top.len > left.len) {
      i--;
    } else if (left.len > top.len) {
      j--;
    } else {
      if (top.disp <= left.disp) i--;
      else j--;
    }
  }
  return matches;
}

// Exact character-level diff with prefix/suffix preservation and recursive sub-matching
function getDetailedLineDiff(s1: string, s2: string): { left: DiffSegment[]; right: DiffSegment[] } {
  if (s1 === s2) {
    return {
      left: [{ text: s1, isDiff: false }],
      right: [{ text: s2, isDiff: false }],
    };
  }

  // Longest common prefix
  let start = 0;
  while (start < s1.length && start < s2.length && s1[start] === s2[start]) {
    start++;
  }

  // Longest common suffix
  let end1 = s1.length - 1;
  let end2 = s2.length - 1;
  while (end1 >= start && end2 >= start && s1[end1] === s2[end2]) {
    end1--;
    end2--;
  }

  const prefix = s1.substring(0, start);
  const mid1 = s1.substring(start, end1 + 1);
  const mid2 = s2.substring(start, end2 + 1);
  const suffix = s1.substring(end1 + 1);

  const leftRes: DiffSegment[] = [];
  const rightRes: DiffSegment[] = [];

  if (prefix) {
    leftRes.push({ text: prefix, isDiff: false });
    rightRes.push({ text: prefix, isDiff: false });
  }

  // Check if mid1 and mid2 have an internal common substring >= 2 chars
  if (mid1 && mid2) {
    let bestSub = "";
    let bestI = -1;
    let bestJ = -1;

    for (let len = Math.min(mid1.length, mid2.length); len >= 2; len--) {
      for (let i = 0; i <= mid1.length - len; i++) {
        const sub = mid1.substring(i, i + len);
        const j = mid2.indexOf(sub);
        if (j !== -1) {
          bestSub = sub;
          bestI = i;
          bestJ = j;
          break;
        }
      }
      if (bestSub) break;
    }

    if (bestSub) {
      const subDiff1 = getDetailedLineDiff(mid1.substring(0, bestI), mid2.substring(0, bestJ));
      const subDiff2 = getDetailedLineDiff(
        mid1.substring(bestI + bestSub.length),
        mid2.substring(bestJ + bestSub.length),
      );

      leftRes.push(...subDiff1.left);
      rightRes.push(...subDiff1.right);

      leftRes.push({ text: bestSub, isDiff: false });
      rightRes.push({ text: bestSub, isDiff: false });

      leftRes.push(...subDiff2.left);
      rightRes.push(...subDiff2.right);
    } else {
      leftRes.push({ text: mid1, isDiff: true });
      rightRes.push({ text: mid2, isDiff: true });
    }
  } else {
    if (mid1) leftRes.push({ text: mid1, isDiff: true });
    if (mid2) rightRes.push({ text: mid2, isDiff: true });
  }

  if (suffix) {
    leftRes.push({ text: suffix, isDiff: false });
    rightRes.push({ text: suffix, isDiff: false });
  }

  return { left: leftRes, right: rightRes };
}

export const TextDiffComparer: React.FC = () => {
  const { t, language } = useTranslation();
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [showInputs, setShowInputs] = useState(true);
  const [copiedSide, setCopiedSide] = useState<"left" | "right" | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Sync scroll between left and right panes in side-by-side mode
  const handleScroll = (source: "left" | "right") => {
    if (source === "left" && leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      rightScrollRef.current.scrollLeft = leftScrollRef.current.scrollLeft;
    } else if (source === "right" && leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      leftScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
    }
  };

  // Align lines using LCS and hunk pairing
  const alignedRows: AlignedRow[] = useMemo(() => {
    const lines1 = oldText ? oldText.split("\n") : [];
    const lines2 = newText ? newText.split("\n") : [];

    if (lines1.length === 0 && lines2.length === 0) return [];

    const matches = computeLineLCS(lines1, lines2);
    const allMatches = [...matches, { oldIdx: lines1.length, newIdx: lines2.length }];
    const rows: AlignedRow[] = [];

    let lastOld = 0;
    let lastNew = 0;

    for (const match of allMatches) {
      const oldDiffCount = match.oldIdx - lastOld;
      const newDiffCount = match.newIdx - lastNew;
      const maxDiff = Math.max(oldDiffCount, newDiffCount);

      // Pair changed lines within this hunk
      for (let k = 0; k < maxDiff; k++) {
        const hasOld = k < oldDiffCount;
        const hasNew = k < newDiffCount;

        const oldLineIdx = hasOld ? lastOld + k : null;
        const newLineIdx = hasNew ? lastNew + k : null;

        const s1 = oldLineIdx !== null ? lines1[oldLineIdx] : "";
        const s2 = newLineIdx !== null ? lines2[newLineIdx] : "";

        if (oldLineIdx !== null && newLineIdx !== null) {
          // Line substitution / modification
          const diff = getDetailedLineDiff(s1, s2);
          rows.push({
            isChanged: true,
            left: {
              lineNum: oldLineIdx + 1,
              text: s1,
              segments: diff.left,
              isSpacer: false,
            },
            right: {
              lineNum: newLineIdx + 1,
              text: s2,
              segments: diff.right,
              isSpacer: false,
            },
          });
        } else if (oldLineIdx !== null && newLineIdx === null) {
          // Deleted line from left (spacer on right)
          rows.push({
            isChanged: true,
            left: {
              lineNum: oldLineIdx + 1,
              text: s1,
              segments: [{ text: s1, isDiff: true }],
              isSpacer: false,
            },
            right: {
              text: "",
              segments: [],
              isSpacer: true,
            },
          });
        } else if (oldLineIdx === null && newLineIdx !== null) {
          // Added line to right (spacer on left)
          rows.push({
            isChanged: true,
            left: {
              text: "",
              segments: [],
              isSpacer: true,
            },
            right: {
              lineNum: newLineIdx + 1,
              text: s2,
              segments: [{ text: s2, isDiff: true }],
              isSpacer: false,
            },
          });
        }
      }

      // Add matching unchanged line
      if (match.oldIdx < lines1.length && match.newIdx < lines2.length) {
        const matchingText = lines1[match.oldIdx];
        rows.push({
          isChanged: false,
          left: {
            lineNum: match.oldIdx + 1,
            text: matchingText,
            segments: [{ text: matchingText, isDiff: false }],
            isSpacer: false,
          },
          right: {
            lineNum: match.newIdx + 1,
            text: matchingText,
            segments: [{ text: matchingText, isDiff: false }],
            isSpacer: false,
          },
        });
      }

      lastOld = match.oldIdx + 1;
      lastNew = match.newIdx + 1;
    }

    return rows;
  }, [oldText, newText]);

  const leftLineCount = oldText ? oldText.split("\n").length : 0;
  const rightLineCount = newText ? newText.split("\n").length : 0;
  const leftCharCount = oldText.length;
  const rightCharCount = newText.length;
  const totalDifferences = alignedRows.filter((r) => r.isChanged).length;

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
  };

  // Render character diff segments with color badge matching the user's design
  const renderSegments = (
    segments: DiffSegment[],
    isSpacer: boolean,
    side: "left" | "right",
    isChanged: boolean,
    fallbackText?: string,
  ) => {
    if (isSpacer) return <span className="opacity-0 select-none">{" "}</span>;
    if (!segments || segments.length === 0) {
      return <span>{fallbackText || " "}</span>;
    }

    return segments.map((seg, idx) => {
      if (seg.isDiff) {
        if (side === "left") {
          // Left differing segment: soft red badge
          return (
            <span
              key={idx}
              className="bg-[#fca5a5] text-[#7f1d1d] dark:bg-rose-900/90 dark:text-rose-100 font-medium px-0.5 rounded-xs"
            >
              {seg.text}
            </span>
          );
        } else {
          // Right differing segment: soft teal/mint badge
          return (
            <span
              key={idx}
              className="bg-[#99f6e4] text-[#115e59] dark:bg-teal-900/90 dark:text-teal-100 font-medium px-0.5 rounded-xs"
            >
              {seg.text}
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

        {/* Differences count badge */}
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
            totalDifferences > 0
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}
        >
          {totalDifferences > 0 ? `${totalDifferences} ${t.diff.differencesCount}` : t.diff.allMatching}
        </span>
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
          {/* 1. DEDICATED INPUT TEXTAREAS (2 Ô NHẬP RIÊNG BIỆT) */}
          {showInputs && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
              {/* Left Input: Văn bản gốc */}
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

              {/* Right Input: Văn bản đã sửa */}
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

          {/* 2. DIFF RESULTS CONTAINER */}
          <div className="flex flex-col flex-1 min-h-[380px] rounded-xl border border-slate-300/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            {/* Diff Results Sub-Header with Legend */}
            <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-300/80 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewMode === "split"
                    ? `${t.diff.split}`
                    : `${t.diff.unified}`}
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
                {alignedRows.length} {t.common.lines}
              </span>
            </div>

            {/* Empty State */}
            {alignedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-400">
                <Sparkles className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium">{t.diff.noData}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {language === "vi" ? "Nhập hoặc dán văn bản vào hai ô phía trên để bắt đầu so sánh" : "Paste or type text into the input boxes above to compare"}
                </p>
              </div>
            ) : viewMode === "split" ? (
              /* A. SIDE-BY-SIDE (SONG SONG) VIEW WITH OVERVIEW RULER */
              <div className="flex flex-1 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-300/80 dark:divide-slate-800 flex-1 overflow-hidden">
                  {/* Left Column: Original */}
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
                      Gốc (Original)
                    </div>
                    <div
                      ref={leftScrollRef}
                      onScroll={() => handleScroll("left")}
                      className="flex-1 overflow-auto font-mono text-xs leading-6 py-1 bg-white dark:bg-slate-900"
                    >
                      {alignedRows.map((row, idx) => {
                        const hasLeftNumber = row.left.lineNum !== undefined;
                        const isPureDel = !row.left.isSpacer && row.right.isSpacer;
                        const isMod = !row.left.isSpacer && !row.right.isSpacer && row.isChanged;

                        let gutterBg = "text-slate-400 dark:text-slate-500 font-normal";
                        let rowBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";

                        if (isPureDel) {
                          gutterBg = "bg-[#fca5a5] text-[#7f1d1d] dark:bg-rose-700 dark:text-rose-100 font-semibold";
                          rowBg = "bg-[#fca5a5]/80 text-[#4c0519] dark:bg-rose-900/60 dark:text-rose-100 font-medium";
                        } else if (isMod) {
                          gutterBg = "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950 dark:text-rose-300 font-semibold";
                          rowBg = "bg-[#fee2e2]/60 dark:bg-rose-950/20";
                        }

                        return (
                          <div
                            key={idx}
                            className={`flex items-center min-h-[24px] ${
                              row.left.isSpacer ? "bg-transparent" : rowBg
                            }`}
                          >
                            {/* Gutter Line Number */}
                            <div
                              className={`w-9 h-6 flex items-center justify-end pr-2 text-[11px] select-none shrink-0 border-r border-slate-200/80 dark:border-slate-800 ${
                                row.left.isSpacer ? "" : gutterBg
                              }`}
                            >
                              {hasLeftNumber ? row.left.lineNum : ""}
                            </div>

                            {/* Content or Diagonal Striped Spacer */}
                            {row.left.isSpacer ? (
                              <div className="flex-1 min-h-[24px] h-6 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(203,213,225,0.4)_5px,rgba(203,213,225,0.4)_10px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(51,65,85,0.35)_5px,rgba(51,65,85,0.35)_10px)] select-none opacity-85" />
                            ) : (
                              <div className="flex-1 px-3 whitespace-pre select-text overflow-visible text-slate-900 dark:text-slate-100">
                                {isPureDel
                                  ? row.left.text
                                  : renderSegments(row.left.segments, false, "left", isMod, row.left.text)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Modified */}
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
                      Đã sửa (Modified)
                    </div>
                    <div
                      ref={rightScrollRef}
                      onScroll={() => handleScroll("right")}
                      className="flex-1 overflow-auto font-mono text-xs leading-6 py-1 bg-white dark:bg-slate-900"
                    >
                      {alignedRows.map((row, idx) => {
                        const hasRightNumber = row.right.lineNum !== undefined;
                        const isPureAdd = row.left.isSpacer && !row.right.isSpacer;
                        const isMod = !row.left.isSpacer && !row.right.isSpacer && row.isChanged;

                        let gutterBg = "text-slate-400 dark:text-slate-500 font-normal";
                        let rowBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";

                        if (isPureAdd) {
                          gutterBg = "bg-[#5eead4] text-[#134e4a] dark:bg-teal-700 dark:text-teal-100 font-semibold";
                          rowBg = "bg-[#5eead4]/80 text-[#042f2e] dark:bg-teal-900/60 dark:text-teal-100 font-medium";
                        } else if (isMod) {
                          gutterBg = "bg-[#ccfbf1] text-[#0f766e] dark:bg-teal-950 dark:text-teal-300 font-semibold";
                          rowBg = "bg-[#ccfbf1]/50 dark:bg-teal-950/20";
                        }

                        return (
                          <div
                            key={idx}
                            className={`flex items-center min-h-[24px] ${
                              row.right.isSpacer ? "bg-transparent" : rowBg
                            }`}
                          >
                            {/* Gutter Line Number */}
                            <div
                              className={`w-9 h-6 flex items-center justify-end pr-2 text-[11px] select-none shrink-0 border-r border-slate-200/80 dark:border-slate-800 ${
                                row.right.isSpacer ? "" : gutterBg
                              }`}
                            >
                              {hasRightNumber ? row.right.lineNum : ""}
                            </div>

                            {/* Content or Diagonal Striped Spacer */}
                            {row.right.isSpacer ? (
                              <div className="flex-1 min-h-[24px] h-6 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(203,213,225,0.4)_5px,rgba(203,213,225,0.4)_10px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(51,65,85,0.35)_5px,rgba(51,65,85,0.35)_10px)] select-none opacity-85" />
                            ) : (
                              <div className="flex-1 px-3 whitespace-pre select-text overflow-visible text-slate-900 dark:text-slate-100">
                                {isPureAdd
                                  ? row.right.text
                                  : renderSegments(row.right.segments, false, "right", isMod, row.right.text)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Rightmost Overview Ruler (Minimap strip) */}
                <div className="w-3.5 shrink-0 bg-slate-100/60 dark:bg-slate-850/60 border-l border-slate-200 dark:border-slate-800 flex flex-col py-1 select-none">
                  {alignedRows.map((r, i) => {
                    const isDel = r.isChanged && !r.left.isSpacer && r.right.isSpacer;
                    const isAdd = r.isChanged && r.left.isSpacer && !r.right.isSpacer;
                    const isMod = r.isChanged && !r.left.isSpacer && !r.right.isSpacer;

                    return (
                      <div
                        key={i}
                        className="w-full min-h-[3px] flex-1 flex"
                      >
                        {isMod ? (
                          <>
                            <div className="w-1/2 h-full bg-[#f87171]" />
                            <div className="w-1/2 h-full bg-[#2dd4bf]" />
                          </>
                        ) : isDel ? (
                          <div className="w-full h-full bg-[#f87171]" />
                        ) : isAdd ? (
                          <div className="w-full h-full bg-[#2dd4bf]" />
                        ) : (
                          <div className="w-full h-full bg-transparent" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* B. UNIFIED (TỔNG HỢP) VIEW */
              <div className="flex-1 overflow-auto font-mono text-xs leading-6 py-1 bg-white dark:bg-slate-900">
                {alignedRows.map((row, idx) => {
                  if (!row.isChanged) {
                    // Unchanged line
                    return (
                      <div
                        key={idx}
                        className="flex items-center min-h-[24px] hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        {/* Old Line # */}
                        <div className="w-9 h-5 flex items-center justify-end pr-2 text-[11px] text-slate-400 dark:text-slate-500 select-none shrink-0">
                          {row.left.lineNum}
                        </div>
                        {/* New Line # */}
                        <div className="w-9 h-5 flex items-center justify-end pr-2 text-[11px] text-slate-400 dark:text-slate-500 select-none shrink-0 border-r border-slate-200 dark:border-slate-800">
                          {row.right.lineNum}
                        </div>
                        {/* Indicator */}
                        <div className="w-6 shrink-0 text-center text-slate-300 dark:text-slate-600 select-none">
                          {" "}
                        </div>
                        {/* Content */}
                        <div className="flex-1 px-2 whitespace-pre select-text overflow-visible text-slate-800 dark:text-slate-200">
                          {row.left.text}
                        </div>
                      </div>
                    );
                  }

                  // Changed line: show left (deletion/modification) and/or right (addition/modification)
                  return (
                    <React.Fragment key={idx}>
                      {/* Deleted / Old Line */}
                      {!row.left.isSpacer && (
                        <div className="flex items-center min-h-[24px] bg-[#fee2e2]/60 dark:bg-rose-950/20 hover:bg-[#fee2e2]/80 dark:hover:bg-rose-950/30 transition-colors">
                          <div className="w-9 h-5 flex items-center justify-end pr-2 text-[11px] bg-[#fee2e2] text-[#991b1b] dark:bg-rose-900/40 dark:text-rose-300 font-semibold select-none shrink-0">
                            {row.left.lineNum}
                          </div>
                          <div className="w-9 h-5 flex items-center justify-end pr-2 text-[11px] text-slate-400 dark:text-slate-600 select-none shrink-0 border-r border-rose-200 dark:border-rose-900/40">
                            {""}
                          </div>
                          <div className="w-6 shrink-0 text-center text-rose-600 dark:text-rose-400 font-bold select-none">
                            -
                          </div>
                          <div className="flex-1 px-2 whitespace-pre select-text overflow-visible text-[#991b1b] dark:text-rose-100">
                            {renderSegments(row.left.segments, false, "left", true, row.left.text)}
                          </div>
                        </div>
                      )}

                      {/* Added / New Line */}
                      {!row.right.isSpacer && (
                        <div className="flex items-center min-h-[24px] bg-[#ccfbf1]/50 dark:bg-teal-950/20 hover:bg-[#ccfbf1]/70 dark:hover:bg-teal-950/30 transition-colors">
                          <div className="w-9 h-5 flex items-center justify-end pr-2 text-[11px] text-slate-400 dark:text-slate-600 select-none shrink-0">
                            {""}
                          </div>
                          <div className="w-9 h-5 flex items-center justify-end pr-2 text-[11px] bg-[#ccfbf1] text-[#0f766e] dark:bg-teal-900/40 dark:text-teal-300 font-semibold select-none shrink-0 border-r border-teal-200 dark:border-teal-900/40">
                            {row.right.lineNum}
                          </div>
                          <div className="w-6 shrink-0 text-center text-teal-600 dark:text-teal-400 font-bold select-none">
                            +
                          </div>
                          <div className="flex-1 px-2 whitespace-pre select-text overflow-visible text-[#0f766e] dark:text-teal-100">
                            {renderSegments(row.right.segments, false, "right", true, row.right.text)}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};



