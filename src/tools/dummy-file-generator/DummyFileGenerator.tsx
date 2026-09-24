import React, { useState, useMemo } from "react";
import {
  FileArchive,
  Download,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  FileType,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import {
  DummyFileFormat,
  DummyFillPattern,
  DummySizeUnit,
  SUPPORTED_FORMATS,
  DUMMY_FILE_PRESETS,
  convertToBytes,
  formatBytes,
  createDummyBlob,
  generateDummyBuffer,
} from "./dummyFileEngine";

export const DummyFileGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<DummyFileFormat>("pdf");
  const [filename, setFilename] = useState("sample_test_doc");
  const [sizeValue, setSizeValue] = useState<number>(2);
  const [sizeUnit, setSizeUnit] = useState<DummySizeUnit>("MB");
  const [pattern, setPattern] = useState<DummyFillPattern>("random");
  const [corruptHeader, setCorruptHeader] = useState<boolean>(false);
  const [downloading, setDownloading] = useState(false);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState(false);

  const formatMeta = SUPPORTED_FORMATS[format] || SUPPORTED_FORMATS.bin;
  const fullFilename = useMemo(() => {
    const cleanName = filename.trim() || "dummy_file";
    const ext = `.${formatMeta.defaultExt}`;
    return cleanName.endsWith(ext) ? cleanName : `${cleanName}${ext}`;
  }, [filename, formatMeta]);

  const totalBytes = useMemo(() => {
    return convertToBytes(sizeValue, sizeUnit);
  }, [sizeValue, sizeUnit]);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const isTauri =
        typeof window !== "undefined" &&
        ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

      // 1. Try Tauri Native Save Dialog
      if (isTauri) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { invoke } = await import("@tauri-apps/api/core");

          const selectedPath = await save({
            defaultPath: fullFilename,
            filters: [
              {
                name: formatMeta.name,
                extensions: [formatMeta.defaultExt],
              },
            ],
          });

          if (!selectedPath) {
            // User cancelled dialog
            setDownloading(false);
            return;
          }

          const buffer = generateDummyBuffer({
            filename: fullFilename,
            format,
            sizeBytes: totalBytes,
            pattern,
            corruptHeader,
          });

          await invoke("save_binary_file", {
            path: selectedPath,
            data: Array.from(buffer),
          });

          const savedFilename = selectedPath.split(/[/\\]/).pop() || fullFilename;
          setLastDownloaded(`${savedFilename} (${formatBytes(totalBytes)})`);
          setDownloading(false);
          return;
        } catch (tauriErr) {
          console.warn("Tauri native save dialog unavailable, falling back:", tauriErr);
        }
      }

      // 2. Try Modern Browser File System Access API (showSaveFilePicker)
      if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          const fileHandle = await (window as unknown as {
            showSaveFilePicker: (options: unknown) => Promise<{
              name: string;
              createWritable: () => Promise<{
                write: (data: unknown) => Promise<void>;
                close: () => Promise<void>;
              }>;
            }>;
          }).showSaveFilePicker({
            suggestedName: fullFilename,
            types: [
              {
                description: formatMeta.name,
                accept: {
                  [formatMeta.mime || "application/octet-stream"]: [`.${formatMeta.defaultExt}`],
                },
              },
            ],
          });

          const writable = await fileHandle.createWritable();
          const { blob } = createDummyBlob({
            filename: fullFilename,
            format,
            sizeBytes: totalBytes,
            pattern,
            corruptHeader,
          });

          await writable.write(blob);
          await writable.close();

          setLastDownloaded(`${fileHandle.name} (${formatBytes(totalBytes)})`);
          setDownloading(false);
          return;
        } catch (pickerErr: unknown) {
          if (pickerErr && typeof pickerErr === "object" && "name" in pickerErr && (pickerErr as { name: string }).name === "AbortError") {
            // User cancelled folder/file selection dialog
            setDownloading(false);
            return;
          }
          console.warn("showSaveFilePicker failed, falling back to anchor download", pickerErr);
        }
      }

      // 3. Fallback: Browser Anchor Download
      const { url } = createDummyBlob({
        filename: fullFilename,
        format,
        sizeBytes: totalBytes,
        pattern,
        corruptHeader,
      });

      const a = document.createElement("a");
      a.href = url;
      a.download = fullFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(url);
        setDownloading(false);
        setLastDownloaded(`${fullFilename} (${formatBytes(totalBytes)})`);
      }, 300);
    } catch (err) {
      setDownloading(false);
      console.error("Error generating or saving dummy file", err);
    }
  };

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(fullFilename);
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 1500);
  };

  const handleApplyPreset = (preset: typeof DUMMY_FILE_PRESETS[0]) => {
    setFormat(preset.format);
    setSizeValue(preset.sizeValue);
    setSizeUnit(preset.sizeUnit);
    setPattern(preset.pattern);
    setCorruptHeader(!!preset.corruptHeader);
    const baseName = preset.name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 20);
    setFilename(baseName || "test_file");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
            <FileArchive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {t.dummyFile.title}
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {t.dummyFile.qaBadge}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t.dummyFile.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Config Controls */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Main Config Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700/80">
              <HardDrive className="w-4 h-4 text-indigo-500" />
              {t.dummyFile.fileParameters}
            </h2>

            {/* Row 1: Filename & Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                  {t.dummyFile.fileName}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="e.g. sample_upload"
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-mono"
                  />
                  <span className="absolute right-3 text-xs text-slate-400 font-mono pointer-events-none">
                    .{formatMeta.defaultExt}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                  {t.dummyFile.fileFormat}
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as DummyFileFormat)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer transition-all"
                >
                  {Object.values(SUPPORTED_FORMATS).map((fmt) => (
                    <option key={fmt.format} value={fmt.format}>
                      {fmt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Target Size & Data Pattern */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target File Size */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1.5 h-4">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {t.dummyFile.targetFileSize}
                  </label>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                    {formatBytes(totalBytes)} ({totalBytes.toLocaleString()} B)
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      step={sizeUnit === "B" ? 1 : 0.01}
                      value={sizeValue}
                      onChange={(e) => setSizeValue(parseFloat(e.target.value) || 0)}
                      placeholder="Size value..."
                      className="w-full h-10 px-3.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-mono transition-all shadow-sm"
                    />
                  </div>

                  <div className="w-28 sm:w-32 shrink-0">
                    <select
                      value={sizeUnit}
                      onChange={(e) => setSizeUnit(e.target.value as DummySizeUnit)}
                      className="w-full h-10 px-3 text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-200 cursor-pointer shadow-sm transition-all"
                    >
                      <option value="B">Bytes (B)</option>
                      <option value="KB">KB (1024 B)</option>
                      <option value="MB">MB (1024 KB)</option>
                      <option value="GB">GB (1024 MB)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Size Shortcut Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mr-0.5">{t.dummyFile.quick}</span>
                  {[
                    { label: "0 B", val: 0, unit: "B" as const },
                    { label: "500 KB", val: 500, unit: "KB" as const },
                    { label: "1 MB", val: 1, unit: "MB" as const },
                    { label: "5 MB", val: 5, unit: "MB" as const },
                    { label: "10 MB", val: 10, unit: "MB" as const },
                    { label: "50 MB", val: 50, unit: "MB" as const },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setSizeValue(chip.val);
                        setSizeUnit(chip.unit);
                      }}
                      className={`px-2 py-0.5 text-[11px] rounded-md font-mono transition-all cursor-pointer border ${
                        sizeValue === chip.val && sizeUnit === chip.unit
                          ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Fill Pattern */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                  {t.dummyFile.dataFillPattern}
                </label>
                <select
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value as DummyFillPattern)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer transition-all shadow-sm"
                >
                  <option value="random">{t.dummyFile.patternRandom}</option>
                  <option value="zeros">{t.dummyFile.patternZeros}</option>
                  <option value="pattern">{t.dummyFile.patternRepeated}</option>
                  <option value="text">{t.dummyFile.patternText}</option>
                </select>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {pattern === "random" && t.dummyFile.patternDescRandom}
                  {pattern === "zeros" && t.dummyFile.patternDescZeros}
                  {pattern === "pattern" && t.dummyFile.patternDescRepeated}
                  {pattern === "text" && t.dummyFile.patternDescText}
                </div>
              </div>
            </div>

            {/* Row 3: Security & Corrupt Header Simulation Toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80">
              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100/70 dark:hover:bg-slate-900 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {t.dummyFile.corruptHeader}
                      {corruptHeader && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {t.dummyFile.corruptHeaderActive}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.dummyFile.corruptHeaderDesc}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={corruptHeader}
                  onChange={(e) => setCorruptHeader(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer ml-3"
                />
              </label>
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {t.dummyFile.testerQuickPresets}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DUMMY_FILE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="flex flex-col text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {preset.name}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      .{preset.format}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Inspector & Action */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* File Inspector Preview Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700/80">
              <FileType className="w-4 h-4 text-indigo-500" />
              {t.dummyFile.fileInspection}
            </h2>

            {/* Target Filename with Copy button */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                  {t.dummyFile.outputFilename}
                </div>
                <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                  {fullFilename}
                </div>
              </div>
              <button
                onClick={handleCopyFilename}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
                title="Copy filename"
              >
                {copiedName ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between h-20">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                  {t.dummyFile.calculatedSize}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                    {formatBytes(totalBytes)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {totalBytes.toLocaleString()} Bytes
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between h-20">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                  {t.dummyFile.mimeFormat}
                </div>
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate" title={formatMeta.mime}>
                    {formatMeta.mime}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    .{formatMeta.defaultExt}
                  </div>
                </div>
              </div>
            </div>

            {/* Header Signature Status */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                {t.dummyFile.magicSignature}
              </div>
              {corruptHeader ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {t.dummyFile.corruptedDetected}
                </div>
              ) : formatMeta.magicBytes ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {t.dummyFile.validMagicHeader.replace("{format}", format.toUpperCase()).replace("{count}", String(formatMeta.magicBytes.length))}
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t.dummyFile.plainTextGeneric}
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-md hover:shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? t.dummyFile.generating : t.dummyFile.downloadFile.replace("{filename}", fullFilename)}</span>
            </button>

            {lastDownloaded && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="truncate">{t.dummyFile.downloadSuccess} <strong>{lastDownloaded}</strong></span>
              </div>
            )}
          </div>

          {/* Tester Tip Callout */}
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-800 dark:text-blue-300 space-y-2">
            <div className="font-semibold flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
              {t.dummyFile.qaTipsTitle}
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>{t.dummyFile.qaTip1}</li>
              <li>{t.dummyFile.qaTip2}</li>
              <li>{t.dummyFile.qaTip3}</li>
              <li>{t.dummyFile.qaTip4}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
