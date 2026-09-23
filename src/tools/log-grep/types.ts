export interface FilterOptions {
  pattern: string;
  isRegex: boolean;
  matchCase: boolean;
  wholeWord: boolean;
  invertMatch: boolean;
  contextLines?: number;
  customExpandedIndices?: number[];
}

export interface HighlightRange {
  start: number;
  end: number;
}

export interface FilterLineResult {
  lineNumber: number;
  content: string;
  isMatch: boolean;
  isContext: boolean;
  highlights: HighlightRange[];
}

export interface FilterResult {
  lines: FilterLineResult[];
  totalSourceLines: number;
  matchedCount: number;
  executionTimeMs: number;
  isTruncated?: boolean;
  fileSizeBytes?: number;
  error: string | null;
}

export type IndexStatus = "notIndexed" | "indexing" | "ready" | "error";

export interface FileHandle {
  fileId: string;
  filePath: string;
  fileSize: number;
  indexStatus: IndexStatus;
  totalLines: number;
}

export interface IndexProgressEvent {
  fileId: string;
  percent: number;
  totalLines: number;
  status: IndexStatus;
}

export interface SearchMatchItem {
  lineNumber: number;
  byteOffset: number;
  content: string;
  highlights: HighlightRange[];
}

export interface SearchResultSummaryEvent {
  searchId: string;
  fileId: string;
  totalMatches: number;
  executionTimeMs: number;
  error?: string | null;
}

export interface LineItem {
  lineNumber: number;
  content: string;
}

export type PresetCategory =
  | "levels"
  | "exceptions"
  | "timestamps"
  | "http"
  | "network"
  | "structured";

export interface RegexPreset {
  id: string;
  label: string;
  pattern: string;
  category: PresetCategory;
  description: string;
  example?: string;
  isRegex?: boolean;
  invertMatch?: boolean;
}
