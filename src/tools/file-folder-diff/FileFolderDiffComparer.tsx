import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Binary,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import {
  computeDiff,
  computeJsDiff,
  AlignedRow,
  DiffSegment,
  DiffOptions,
  splitLines,
  isBinaryFileName,
  isBinaryBuffer,
} from "../text-diff/diffEngine";

const ROW_HEIGHT = 24; // Fixed 24px height per row
const OVERSCAN = 15; // Extra rows rendered above and below viewport

export interface FileItem {
  name: string;
  path: string;
  size: number;
  lineCount?: number;
  content?: string; // Loaded lazily on demand
  isBinary?: boolean;
  rawFile?: File;
}

export interface FolderComparisonItem {
  relativePath: string;
  status: "added" | "deleted" | "modified" | "unchanged";
  fileA?: FileItem;
  fileB?: FileItem;
  isBinary?: boolean;
}

interface UnifiedLine {
  type: "equal" | "delete" | "insert";
  leftLineNum?: number;
  rightLineNum?: number;
  text: string;
  segments: DiffSegment[];
  isOriginalChanged: boolean;
}

export function normalizeLine(line: string, options: DiffOptions): string {
  let res = line;
  if (options.ignoreCase) res = res.toLowerCase();
  if (options.ignoreWhitespace) res = res.trim().replace(/\s+/g, " ");
  return res;
}

