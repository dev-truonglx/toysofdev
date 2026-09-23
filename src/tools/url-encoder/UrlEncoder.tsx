import React, { useState, useEffect } from "react";
import { Globe, ArrowLeftRight } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type ConversionMode = "encode" | "decode";

export const UrlEncoder: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ConversionMode>("encode");
  const [encodeFullUrl, setEncodeFullUrl] = useState(false);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    </>
  );

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
      inputPlaceholder={mode === "encode" ? "https://example.com/search?q=hello world" : "https%3A%2F%2Fexample.com"}
      outputLabel={mode === "encode" ? "Encoded URL" : "Decoded Text"}
      outputValue={output}
      error={error}
    />
  );
};
