import React, { useState, useEffect } from "react";
import { Table, Download } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const JsonCsvConverter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState<string>(
    JSON.stringify(
      [
        { id: 1, name: "Alice", role: "Developer", city: "Tokyo" },
        { id: 2, name: "Bob", role: "Designer", city: "Hanoi" },
        { id: 3, name: "Charlie", role: "Product Manager", city: "London" },
      ],
      null,
      2,
    ),
  );
  const [delimiter, setDelimiter] = useState<string>(",");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const escapeCell = (cell: unknown): string => {
    if (cell === null || cell === undefined) return "";
    const str = String(cell);
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(input);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON root must be an array of objects: [ {...}, {...} ]");
      }

      if (parsed.length === 0) {
        setOutput("");
        setError(null);
        return;
      }

      // Collect all unique keys
      const headers = Array.from(
        new Set(
          parsed.flatMap((item) => (typeof item === "object" && item !== null ? Object.keys(item) : [])),
        ),
      );

      const headerRow = headers.map(escapeCell).join(delimiter);
      const rows = parsed.map((item) => {
        if (typeof item !== "object" || item === null) return "";
        return headers.map((h) => escapeCell((item as Record<string, unknown>)[h])).join(delimiter);
      });

      setOutput([headerRow, ...rows].join("\n"));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse JSON");
      setOutput("");
    }
  }, [input, delimiter]);

  const handleFormat = () => {
    if (!input.trim()) return false;
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setError(null);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse JSON");
      return false;
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="csv-delim" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.delimiter}:
        </label>
        <select
          id="csv-delim"
          value={delimiter}
          onChange={(e) => setDelimiter(e.target.value)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value=",">{t.ui.comma}</option>
          <option value=";">{t.ui.semicolon}</option>
          <option value="&#9;">{t.ui.tab}</option>
          <option value="|">Pipe (|)</option>
        </select>
      </div>

      <button
        onClick={handleDownload}
        disabled={!output}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t.ui.download} CSV</span>
      </button>
    </>
  );

  return (
    <ToolLayout
      id="json-to-csv"
      title="JSON to Table / CSV Converter"
      description="Convert JSON array of objects to tabular Delimited/CSV format"
      icon={Table}
      categoryName="Converters"
      configuration={config}
      inputLabel="JSON Array Input"
      inputValue={input}
      onInputChange={setInput}
      onFormatInput={handleFormat}
      inputPlaceholder="[ { ... }, { ... } ]"
      outputLabel="CSV Output"
      outputValue={output}
      outputPlaceholder="CSV output will appear here..."
      error={error}
    />
  );
};
