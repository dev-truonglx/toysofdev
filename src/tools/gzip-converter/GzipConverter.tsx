import React, { useState, useEffect } from "react";
import { FileArchive, ArrowLeftRight } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type GzipMode = "compress" | "decompress";

export const GzipConverter: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GzipMode>("compress");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [stats, setStats] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function processGzip() {
      if (!input) {
        setOutput("");
        setStats(null);
        setError(null);
        return;
      }

      try {
        if (mode === "compress") {
          const encoder = new TextEncoder();
          const data = encoder.encode(input);

          const stream = new Response(data).body?.pipeThrough(new CompressionStream("gzip"));
          if (!stream) throw new Error("CompressionStream not supported");
          const compressedBuffer = await new Response(stream).arrayBuffer();
          const bytes = new Uint8Array(compressedBuffer);

          let bin = "";
          for (let i = 0; i < bytes.length; i++) {
            bin += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(bin);

          if (!isCancelled) {
            setOutput(base64);
            const ratio = ((base64.length / input.length) * 100).toFixed(1);
            setStats(`${input.length} B → ${base64.length} B (${ratio}%)`);
            setError(null);
          }
        } else {
          const bin = atob(input.trim());
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
          }

          const stream = new Response(bytes).body?.pipeThrough(new DecompressionStream("gzip"));
          if (!stream) throw new Error("DecompressionStream not supported");
          const decompressedBuffer = await new Response(stream).arrayBuffer();
          const decompressedText = new TextDecoder().decode(decompressedBuffer);

          if (!isCancelled) {
            setOutput(decompressedText);
            setStats(`${input.length} B → ${decompressedText.length} chars`);
            setError(null);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "GZip processing error (ensure valid Base64 GZip input)");
          setOutput("");
          setStats(null);
        }
      }
    }

    processGzip();

    return () => {
      isCancelled = true;
    };
  }, [input, mode]);

  const handleSwap = () => {
    setMode((prev) => (prev === "compress" ? "decompress" : "compress"));
    if (output) setInput(output);
  };

  const config = (
    <>
      <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setMode("compress")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "compress"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.compress}
        </button>
        <button
          onClick={() => setMode("decompress")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "decompress"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.decompress}
        </button>
      </div>

      <button
        onClick={handleSwap}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>{t.ui.switchInputOutput}</span>
      </button>

      {stats && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{stats}</span>}
    </>
  );

  return (
    <ToolLayout
      id="gzip-converter"
      title="GZip Compressor / Decompressor"
      description="Compress plain text into Base64 GZip payloads or decompress GZip data using Web Streams API"
      icon={FileArchive}
      categoryName="Encoders / Decoders"
      configuration={config}
      inputLabel={mode === "compress" ? "Plain Text Input" : "GZip Base64 Input"}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder={mode === "compress" ? "Paste text to compress into GZip..." : "Paste Base64 GZip string to decompress..."}
      outputLabel={mode === "compress" ? "Compressed GZip (Base64)" : "Decompressed Text"}
      outputValue={output}
      outputPlaceholder="Result will appear here..."
      error={error}
    />
  );
};
