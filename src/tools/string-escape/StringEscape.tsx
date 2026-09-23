import React, { useState, useEffect } from "react";
import { Quote, ArrowLeftRight } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type Mode = "escape" | "unescape";
type Preset = "json" | "csharp" | "python" | "sql";

export const StringEscape: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("escape");
  const [preset, setPreset] = useState<Preset>("json");
  const [input, setInput] = useState('Hello "World"!\nLine 2\tTabbed');
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      if (mode === "escape") {
        if (preset === "sql") {
          setOutput(input.replace(/'/g, "''"));
        } else {
          // json / csharp / python standard escape
          const escaped = JSON.stringify(input);
          // JSON.stringify adds outer quotes, strip them for raw escaped output
          setOutput(escaped.slice(1, -1));
        }
        setError(null);
      } else {
        if (preset === "sql") {
          setOutput(input.replace(/''/g, "'"));
        } else {
          try {
            const unescaped = JSON.parse(`"${input}"`);
            setOutput(unescaped);
            setError(null);
          } catch {
            setOutput(
              input
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\n/g, "\n")
                .replace(/\\r/g, "\r")
                .replace(/\\t/g, "\t")
                .replace(/\\\\/g, "\\")
            );
            setError(null);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "String escape error");
      setOutput("");
    }
  }, [input, mode, preset]);

  const handleSwap = () => {
    setMode((prev) => (prev === "escape" ? "unescape" : "escape"));
    if (output) setInput(output);
  };

  const config = (
    <>
      <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setMode("escape")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "escape"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.escape}
        </button>
        <button
          onClick={() => setMode("unescape")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "unescape"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.unescape}
        </button>
      </div>

      <button
        onClick={handleSwap}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>{t.ui.switchInputOutput}</span>
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor="escape-preset" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.dialect}:
        </label>
        <select
          id="escape-preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="json">JavaScript / JSON</option>
          <option value="csharp">C# / Java</option>
          <option value="python">Python</option>
          <option value="sql">SQL String</option>
        </select>
      </div>
    </>
  );

  return (
    <ToolLayout
      id="string-escape"
      title="String Escape / Unescape"
      description="Escape or unescape special characters like quotes, tabs, and newlines for different programming languages"
      icon={Quote}
      categoryName="Text Utilities"
      configuration={config}
      inputLabel={mode === "escape" ? "Plain Text" : "Escaped String"}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder={mode === "escape" ? 'Hello "World"\nLine 2' : 'Hello \\"World\\"\\nLine 2'}
      outputLabel={mode === "escape" ? "Escaped Output" : "Unescaped Text"}
      outputValue={output}
      error={error}
    />
  );
};