export function buildAlignedRows(
  oldText: string,
  newText: string,
  options: DiffOptions,
): (AlignedRow & { type?: "MOD" | "ADD" | "DEL" | "SAME" })[] {
  const res = computeJsDiff(oldText, newText, options);
  return res.rows.map((row: AlignedRow) => {
    let type: "MOD" | "ADD" | "DEL" | "SAME" = "SAME";
    if (row.isChanged) {
      if (!row.left.isSpacer && !row.right.isSpacer) type = "MOD";
      else if (row.left.isSpacer && !row.right.isSpacer) type = "ADD";
      else type = "DEL";
    }
    return { ...row, type };
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  // Mode 2: Folder Diff States
  const [folderAName, setFolderAName] = useState<string>("");
  const [folderBName, setFolderBName] = useState<string>("");
  const [folderAFiles, setFolderAFiles] = useState<Map<string, FileItem>>(new Map());
  const [folderBFiles, setFolderBFiles] = useState<Map<string, FileItem>>(new Map());
  const [selectedRelativePath, setSelectedRelativePath] = useState<string | null>(null);
  const [folderSearch, setFolderSearch] = useState<string>("");
  const [folderStatusFilter, setFolderStatusFilter] = useState<
    "all" | "modified" | "added" | "deleted" | "unchanged"
  >("all");

  // Diff Engine & Virtual Scroll states
  const [alignedRows, setAlignedRows] = useState<AlignedRow[]>([]);
  const [totalDifferences, setTotalDifferences] = useState<number>(0);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(-1);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(500);

  // Refs
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const unifiedScrollRef = useRef<HTMLDivElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileAInputRef = useRef<HTMLInputElement>(null);
  const fileBInputRef = useRef<HTMLInputElement>(null);
  const folderAInputRef = useRef<HTMLInputElement>(null);
  const folderBInputRef = useRef<HTMLInputElement>(null);

  // Helper: Read file metadata and check binary
  const createFileItem = async (file: File, customPath?: string, eagerText = false): Promise<FileItem> => {
    let isBinary = isBinaryFileName(file.name);
    let content: string | undefined = undefined;
    let lineCount: number | undefined = undefined;

    if (!isBinary) {
      try {
        const slice = await file.slice(0, 512).arrayBuffer();
        if (isBinaryBuffer(new Uint8Array(slice))) {
          isBinary = true;
        }
      } catch (err) {
        console.warn("Could not check binary buffer:", err);
      }
    }

    if (eagerText && !isBinary) {
      try {
        content = await file.text();
        lineCount = splitLines(content).length;
      } catch (err) {
        console.error("Failed to read text:", err);
        isBinary = true;
      }
    }

    return {
      name: file.name,
      path: customPath || file.name,
      size: file.size,
      lineCount,
      content,
      isBinary,
      rawFile: file,
    };
  };

  // Helper: Lazily load text content on-demand
  const ensureContent = useCallback(async (item: FileItem | null | undefined): Promise<FileItem | null> => {
    if (!item) return null;
    if (item.content !== undefined || item.isBinary) return item;

    if (item.rawFile) {
      try {
        const slice = await item.rawFile.slice(0, 512).arrayBuffer();
        if (isBinaryBuffer(new Uint8Array(slice))) {
          item.isBinary = true;
          return { ...item, isBinary: true };
        }

        const text = await item.rawFile.text();
        const lines = splitLines(text);
        item.content = text;
        item.lineCount = lines.length;
        return { ...item, content: text, lineCount: lines.length };
      } catch (err) {
        console.error("Failed to load file text:", err);
        item.isBinary = true;
        return { ...item, isBinary: true };
      }
    }
    return item;
  }, []);

  // Drag & drop handlers for 2-File Mode
  const handleFileDropOnCard = async (e: React.DragEvent, targetSide: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (droppedFiles.length >= 2) {
      const itemA = await createFileItem(droppedFiles[0], undefined, true);
      const itemB = await createFileItem(droppedFiles[1], undefined, true);
      setFileA(itemA);
      setFileB(itemB);
      return;
    }

    const item = await createFileItem(droppedFiles[0], undefined, true);
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
      const itemA = await createFileItem(droppedFiles[0], undefined, true);
      const itemB = await createFileItem(droppedFiles[1], undefined, true);
      setFileA(itemA);
      setFileB(itemB);
    } else {
      const item = await createFileItem(droppedFiles[0], undefined, true);
      if (!fileA) setFileA(item);
      else setFileB(item);
    }
  };

  // Reload file from rawFile reference
  const handleReloadFile = async (side: "left" | "right") => {
    const target = side === "left" ? fileA : fileB;
    if (target?.rawFile) {
      const updated = await createFileItem(target.rawFile, target.path, true);
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

  // Fast metadata-only folder scanner (LAZY LOADING)
  const processFolderFiles = async (files: FileList | null, side: "A" | "B") => {
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

      const normalizedPath = parts.length > 1 ? parts.slice(1).join("/") : relPath;

      // Filter out typical system / git junk files
      if (
        normalizedPath.includes(".git/") ||
        normalizedPath.includes(".DS_Store") ||
        normalizedPath.includes("node_modules/")
      ) {
        continue;
      }

      const isBinary = isBinaryFileName(file.name);

      // Fast metadata object - NO eager text reading!
      const item: FileItem = {
        name: file.name,
        path: normalizedPath,
        size: file.size,
        isBinary,
        rawFile: file,
      };

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

  // Compute folder comparison list via fast Heuristics
  const folderComparisonList: FolderComparisonItem[] = useMemo(() => {
    if (folderAFiles.size === 0 && folderBFiles.size === 0) return [];

    const allPaths = new Set([...Array.from(folderAFiles.keys()), ...Array.from(folderBFiles.keys())]);
    const sortedPaths = Array.from(allPaths).sort((a, b) => a.localeCompare(b));

    const result: FolderComparisonItem[] = [];

    for (const relPath of sortedPaths) {
      const a = folderAFiles.get(relPath);
      const b = folderBFiles.get(relPath);
      const isBinary = a?.isBinary || b?.isBinary || false;

      if (a && !b) {
        result.push({ relativePath: relPath, status: "deleted", fileA: a, isBinary });
      } else if (!a && b) {
        result.push({ relativePath: relPath, status: "added", fileB: b, isBinary });
      } else if (a && b) {
        // Fast size heuristic: if sizes differ, it is definitely modified!
        let status: "modified" | "unchanged" = "unchanged";
        if (a.size !== b.size) {
          status = "modified";
        } else if (a.content !== undefined && b.content !== undefined) {
          status = a.content === b.content ? "unchanged" : "modified";
        }
        result.push({
          relativePath: relPath,
          status,
          fileA: a,
          fileB: b,
          isBinary,
        });
      }
    }

    return result;
  }, [folderAFiles, folderBFiles]);

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
  useEffect(() => {
    if (folderComparisonList.length > 0 && !selectedRelativePath) {
      const firstChanged = folderComparisonList.find((i) => i.status !== "unchanged");
      if (firstChanged) {
        setSelectedRelativePath(firstChanged.relativePath);
      } else {
        setSelectedRelativePath(folderComparisonList[0].relativePath);
      }
    }
  }, [folderComparisonList, selectedRelativePath]);

  // Active target items
  const { currentItemA, currentItemB, activeLabelA, activeLabelB, isBinaryComparison } = useMemo(() => {
    if (mode === "file") {
      const isBin = fileA?.isBinary || fileB?.isBinary || false;
      return {
        currentItemA: fileA,
        currentItemB: fileB,
        activeLabelA: fileA?.name || t.diff.fileA,
        activeLabelB: fileB?.name || t.diff.fileB,
        isBinaryComparison: isBin,
      };
    } else {
      const selected = folderComparisonList.find((i) => i.relativePath === selectedRelativePath);
      const isBin = selected?.isBinary || false;
      return {
        currentItemA: selected?.fileA || null,
        currentItemB: selected?.fileB || null,
        activeLabelA: selected?.fileA ? `${folderAName}/${selected.relativePath}` : `(${t.diff.folderA})`,
        activeLabelB: selected?.fileB ? `${folderBName}/${selected.relativePath}` : `(${t.diff.folderB})`,
        isBinaryComparison: isBin,
      };
    }
  }, [mode, fileA, fileB, folderComparisonList, selectedRelativePath, folderAName, folderBName, t]);

  // On-demand diff calculation with debounce & race cancellation
  useEffect(() => {
    let isCurrent = true;

    if (!currentItemA && !currentItemB) {
      setAlignedRows([]);
      setTotalDifferences(0);
      setIsComputing(false);
      return;
    }

    if (isBinaryComparison) {
      setAlignedRows([]);
      setTotalDifferences(currentItemA?.size !== currentItemB?.size ? 1 : 0);
      setIsComputing(false);
      return;
    }

    setIsComputing(true);

    const timer = setTimeout(async () => {
      try {
        const loadedA = await ensureContent(currentItemA);
        const loadedB = await ensureContent(currentItemB);

        if (!isCurrent) return;

        if (loadedA?.isBinary || loadedB?.isBinary) {
          setAlignedRows([]);
          setTotalDifferences(loadedA?.size !== loadedB?.size ? 1 : 0);
          setIsComputing(false);
          return;
        }

        const textA = loadedA?.content || "";
        const textB = loadedB?.content || "";

        const result = await computeDiff(textA, textB, options);
        if (isCurrent) {
          setAlignedRows(result.rows);
          setTotalDifferences(result.differencesCount);
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
  }, [currentItemA, currentItemB, isBinaryComparison, options, ensureContent]);

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
  }, [viewMode, mode]);

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

  // Synchronized scroll handlers
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

  // Draw Canvas Minimap
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

  // Jump to Next / Prev Difference
  const changedRowIndices = useMemo(() => {
    const indices: number[] = [];
    alignedRows.forEach((row, idx) => {
      if (row.isChanged) indices.push(idx);
    });
    return indices;
  }, [alignedRows]);

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
    const targetScrollTop = nextIndex * ROW_HEIGHT - viewportHeight / 2;
    if (viewMode === "split") {
      if (leftScrollRef.current) leftScrollRef.current.scrollTop = targetScrollTop;
      if (rightScrollRef.current) rightScrollRef.current.scrollTop = targetScrollTop;
    } else {
      if (unifiedScrollRef.current) unifiedScrollRef.current.scrollTop = targetScrollTop;
    }
    setScrollTop(targetScrollTop);
  };

  // Render character diff segments
  const renderSegments = (
    segments: DiffSegment[],
    isSpacer: boolean,
    side: "left" | "right",
    _isChanged: boolean,
    fallbackText?: string,
  ) => {
    if (isSpacer) return <span className="opacity-0 select-none">{" "}</span>;
    if (!segments || segments.length === 0) {
      return <span className="text-slate-800 dark:text-slate-200">{fallbackText || " "}</span>;
    }

    return segments.map((seg, idx) => {
      if (seg.isDiff) {
        if (side === "left") {
          return (
            <span
              key={idx}
              className="bg-rose-200/90 text-rose-950 dark:bg-rose-500/35 dark:text-rose-100 font-semibold px-0.5 rounded-xs border border-rose-300 dark:border-rose-400/60 shadow-xs"
            >
              {seg.text}
            </span>
          );
        } else {
          return (
            <span
              key={idx}
              className="bg-teal-200/90 text-teal-950 dark:bg-teal-500/35 dark:text-teal-100 font-semibold px-0.5 rounded-xs border border-teal-300 dark:border-teal-400/60 shadow-xs"
            >
              {seg.text}
            </span>
          );
        }
      }

      // Unchanged text: Keep clear readable neutral color, do NOT turn all text red or green!
      return (
        <span key={idx} className="text-slate-800 dark:text-slate-100">
          {seg.text}
        </span>
      );
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
              title="Khác biệt trước"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-slate-600 dark:text-slate-400">
              {currentDiffIndex >= 0
                ? `${changedRowIndices.indexOf(currentDiffIndex) + 1} / ${changedRowIndices.length}`
                : `${changedRowIndices.length} khác biệt`}
            </span>
            <button
              onClick={() => jumpToDiff("next")}
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Khác biệt tiếp theo"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Computing Spinner */}
        {isComputing && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}

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
                const item = await createFileItem(e.target.files[0], undefined, true);
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
                const item = await createFileItem(e.target.files[0], undefined, true);
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
                onClick={!fileA ? () => fileAInputRef.current?.click() : undefined}
                className={`flex flex-col rounded-xl transition-all ${
                  fileA
                    ? "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                    : "border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 p-4 items-center justify-center text-center group shadow-xs"
                }`}
              >
                {fileA ? (
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 shrink-0">
                        {fileA.isBinary ? <Binary className="w-5 h-5 text-amber-500" /> : <FileCode2 className="w-5 h-5" />}
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
                          {formatFileSize(fileA.size)} {fileA.isBinary ? "• Tệp nhị phân" : fileA.lineCount !== undefined ? `• ${fileA.lineCount} dòng` : ""}
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
                  <>
                    <UploadCloud className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors mb-1.5" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Chọn File Gốc (A)
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Kéo thả tệp tin vào đây hoặc bấm để duyệt
                    </span>
                  </>
                )}
              </div>

              {/* File B Card */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDropOnCard(e, "right")}
                onClick={!fileB ? () => fileBInputRef.current?.click() : undefined}
                className={`flex flex-col rounded-xl transition-all ${
                  fileB
                    ? "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                    : "border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-teal-400 dark:hover:border-teal-500 cursor-pointer bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 p-4 items-center justify-center text-center group shadow-xs"
                }`}
              >
                {fileB ? (
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 shrink-0">
                        {fileB.isBinary ? <Binary className="w-5 h-5 text-amber-500" /> : <FileCode2 className="w-5 h-5" />}
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
                          {formatFileSize(fileB.size)} {fileB.isBinary ? "• Tệp nhị phân" : fileB.lineCount !== undefined ? `• ${fileB.lineCount} dòng` : ""}
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
                  <>
                    <UploadCloud className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors mb-1.5" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Chọn File Đã Sửa (B)
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Kéo thả tệp tin vào đây hoặc bấm để duyệt
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TOP SECTION B: FOLDER SELECTION BAR                            */}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
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
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t.diff.searchFiles}
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                      className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Status Filter Pills */}
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
                <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-slate-800 py-1">
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
                            {item.isBinary ? (
                              <Binary className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
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
              <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs shrink-0">
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
                  {!isBinaryComparison && (
                    <div className="hidden sm:flex items-center gap-2 text-[11px]">
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#fee2e2] dark:bg-rose-950/80 border border-[#fca5a5] dark:border-rose-800" />
                        {t.diff.original}
                      </span>
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#ccfbf1] dark:bg-teal-950/80 border border-[#99f6e4] dark:border-teal-800" />
                        {t.diff.modified}
                      </span>
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[repeating-linear-gradient(-45deg,transparent,transparent_2px,rgba(148,163,184,0.5)_2px,rgba(148,163,184,0.5)_4px)] border border-slate-300 dark:border-slate-600" />
                        {t.diff.spacer}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isBinaryComparison && totalItems > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                        totalDifferences > 0
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {totalDifferences > 0
                        ? `${totalDifferences} ${t.diff.differencesCount}`
                        : t.diff.allMatching}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isBinaryComparison
                      ? "Tệp nhị phân"
                      : `${totalItems} ${t.common.lines}`}
                  </span>
                </div>
              </div>

              {/* BINARY FILE DIFF CARD */}
              {isBinaryComparison && (currentItemA || currentItemB) ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 mb-3 shadow-sm">
                    <Binary className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    So sánh Tệp Nhị phân (Binary Files)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    Tệp nhị phân (hình ảnh, tài liệu nén, tệp thực thi, media) không thể hiển thị khác biệt theo từng dòng văn bản.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-6 w-full max-w-lg">
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-left">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">{t.diff.fileA}</div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {currentItemA?.name || "Không có tệp"}
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-1">
                        {currentItemA ? formatFileSize(currentItemA.size) : "-"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-left">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">{t.diff.fileB}</div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {currentItemB?.name || "Không có tệp"}
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-1">
                        {currentItemB ? formatFileSize(currentItemB.size) : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {currentItemA && currentItemB && currentItemA.size === currentItemB.size ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Kích thước tệp giống nhau ({formatFileSize(currentItemA.size)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Kích thước tệp khác nhau (Đã sửa đổi)
                      </span>
                    )}
                  </div>
                </div>
              ) : totalItems === 0 ? (
                /* Empty / Prompt State */
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-400">
                  <FileDiff className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">{t.diff.noData}</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    {mode === "file"
                      ? language === "vi"
                        ? "Hãy chọn hoặc kéo thả 2 file vào 2 ô phía trên để bắt đầu đối chiếu sai khác"
                        : "Select or drag & drop 2 files into the cards above to compare"
                      : language === "vi"
                        ? "Hãy chọn 2 thư mục và bấm vào một tệp tin ở danh sách bên trái"
                        : "Select 2 folders and click a file on the left to inspect differences"}
                  </p>
                </div>
              ) : (
                /* VIRTUALIZED TEXT DIFF VIEWER WITH CANVAS MINIMAP */
                <div
                  ref={viewportContainerRef}
                  className="flex flex-1 overflow-hidden relative"
                >
                  <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Split Column Headers */}
                    {viewMode === "split" && (
                      <div className="grid grid-cols-2 divide-x divide-slate-300/80 dark:divide-slate-800 shrink-0 border-b border-slate-200 dark:border-slate-800 select-none">
                        <div className="px-3 py-1 bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate">
                          GỐC: {activeLabelA}
                        </div>
                        <div className="px-3 py-1 bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate">
                          ĐÃ SỬA: {activeLabelB}
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
                              const isCurrentActive = idx === currentDiffIndex;

                              let leftGutter = "text-slate-400 dark:text-slate-500 font-normal bg-slate-50/90 dark:bg-slate-900";
                              let leftBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";
                              if (isPureDel) {
                                leftGutter = "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100 font-semibold";
                                leftBg = "bg-rose-100/70 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200 font-medium";
                              } else if (isMod) {
                                leftGutter = "bg-rose-100/70 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 font-medium";
                                leftBg = "bg-rose-50/40 dark:bg-rose-950/20";
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`flex h-6 min-h-[24px] w-full ${row.left.isSpacer ? "bg-transparent" : leftBg} ${
                                    isCurrentActive ? "ring-2 ring-indigo-500 z-10" : ""
                                  }`}
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
                              const isCurrentActive = idx === currentDiffIndex;

                              let rightGutter = "text-slate-400 dark:text-slate-500 font-normal bg-slate-50/90 dark:bg-slate-900";
                              let rightBg = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40";
                              if (isPureAdd) {
                                rightGutter = "bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-100 font-semibold";
                                rightBg = "bg-teal-100/70 text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 font-medium";
                              } else if (isMod) {
                                rightGutter = "bg-teal-100/70 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 font-medium";
                                rightBg = "bg-teal-50/40 dark:bg-teal-950/20";
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`flex h-6 min-h-[24px] w-full ${row.right.isSpacer ? "bg-transparent" : rightBg} ${
                                    isCurrentActive ? "ring-2 ring-indigo-500 z-10" : ""
                                  }`}
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
                            let leftGutterBg = "bg-slate-50/90 dark:bg-slate-900 text-slate-400 dark:text-slate-500";
                            let rightGutterBg = "bg-slate-50/90 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-800";
                            let markerBg = "bg-slate-50/90 dark:bg-slate-900 text-slate-300 dark:text-slate-600";
                            let textColor = "text-slate-800 dark:text-slate-200";

                            if (isDel) {
                              rowBg = "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/40 dark:hover:bg-rose-950/30 transition-colors";
                              leftGutterBg = "bg-rose-100/70 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-medium";
                              rightGutterBg = "bg-rose-50/80 text-slate-400 dark:text-slate-600 border-r border-rose-200/50 dark:border-rose-900/40";
                              markerBg = "bg-rose-100/70 text-rose-600 dark:text-rose-400 font-bold";
                              textColor = "text-slate-800 dark:text-slate-200";
                            } else if (isAdd) {
                              rowBg = "bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-100/40 dark:hover:bg-teal-950/30 transition-colors";
                              leftGutterBg = "bg-teal-50/80 text-slate-400 dark:text-slate-600";
                              rightGutterBg = "bg-teal-100/70 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-medium border-r border-teal-200/50 dark:border-teal-900/40";
                              markerBg = "bg-teal-100/70 text-teal-600 dark:text-teal-400 font-bold";
                              textColor = "text-slate-800 dark:text-slate-200";
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
                  <div className="w-3.5 shrink-0 bg-slate-100/60 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-800 flex select-none relative">
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
        </div>
      }
    />
  );
};
