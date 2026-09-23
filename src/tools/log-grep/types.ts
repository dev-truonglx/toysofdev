export interface FilterOptions {
  pattern: string;
  isRegex: boolean;
  matchCase: boolean;
  wholeWord: boolean;
  invertMatch: boolean;
  contextLines: number;
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
  error: string | null;
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
