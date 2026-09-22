import React, { useState, useEffect } from "react";
import { FileCode, ArrowDownUp } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type IndentMode = "2" | "4" | "tab" | "minified";

export const JsonFormatter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<IndentMode>("2");
  const [sortProperties, setSortProperties] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }
    if (obj !== null && typeof obj === "object") {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .reduce((acc: Record<string, unknown>, key: string) => {
          acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return obj;
  };

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      let parsed = JSON.parse(input);
      if (sortProperties) {
        parsed = sortKeys(parsed);
      }

      let formatted = "";
      if (indent === "minified") {
        formatted = JSON.stringify(parsed);
      } else if (indent === "tab") {
        formatted = JSON.stringify(parsed, null, "\t");
      } else {
        formatted = JSON.stringify(parsed, null, parseInt(indent, 10));
      }

      setOutput(formatted);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${t.ui.invalid} JSON`);
      setOutput("");
    }
  }, [input, indent, sortProperties, t]);

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="json-indent" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.indentation}:
        </label>
        <select
          id="json-indent"
          value={indent}
          onChange={(e) => setIndent(e.target.value as IndentMode)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="2">{t.ui.spaces2}</option>
          <option value="4">{t.ui.spaces4}</option>
          <option value="tab">{t.ui.tab1}</option>
          <option value="minified">{t.ui.minified0}</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={sortProperties}
          onChange={(e) => setSortProperties(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span className="flex items-center gap-1">
          <ArrowDownUp className="w-3.5 h-3.5" /> {t.ui.sortKeys}
        </span>
      </label>
    </>
  );

  return (
    <ToolLayout
      id="json-formatter"
      title="JSON Formatter & Minifier"
      description="Indent, prettify or minify JSON data, with optional key sorting"
      icon={FileCode}
      categoryName="Formatters"
      configuration={config}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder="Paste raw JSON here..."
      outputValue={output}
      error={error}
    />
  );
};
