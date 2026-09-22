import React, { useState, useEffect } from "react";
import { Binary, ArrowLeftRight } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type ConversionMode = "encode" | "decode";

export const Base64Converter: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ConversionMode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
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
        const bytes = new TextEncoder().encode(input);
        let binString = "";
        for (let i = 0; i < bytes.length; i++) {
          binString += String.fromCharCode(bytes[i]);
        }
        let res = btoa(binString);
        if (urlSafe) {
          res = res.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        }
        setOutput(res);
        setError(null);
      } else {
        let str = input.trim();
        if (urlSafe || str.includes("-") || str.includes("_")) {
          str = str.replace(/-/g, "+").replace(/_/g, "/");
          while (str.length % 4) {
            str += "=";
          }
        }
        const binString = atob(str);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) {
          bytes[i] = binString.charCodeAt(i);
        }
        const decoded = new TextDecoder().decode(bytes);
        setOutput(decoded);
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to convert Base64");
      setOutput("");
    }
  }, [input, mode, urlSafe]);

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
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>{t.ui.switchInputOutput}</span>
      </button>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={urlSafe}
          onChange={(e) => setUrlSafe(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>{t.ui.urlSafe}</span>
      </label>
    </>
  );

  return (
    <ToolLayout
      id="base64-converter"
      title="Base64 Text Encoder / Decoder"
      description="Encode and decode text data to and from Base64 format with full UTF-8 support"
      icon={Binary}
      categoryName="Encoders / Decoders"
      configuration={config}
      inputLabel={mode === "encode" ? "Raw Text" : "Base64"}
      inputValue={input}
      onInputChange={setInput}
      outputLabel={mode === "encode" ? "Base64" : "Decoded Text"}
      outputValue={output}
      error={error}
    />
  );
};
