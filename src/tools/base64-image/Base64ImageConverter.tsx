import React, { useState, useRef } from "react";
import { Image as ImageIcon, Upload, Download, Copy, Check } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const Base64ImageConverter: React.FC = () => {
  const { t } = useTranslation();
  const [base64String, setBase64String] = useState("");
  const [fileName, setFileName] = useState("image.png");
  const [imageStats, setImageStats] = useState<{ width: number; height: number; size: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, SVG, WebP, GIF)");
      return;
    }

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setBase64String(result);

      const img = new Image();
      img.onload = () => {
        setImageStats({
          width: img.width,
          height: img.height,
          size: `${(file.size / 1024).toFixed(2)} KB`,
        });
      };
      img.src = result;
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsDataURL(file);
  };

  const handleTextChange = (text: string) => {
    setBase64String(text);
    if (!text.trim()) {
      setImageStats(null);
      setError(null);
      return;
    }

    const dataUri = text.startsWith("data:image/") ? text : `data:image/png;base64,${text}`;
    const img = new Image();
    img.onload = () => {
      setImageStats({
        width: img.width,
        height: img.height,
        size: `${((text.length * 0.75) / 1024).toFixed(2)} KB (approx)`,
      });
      setError(null);
    };
    img.onerror = () => {
      setError("Invalid Base64 image data");
      setImageStats(null);
    };
    img.src = dataUri;
  };

  const handleDownload = () => {
    if (!base64String) return;
    const a = document.createElement("a");
    a.href = base64String.startsWith("data:image/") ? base64String : `data:image/png;base64,${base64String}`;
    a.download = fileName || "downloaded-image.png";
    a.click();
  };

  const handleCopy = () => {
    if (!base64String) return;
    navigator.clipboard.writeText(base64String);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolLayout
      id="base64-image-converter"
      title="Base64 Image Converter"
      description="Convert image files to Base64 Data URI strings or preview Base64 encoded images"
      icon={ImageIcon}
      categoryName="Encoders / Decoders"
      error={error}
      customPanes={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[440px]">
          {/* Left: File dropzone & Preview */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.preview}</span>
              {imageStats && (
                <span className="text-[11px] text-slate-400">
                  {imageStats.width}x{imageStats.height} px • {imageStats.size}
                </span>
              )}
            </div>

            <div className="p-4 flex-1 flex flex-col justify-center items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                }}
                className="w-full max-w-sm p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center">
                  {t.ui.dragDropImage}
                </span>
                <span className="text-[11px] text-slate-400">PNG, JPG, SVG, WebP, GIF</span>
              </div>

              {base64String && (
                <div className="space-y-3 w-full flex flex-col items-center">
                  <div className="max-h-56 max-w-full rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-slate-100 dark:bg-slate-950/80 flex items-center justify-center overflow-hidden">
                    <img
                      src={base64String.startsWith("data:") ? base64String : `data:image/png;base64,${base64String}`}
                      alt="Preview"
                      className="max-h-48 max-w-full object-contain rounded"
                    />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.ui.download}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Base64 String Editor */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Base64 Data URI</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!base64String}
                  className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 disabled:opacity-40"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 text-[11px]">{t.common.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{t.common.copy}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setBase64String("");
                    setImageStats(null);
                  }}
                  disabled={!base64String}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
                >
                  {t.common.clear}
                </button>
              </div>
            </div>
            <textarea
              value={base64String}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="data:image/png;base64,iVBORw0..."
              spellCheck={false}
              className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>
        </div>
      }
    />
  );
};
