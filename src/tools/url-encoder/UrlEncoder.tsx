import React, { useState, useEffect, useMemo, useRef } from "react";
import { Globe, ArrowLeftRight, Sparkles } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import { parseUrlDecode, parseUrlEncode, UrlSegment } from "./urlUtils";

type ConversionMode = "encode" | "decode";

export const UrlEncoder: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ConversionMode>("encode");
  const [encodeFullUrl, setEncodeFullUrl] = useState(false);
  const [highlightChanges, setHighlightChanges] = useState(true);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!input) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      if (mode === "encode") {
        const result = encodeFullUrl ? encodeURI(input) : encodeURIComponent(input);
        setOutput(result);
        setError(null);
      } else {
        const result = encodeFullUrl ? decodeURI(input) : decodeURIComponent(input);
        setOutput(result);
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process URL");
      setOutput("");
    }
  }, [input, mode, encodeFullUrl]);

  const handleSwap = () => {
    setMode((prev) => (prev === "encode" ? "decode" : "encode"));
    if (output) {
      setInput(output);
    }
  };

  const segments = useMemo(() => {
    if (!input || error) return [];
    return mode === "decode"
      ? parseUrlDecode(input, encodeFullUrl)
      : parseUrlEncode(input, encodeFullUrl);
  }, [input, mode, encodeFullUrl, error]);

  const changedCount = useMemo(
    () => segments.filter((s) => s.isChanged).length,
    [segments]
  );

  const handleMouseEnterSegment = (idx: number, seg: UrlSegment) => {
    setHoveredSegmentIndex(idx);
    if (inputRef.current && seg.isChanged) {
      inputRef.current.focus({ preventScroll: true });
      inputRef.current.setSelectionRange(seg.inputStart, seg.inputEnd);
    }
  };

  const handleMouseLeaveSegment = () => {
    setHoveredSegmentIndex(null);
    if (inputRef.current) {
      const pos = inputRef.current.selectionEnd;
      inputRef.current.setSelectionRange(pos, pos);
    }
  };

  const config = (
    <>
      <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setMode("encode")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "encode"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.encode}
        </button>
        <button
          onClick={() => setMode("decode")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "decode"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.decode}
        </button>
      </div>

      <button
        onClick={handleSwap}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>{t.ui.switchInputOutput}</span>
      </button>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={encodeFullUrl}
          onChange={(e) => setEncodeFullUrl(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>Full URL mode (URI)</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={highlightChanges}
          onChange={(e) => setHighlightChanges(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          {t.ui.highlightDecoded || "Highlight decoded"}
        </span>
      </label>
    </>
  );

  const outputExtraActions = (
    output && changedCount > 0 && highlightChanges ? (
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span>
          {changedCount} {mode === "decode" ? "decoded" : "encoded"}
        </span>
      </div>
    ) : null
  );

  const outputNode = useMemo(() => {
    if (!output) {
      return null;
    }

    if (!highlightChanges || changedCount === 0) {
      return <span>{output}</span>;
    }

    return (
      <span>
        {segments.map((seg, idx) => {
          if (!seg.isChanged) {
            return <span key={idx}>{seg.text}</span>;
          }

          const isHovered = hoveredSegmentIndex === idx;

          const highlightClass = isHovered
            ? "bg-amber-300/80 dark:bg-amber-500/40 text-amber-950 dark:text-amber-100 font-semibold ring-1 ring-amber-400/70 dark:ring-amber-500/50 rounded-[2px] cursor-pointer transition-all inline-block z-10 relative"
            : "bg-amber-200/70 dark:bg-amber-500/25 text-amber-950 dark:text-amber-200 rounded-[2px] transition-colors hover:bg-amber-300/80 dark:hover:bg-amber-500/35 cursor-pointer";

          return (
            <span
              key={idx}
              className={highlightClass}
              onMouseEnter={() => handleMouseEnterSegment(idx, seg)}
              onMouseLeave={handleMouseLeaveSegment}
            >
              {seg.text}
            </span>
          );
        })}
      </span>
    );
  }, [output, highlightChanges, changedCount, segments, mode, hoveredSegmentIndex]);

  return (
    <ToolLayout
      id="url-encoder"
      title="URL Encoder / Decoder"
      description="Encode or decode characters according to RFC 3986"
      icon={Globe}
      categoryName="Encoders / Decoders"
      configuration={config}
      inputLabel={mode === "encode" ? "Decoded URL / Text" : "Encoded URL"}
      inputValue={input}
      onInputChange={setInput}
      inputRef={inputRef}
      inputPlaceholder={mode === "encode" ? "https://example.com/search?q=hello world" : "https%3A%2F%2Fexample.com"}
      outputLabel={mode === "encode" ? "Encoded URL" : "Decoded Text"}
      outputValue={output}
      outputNode={outputNode}
      outputExtraActions={outputExtraActions}
      error={error}
    />
  );
};
