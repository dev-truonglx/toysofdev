import React, { useState, useMemo, useRef } from "react";
import {
  FolderSync,
  Folder,
  FolderOpen,
  File,
  FileCode2,
  UploadCloud,
  RefreshCw,
  ArrowLeftRight,
  Columns,
  AlignJustify,
  ChevronUp,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Trash2,
  FileDiff,
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

// -------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------
export interface DiffSegment {
  text: string;
  isDiff: boolean;
}

export interface AlignedRow {
  isChanged: boolean;
  type: "MOD" | "ADD" | "DEL" | "SAME";
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

export interface FileItem {
  name: string;
  path: string;
  size: number;
  lineCount: number;
  content: string;
  rawFile?: File;
}

export interface FolderComparisonItem {
  relativePath: string;
  status: "added" | "deleted" | "modified" | "unchanged";
  fileA?: FileItem;
  fileB?: FileItem;
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

// -------------------------------------------------------------
// Text / Line Diff Algorithm Core
// -------------------------------------------------------------
export function normalizeLine(line: string, options: DiffOptions): string {
  let res = line;
  if (options.ignoreCase) {
    res = res.toLowerCase();
  }
  if (options.ignoreWhitespace) {
    res = res.trim().replace(/\s+/g, " ");
  }
  return res;
}

export function computeLineLCS(
  lines1: string[],
  lines2: string[],
  options: DiffOptions = { ignoreWhitespace: false, ignoreCase: false },
): { oldIdx: number; newIdx: number }[] {
  const m = lines1.length;
  const n = lines2.length;
  const dp: { len: number; disp: number }[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => ({ len: 0, disp: 0 })),
  );

  for (let i = 1; i <= m; i++) {
    const s1Norm = normalizeLine(lines1[i - 1], options);
    for (let j = 1; j <= n; j++) {
      const s2Norm = normalizeLine(lines2[j - 1], options);
      if (s1Norm === s2Norm) {
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
    const s1Norm = normalizeLine(lines1[i - 1], options);
    const s2Norm = normalizeLine(lines2[j - 1], options);
    if (s1Norm === s2Norm) {
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

export function getDetailedLineDiff(
  s1: string,
  s2: string,
  options: DiffOptions = { ignoreWhitespace: false, ignoreCase: false },
): { left: DiffSegment[]; right: DiffSegment[] } {
  if (normalizeLine(s1, options) === normalizeLine(s2, options)) {
    return {
      left: [{ text: s1, isDiff: false }],
      right: [{ text: s2, isDiff: false }],
    };
  }

  let start = 0;
  while (start < s1.length && start < s2.length && s1[start] === s2[start]) {
    start++;
  }

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
      const subDiff1 = getDetailedLineDiff(mid1.substring(0, bestI), mid2.substring(0, bestJ), options);
      const subDiff2 = getDetailedLineDiff(
        mid1.substring(bestI + bestSub.length),
        mid2.substring(bestJ + bestSub.length),
        options,
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

export function buildAlignedRows(oldText: string, newText: string, options: DiffOptions): AlignedRow[] {
  const lines1 = oldText ? oldText.split("\n") : [];
  const lines2 = newText ? newText.split("\n") : [];

  if (lines1.length === 0 && lines2.length === 0) return [];

  const matches = computeLineLCS(lines1, lines2, options);
  const allMatches = [...matches, { oldIdx: lines1.length, newIdx: lines2.length }];
  const rows: AlignedRow[] = [];

  let lastOld = 0;
  let lastNew = 0;

  for (const match of allMatches) {
    const oldDiffCount = match.oldIdx - lastOld;
    const newDiffCount = match.newIdx - lastNew;
    const maxDiff = Math.max(oldDiffCount, newDiffCount);

    for (let k = 0; k < maxDiff; k++) {
      const hasOld = k < oldDiffCount;
      const hasNew = k < newDiffCount;

      const oldLineIdx = hasOld ? lastOld + k : null;
      const newLineIdx = hasNew ? lastNew + k : null;

      const s1 = oldLineIdx !== null ? lines1[oldLineIdx] : "";
      const s2 = newLineIdx !== null ? lines2[newLineIdx] : "";

      if (oldLineIdx !== null && newLineIdx !== null) {
        const diff = getDetailedLineDiff(s1, s2, options);
        rows.push({
          isChanged: true,
          type: "MOD",
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
        rows.push({
          isChanged: true,
          type: "DEL",
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
        rows.push({
          isChanged: true,
          type: "ADD",
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

    if (match.oldIdx < lines1.length && match.newIdx < lines2.length) {
      const matchingText1 = lines1[match.oldIdx];
      const matchingText2 = lines2[match.newIdx];
      rows.push({
        isChanged: false,
        type: "SAME",
        left: {
          lineNum: match.oldIdx + 1,
          text: matchingText1,
          segments: [{ text: matchingText1, isDiff: false }],
          isSpacer: false,
        },
        right: {
          lineNum: match.newIdx + 1,
          text: matchingText2,
          segments: [{ text: matchingText2, isDiff: false }],
          isSpacer: false,
        },
      });
    }

    lastOld = match.oldIdx + 1;
    lastNew = match.newIdx + 1;
  }

  return rows;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -------------------------------------------------------------
// Component: FileFolderDiffComparer
// -------------------------------------------------------------
export const FileFolderDiffComparer: React.FC = () => {
  const { t, language } = useTranslation();
  // Mode switcher: "file" | "folder"
  const [mode, setMode] = useState<"file" | "folder">("file");

  // Diff display options
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [options, setOptions] = useState<DiffOptions>({
    ignoreWhitespace: false,
    ignoreCase: false,
  });

  // Mode 1: 2-File Diff States
  const [fileA, setFileA] = useState<FileItem | null>(null);
  const [fileB, setFileB] = useState<FileItem | null>(null);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(-1);

  // Mode 2: Folder Diff States
  const [folderAName, setFolderAName] = useState<string>("");
  const [folderBName, setFolderBName] = useState<string>("");
  const [folderAFiles, setFolderAFiles] = useState<Map<string, FileItem>>(new Map());
  const [folderBFiles, setFolderBFiles] = useState<Map<string, FileItem>>(new Map());
  const [selectedRelativePath, setSelectedRelativePath] = useState<string | null>(null);
  const [folderSearch, setFolderSearch] = useState<string>("");
  const [folderStatusFilter, setFolderStatusFilter] = useState<"all" | "modified" | "added" | "deleted" | "unchanged">(
    "all",
  );

  // Refs for scrolling and input triggering
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);
  const fileAInputRef = useRef<HTMLInputElement>(null);
  const fileBInputRef = useRef<HTMLInputElement>(null);
  const folderAInputRef = useRef<HTMLInputElement>(null);
  const folderBInputRef = useRef<HTMLInputElement>(null);

  // Sync scrolling between left & right in side-by-side
  const handleScroll = (source: "left" | "right") => {
    if (source === "left" && leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      rightScrollRef.current.scrollLeft = leftScrollRef.current.scrollLeft;
    } else if (source === "right" && leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      leftScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
    }
  };

  // Helper: Read single File object into FileItem
  const readFileToItem = async (file: File, customPath?: string): Promise<FileItem> => {
    const text = await file.text();
    const lines = text ? text.split("\n") : [];
    return {
      name: file.name,
      path: customPath || file.name,
      size: file.size,
      lineCount: lines.length,
      content: text,
      rawFile: file,
    };
  };

  // Drag & drop handlers for 2-File Mode
  const handleFileDropOnCard = async (e: React.DragEvent, targetSide: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (droppedFiles.length >= 2) {
      // User dropped 2 files at once: Assign first to A and second to B!
      const itemA = await readFileToItem(droppedFiles[0]);
      const itemB = await readFileToItem(droppedFiles[1]);
      setFileA(itemA);
      setFileB(itemB);
      return;
    }

    // Dropped 1 file on specific target
    const item = await readFileToItem(droppedFiles[0]);
    if (targetSide === "left") setFileA(item);
    else setFileB(item);
  };

  const handleGlobalFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (droppedFiles.length >= 2) {
      const itemA = await readFileToItem(droppedFiles[0]);
      const itemB = await readFileToItem(droppedFiles[1]);
      setFileA(itemA);
      setFileB(itemB);
    } else {
      // If 1 file dropped into the broad area: assign to whichever side is empty, or side A
      const item = await readFileToItem(droppedFiles[0]);
      if (!fileA) setFileA(item);
      else setFileB(item);
    }
  };

  // Reload file from rawFile reference
  const handleReloadFile = async (side: "left" | "right") => {
    const target = side === "left" ? fileA : fileB;
    if (target?.rawFile) {
      const updated = await readFileToItem(target.rawFile, target.path);
      if (side === "left") setFileA(updated);
      else setFileB(updated);
    }
  };

  // Swap File A and File B
  const handleSwapFiles = () => {
    const tempA = fileA;
    setFileA(fileB);
    setFileB(tempA);
  };

  // Clear 2-File comparison
  const handleClearFiles = () => {
    setFileA(null);
    setFileB(null);
    setCurrentDiffIndex(-1);
  };

  // Process folder upload via HTML5 webkitRelativePath
  const processFolderFiles = async (
    files: FileList | null,
    side: "A" | "B",
  ) => {
    if (!files || files.length === 0) return;

    const fileMap = new Map<string, FileItem>();
    let rootDirName = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split("/");

      if (parts.length > 1 && !rootDirName) {
        rootDirName = parts[0];
      }

      // Normalized relative path inside the folder (remove root dir prefix)
      const normalizedPath = parts.length > 1 ? parts.slice(1).join("/") : relPath;

      // Filter out typical system / git junk files
      if (
        normalizedPath.includes(".git/") ||
        normalizedPath.includes(".DS_Store") ||
        normalizedPath.includes("node_modules/")
      ) {
        continue;
      }

      const item = await readFileToItem(file, normalizedPath);
      fileMap.set(normalizedPath, item);
    }

    if (side === "A") {
      setFolderAName(rootDirName || "Thư mục A");
      setFolderAFiles(fileMap);
    } else {
      setFolderBName(rootDirName || "Thư mục B");
      setFolderBFiles(fileMap);
    }
  };

  // Compute folder comparison items list
  const folderComparisonList: FolderComparisonItem[] = useMemo(() => {
    if (folderAFiles.size === 0 && folderBFiles.size === 0) return [];

    const allPaths = new Set([...Array.from(folderAFiles.keys()), ...Array.from(folderBFiles.keys())]);
    const sortedPaths = Array.from(allPaths).sort((a, b) => a.localeCompare(b));

    const result: FolderComparisonItem[] = [];

    for (const relPath of sortedPaths) {
      const a = folderAFiles.get(relPath);
      const b = folderBFiles.get(relPath);

      if (a && !b) {
        result.push({ relativePath: relPath, status: "deleted", fileA: a });
      } else if (!a && b) {
        result.push({ relativePath: relPath, status: "added", fileB: b });
      } else if (a && b) {
        const normA = normalizeLine(a.content, options);
        const normB = normalizeLine(b.content, options);
        const isMod = normA !== normB;
        result.push({
          relativePath: relPath,
          status: isMod ? "modified" : "unchanged",
          fileA: a,
          fileB: b,
        });
      }
    }

    return result;
  }, [folderAFiles, folderBFiles, options]);

  // Statistics for Folder comparison
  const folderStats = useMemo(() => {
    let added = 0;
    let deleted = 0;
    let modified = 0;
    let unchanged = 0;

    for (const item of folderComparisonList) {
      if (item.status === "added") added++;
      else if (item.status === "deleted") deleted++;
      else if (item.status === "modified") modified++;
      else if (item.status === "unchanged") unchanged++;
    }

    return { added, deleted, modified, unchanged, total: folderComparisonList.length };
  }, [folderComparisonList]);

  // Filtered folder comparison items
  const filteredFolderItems = useMemo(() => {
    return folderComparisonList.filter((item) => {
      if (folderStatusFilter !== "all" && item.status !== folderStatusFilter) {
        return false;
      }
      if (folderSearch.trim()) {
        return item.relativePath.toLowerCase().includes(folderSearch.toLowerCase().trim());
      }
      return true;
    });
  }, [folderComparisonList, folderStatusFilter, folderSearch]);

  // Automatically select the first modified / added / deleted file when list loads
  React.useEffect(() => {
    if (folderComparisonList.length > 0 && !selectedRelativePath) {
      const firstChanged = folderComparisonList.find((i) => i.status !== "unchanged");
      if (firstChanged) {
        setSelectedRelativePath(firstChanged.relativePath);
      } else {
        setSelectedRelativePath(folderComparisonList[0].relativePath);
      }
    }
  }, [folderComparisonList, selectedRelativePath]);

  // Active diff texts to compare depending on current mode
  const { activeTextA, activeTextB, activeLabelA, activeLabelB } = useMemo(() => {
    if (mode === "file") {
      return {
        activeTextA: fileA?.content || "",
        activeTextB: fileB?.content || "",
        activeLabelA: fileA?.name || t.diff.fileA,
        activeLabelB: fileB?.name || t.diff.fileB,
      };
    } else {
      // Folder mode
      const selectedItem = folderComparisonList.find((i) => i.relativePath === selectedRelativePath);
      return {
        activeTextA: selectedItem?.fileA?.content || "",
        activeTextB: selectedItem?.fileB?.content || "",
        activeLabelA: selectedItem?.fileA ? `${folderAName}/${selectedItem.relativePath}` : `(${t.diff.folderA})`,
        activeLabelB: selectedItem?.fileB ? `${folderBName}/${selectedItem.relativePath}` : `(${t.diff.folderB})`,
      };
    }
  }, [mode, fileA, fileB, folderComparisonList, selectedRelativePath, folderAName, folderBName]);

  // Compute aligned diff rows for the active comparison
  const alignedRows: AlignedRow[] = useMemo(() => {
    if (!activeTextA && !activeTextB) return [];
    return buildAlignedRows(activeTextA, activeTextB, options);
  }, [activeTextA, activeTextB, options]);

  // Indices of changed rows for Quick Jump (Next/Prev difference)
  const changedRowIndices = useMemo(() => {
    const indices: number[] = [];
    alignedRows.forEach((row, idx) => {
      if (row.isChanged) indices.push(idx);
    });
    return indices;
  }, [alignedRows]);

  // Jump to next or previous difference
  const jumpToDiff = (direction: "next" | "prev") => {
    if (changedRowIndices.length === 0) return;

    let nextIndex = 0;
    if (direction === "next") {
      const found = changedRowIndices.find((idx) => idx > currentDiffIndex);
      nextIndex = found !== undefined ? found : changedRowIndices[0];
    } else {
      const reversed = [...changedRowIndices].reverse();
      const found = reversed.find((idx) => idx < currentDiffIndex);
      nextIndex = found !== undefined ? found : changedRowIndices[changedRowIndices.length - 1];
    }

    setCurrentDiffIndex(nextIndex);

    // Scroll to the row element by index
    const targetId = `diff-row-${nextIndex}`;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Render character segments inside row
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
          return (
            <span
              key={idx}
              className="bg-[#fca5a5] text-[#7f1d1d] dark:bg-rose-900/90 dark:text-rose-100 font-medium px-0.5 rounded-xs"
            >
              {seg.text}
            </span>
          );
        } else {
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
  const configurationToolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* 1. Primary Mode Selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 shadow-inner">
          <button
            onClick={() => setMode("file")}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "file"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FileDiff className="w-4 h-4" />
            <span>{t.diff.compareTwoFiles}</span>
          </button>
          <button
            onClick={() => setMode("folder")}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "folder"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>{t.diff.compareFolders}</span>
          </button>
        </div>

        {/* View Mode Toggle (Side-by-Side vs Unified) */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === "split"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
            title={t.diff.split}
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.diff.split}</span>
          </button>
          <button
            onClick={() => setViewMode("unified")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === "unified"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
            title={t.diff.unified}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.diff.unified}</span>
          </button>
        </div>
      </div>

      {/* 2. Options & Controls */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Ignore Whitespace Toggle */}
        <button
          onClick={() => setOptions((prev) => ({ ...prev, ignoreWhitespace: !prev.ignoreWhitespace }))}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
            options.ignoreWhitespace
              ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
          }`}
          title={t.diff.ignoreWhitespace}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t.diff.ignoreWhitespace}</span>
        </button>

        {/* Quick Jump Next/Prev difference */}
        {changedRowIndices.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => jumpToDiff("prev")}
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Khác biệt trước (Shift+F7)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-slate-600 dark:text-slate-400">
              {currentDiffIndex >= 0 ? `${changedRowIndices.indexOf(currentDiffIndex) + 1} / ${changedRowIndices.length}` : `${changedRowIndices.length} khác biệt`}
            </span>
            <button
              onClick={() => jumpToDiff("next")}
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Khác biệt tiếp theo (F7)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Swap files (only in file mode) */}
        {mode === "file" && (fileA || fileB) && (
          <button
            onClick={handleSwapFiles}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            title={t.diff.swap}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{t.diff.swap}</span>
          </button>
        )}

        {/* Clear (only in file mode) */}
        {mode === "file" && (fileA || fileB) && (
          <button
            onClick={handleClearFiles}
            className="p-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50"
            title={t.diff.clearAll}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ToolLayout
      id="file-folder-diff"
      title={t.tools["file-folder-diff"]?.title || "File & Folder Diff"}
      description={t.tools["file-folder-diff"]?.description || "Compare contents between two files"}
      icon={FolderSync}
      categoryName={t.categories["text"]?.title || "Text Utilities"}
      configuration={configurationToolbar}
      customPanes={
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingGlobal(true);
          }}
          onDragLeave={() => setIsDraggingGlobal(false)}
          onDrop={handleGlobalFileDrop}
          className="flex flex-col flex-1 gap-3.5 overflow-hidden relative"
        >
          {/* Global Drag Overlay */}
          {isDraggingGlobal && (
            <div className="absolute inset-0 z-50 bg-indigo-500/15 backdrop-blur-xs border-2 border-dashed border-indigo-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none transition-all">
              <UploadCloud className="w-12 h-12 text-indigo-600 animate-bounce mb-2" />
              <p className="text-base font-semibold text-indigo-700 dark:text-indigo-300">
                Thả 1 hoặc 2 tệp tin vào đây để so sánh
              </p>
              <p className="text-xs text-indigo-600/80 dark:text-indigo-400 mt-0.5">
                (Thả 2 file cùng lúc sẽ tự động nạp vào File A và File B)
              </p>
            </div>
          )}

          {/* Hidden File Inputs */}
          <input
            ref={fileAInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                const item = await readFileToItem(e.target.files[0]);
                setFileA(item);
              }
            }}
          />
          <input
            ref={fileBInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                const item = await readFileToItem(e.target.files[0]);
                setFileB(item);
              }
            }}
          />

          {/* Hidden Folder Inputs */}
          <input
            ref={folderAInputRef}
            type="file"
            // @ts-expect-error webkitdirectory HTML attribute
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => processFolderFiles(e.target.files, "A")}
          />
          <input
            ref={folderBInputRef}
            type="file"
            // @ts-expect-error webkitdirectory HTML attribute
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => processFolderFiles(e.target.files, "B")}
          />

          {/* ============================================================== */}
          {/* TOP SECTION A: 2-FILE SELECTION CARDS                          */}
          {/* ============================================================== */}
          {mode === "file" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
              {/* File A Card */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDropOnCard(e, "left")}
                className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
              >
                {fileA ? (
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 shrink-0">
                        <FileCode2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {t.diff.fileA}
                          </span>
                          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {fileA.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {formatFileSize(fileA.size)} • {fileA.lineCount} {t.common.lines}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleReloadFile("left")}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Đọc lại từ ổ cứng"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => fileAInputRef.current?.click()}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Chọn file khác"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setFileA(null)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors"
                        title="Gỡ file này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileAInputRef.current?.click()}
                    className="p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group"
                  >
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors mb-1.5" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Chọn File Gốc (A)
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Kéo thả tệp tin vào đây hoặc bấm để duyệt
                    </span>
                  </div>
                )}
              </div>

              {/* File B Card */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDropOnCard(e, "right")}
                className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
              >
                {fileB ? (
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 shrink-0">
                        <FileCode2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {t.diff.fileB}
                          </span>
                          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {fileB.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {formatFileSize(fileB.size)} • {fileB.lineCount} {t.common.lines}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleReloadFile("right")}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Đọc lại từ ổ cứng"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => fileBInputRef.current?.click()}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Chọn file khác"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setFileB(null)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors"
                        title="Gỡ file này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileBInputRef.current?.click()}
                    className="p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center group"
                  >
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-teal-500 transition-colors mb-1.5" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Chọn File Đã Sửa (B)
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Kéo thả tệp tin vào đây hoặc bấm để duyệt
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TOP SECTION B: FOLDER SELECTION BAR (When in folder mode)      */}
          {/* ============================================================== */}
          {mode === "folder" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
              {/* Folder A Selector */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">{t.diff.folderA}</div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {folderAName || (language === "vi" ? "Chưa chọn thư mục" : "No folder selected")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {folderAFiles.size} files
                  </span>
                  <button
                    onClick={() => folderAInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{t.diff.browse}</span>
                  </button>
                </div>
              </div>

              {/* Folder B Selector */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">{t.diff.folderB}</div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {folderBName || (language === "vi" ? "Chưa chọn thư mục" : "No folder selected")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {folderBFiles.size} files
                  </span>
                  <button
                    onClick={() => folderBInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{t.diff.browse}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* MAIN WORKSPACE: FOLDER TREE (LEFT) + DIFF VIEWER (RIGHT)       */}
          {/* ============================================================== */}
          <div className="flex flex-1 overflow-hidden rounded-xl border border-slate-300/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            {/* If Mode is FOLDER: render left sidebar list of files */}
            {mode === "folder" && (
              <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t.diff.searchFiles}
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                      className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Status Pills Filter */}
                  <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-0.5">
                    <button
                      onClick={() => setFolderStatusFilter("all")}
                      className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                        folderStatusFilter === "all"
                          ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {t.diff.all} ({folderStats.total})
                    </button>
                    <button
                      onClick={() => setFolderStatusFilter("modified")}
                      className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                        folderStatusFilter === "modified"
                          ? "bg-amber-600 text-white"
                          : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      }`}
                    >
                      {t.diff.modifiedFilter} (~{folderStats.modified})
                    </button>
                    <button
                      onClick={() => setFolderStatusFilter("added")}
                      className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                        folderStatusFilter === "added"
                          ? "bg-teal-600 text-white"
                          : "text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                      }`}
                    >
                      {t.diff.addedFilter} (+{folderStats.added})
                    </button>
                    <button
                      onClick={() => setFolderStatusFilter("deleted")}
                      className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                        folderStatusFilter === "deleted"
                          ? "bg-rose-600 text-white"
                          : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      }`}
                    >
                      {t.diff.deletedFilter} (-{folderStats.deleted})
                    </button>
                  </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-slate-850 py-1">
                  {filteredFolderItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {folderStats.total === 0 ? "Chưa có file nào để hiển thị" : "Không tìm thấy file phù hợp"}
                    </div>
                  ) : (
                    filteredFolderItems.map((item) => {
                      const isSelected = item.relativePath === selectedRelativePath;
                      let badge = null;

                      if (item.status === "modified") {
                        badge = (
                          <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            M
                          </span>
                        );
                      } else if (item.status === "added") {
                        badge = (
                          <span className="w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            A
                          </span>
                        );
                      } else if (item.status === "deleted") {
                        badge = (
                          <span className="w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            D
                          </span>
                        );
                      } else {
                        badge = (
                          <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            =
                          </span>
                        );
                      }

                      return (
                        <div
                          key={item.relativePath}
                          onClick={() => setSelectedRelativePath(item.relativePath)}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium"
                              : "hover:bg-slate-100/60 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate font-mono text-[11px]">{item.relativePath}</span>
                          </div>
                          {badge}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Right Pane: Diff Viewer */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Diff Result Sub-Header */}
              <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {mode === "file"
                      ? fileA && fileB
                        ? `So sánh: ${fileA.name} ↔ ${fileB.name}`
                        : "Kết quả so sánh tệp tin"
                      : selectedRelativePath
                        ? `Chi tiết: ${selectedRelativePath}`
                        : "Chọn tệp tin để xem sai khác"}
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

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {alignedRows.length} {t.common.lines}
                  </span>
                </div>
              </div>

              {/* Empty / Prompt State */}
              {alignedRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-400">
                  <FileDiff className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">{t.diff.noData}</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    {mode === "file"
                      ? (language === "vi" ? "Hãy chọn hoặc kéo thả 2 file vào 2 ô phía trên để bắt đầu đối chiếu sai khác" : "Select or drag & drop 2 files into the cards above to compare")
                      : (language === "vi" ? "Hãy chọn 2 thư mục và bấm vào một tệp tin ở danh sách bên trái" : "Select 2 folders and click a file on the left to inspect differences")}
                  </p>
                </div>
              ) : viewMode === "split" ? (
                /* ========================================================= */
                /* VIEW A: SIDE-BY-SIDE (SONG SONG) VIEW                     */
                /* ========================================================= */
                <div className="flex flex-1 overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-300/80 dark:divide-slate-800 flex-1 overflow-hidden">
                    {/* Left Column: Original */}
                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none truncate">
                        GỐC: {activeLabelA}
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
                          const isCurrentActive = idx === currentDiffIndex;

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
                              id={`diff-row-${idx}`}
                              className={`flex items-center min-h-[24px] ${
                                isCurrentActive ? "ring-2 ring-indigo-500 z-10" : ""
                              } ${row.left.isSpacer ? "bg-transparent" : rowBg}`}
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
                      <div className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none truncate">
                        ĐÃ SỬA: {activeLabelB}
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
                          const isCurrentActive = idx === currentDiffIndex;

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
                                isCurrentActive ? "ring-2 ring-indigo-500 z-10" : ""
                              } ${row.right.isSpacer ? "bg-transparent" : rowBg}`}
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

                  {/* Rightmost Overview Minimap Strip */}
                  <div className="w-3.5 shrink-0 bg-slate-100/60 dark:bg-slate-850/60 border-l border-slate-200 dark:border-slate-800 flex flex-col py-1 select-none">
                    {alignedRows.map((r, i) => {
                      const isDel = r.isChanged && !r.left.isSpacer && r.right.isSpacer;
                      const isAdd = r.isChanged && r.left.isSpacer && !r.right.isSpacer;
                      const isMod = r.isChanged && !r.left.isSpacer && !r.right.isSpacer;

                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setCurrentDiffIndex(i);
                            document.getElementById(`diff-row-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="w-full min-h-[3px] flex-1 flex cursor-pointer"
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
                /* ========================================================= */
                /* VIEW B: UNIFIED (TỔNG HỢP) VIEW                           */
                /* ========================================================= */
                <div
                  ref={unifiedScrollRef}
                  className="flex-1 overflow-auto font-mono text-xs leading-6 py-1 bg-white dark:bg-slate-900"
                >
                  {alignedRows.map((row, idx) => {
                    if (!row.isChanged) {
                      return (
                        <div
                          key={idx}
                          id={`diff-row-${idx}`}
                          className="flex items-center min-h-[24px] hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200"
                        >
                          <div className="w-10 h-6 flex items-center justify-end pr-2 text-[11px] text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
                            {row.left.lineNum}
                          </div>
                          <div className="w-10 h-6 flex items-center justify-end pr-2 text-[11px] text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
                            {row.right.lineNum}
                          </div>
                          <div className="w-6 h-6 flex items-center justify-center text-slate-400 select-none font-bold">
                            {" "}
                          </div>
                          <div className="flex-1 px-2 whitespace-pre overflow-visible">
                            {row.left.text}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={idx}>
                        {!row.left.isSpacer && (
                          <div
                            id={`diff-row-${idx}`}
                            className="flex items-center min-h-[24px] bg-[#fee2e2]/60 dark:bg-rose-950/30 text-[#4c0519] dark:text-rose-100"
                          >
                            <div className="w-10 h-6 flex items-center justify-end pr-2 text-[11px] bg-[#fca5a5] text-[#7f1d1d] font-semibold select-none border-r border-slate-200 dark:border-slate-800">
                              {row.left.lineNum}
                            </div>
                            <div className="w-10 h-6 flex items-center justify-end pr-2 text-[11px] bg-[#fee2e2] text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
                              {" "}
                            </div>
                            <div className="w-6 h-6 flex items-center justify-center text-rose-600 font-bold select-none">
                              -
                            </div>
                            <div className="flex-1 px-2 whitespace-pre overflow-visible">
                              {renderSegments(row.left.segments, false, "left", true, row.left.text)}
                            </div>
                          </div>
                        )}

                        {!row.right.isSpacer && (
                          <div className="flex items-center min-h-[24px] bg-[#ccfbf1]/50 dark:bg-teal-950/30 text-[#042f2e] dark:text-teal-100">
                            <div className="w-10 h-6 flex items-center justify-end pr-2 text-[11px] bg-[#ccfbf1] text-slate-400 select-none border-r border-slate-200 dark:border-slate-800">
                              {" "}
                            </div>
                            <div className="w-10 h-6 flex items-center justify-end pr-2 text-[11px] bg-[#5eead4] text-[#134e4a] font-semibold select-none border-r border-slate-200 dark:border-slate-800">
                              {row.right.lineNum}
                            </div>
                            <div className="w-6 h-6 flex items-center justify-center text-teal-600 font-bold select-none">
                              +
                            </div>
                            <div className="flex-1 px-2 whitespace-pre overflow-visible">
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
        </div>
      }
    />
  );
};
