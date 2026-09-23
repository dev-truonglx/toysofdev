import React, { useState, useEffect } from "react";
import { Code2, ArrowLeftRight } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type Mode = "encode" | "decode";

export const HtmlEncoder: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const encodeHtml = (str: string): string => {
    return str.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return char;
      }
    });
  };

  const decodeHtml = (str: string): string => {
    const doc = new DOMParser().parseFromString(str, "text/html");
    return doc.documentElement.textContent || "";
  };

  useEffect(() => {
    if (!input) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      if (mode === "encode") {
        setOutput(encodeHtml(input));
      } else {
        setOutput(decodeHtml(input));
      }
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "HTML conversion error");
      setOutput("");
    }
  }, [input, mode]);

  const handleSwap = () => {
    setMode((prev) => (prev === "encode" ? "decode" : "encode"));
    if (output) setInput(output);
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
    </>
  );

  return (
    <ToolLayout
      id="html-encoder"
      title="HTML Entity Encoder / Decoder"
      description="Encode and decode HTML entities and special characters"
      icon={Code2}
      categoryName="Encoders / Decoders"
      configuration={config}
      inputLabel={mode === "encode" ? "Raw HTML/Text" : "Encoded HTML Entity"}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder={mode === "encode" ? '<div class="greeting">Hello & World</div>' : "&lt;div&gt;Hello &amp; World&lt;/div&gt;"}
      outputLabel={mode === "encode" ? "Encoded HTML Entities" : "Decoded Text"}
      outputValue={output}
      error={error}
    />
  );
};
