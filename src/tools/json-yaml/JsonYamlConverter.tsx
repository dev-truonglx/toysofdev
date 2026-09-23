import React, { useState, useEffect } from "react";
import { ArrowLeftRight, FileCode2 } from "lucide-react";
import YAML from "yaml";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type ConversionMode = "json-to-yaml" | "yaml-to-json";

export const JsonYamlConverter: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ConversionMode>("json-to-yaml");
  const [indent, setIndent] = useState<number>(2);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      if (mode === "json-to-yaml") {
        const parsed = JSON.parse(input);
        const yamlString = YAML.stringify(parsed, { indent });
        setOutput(yamlString);
        setError(null);
      } else {
        const parsed = YAML.parse(input);
        const jsonString = JSON.stringify(parsed, null, indent);
        setOutput(jsonString);
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion error");
      setOutput("");
    }
  }, [input, mode, indent]);

  const handleFormat = () => {
    if (!input.trim()) return false;
    try {
      if (mode === "json-to-yaml") {
        const parsed = JSON.parse(input);
        setInput(JSON.stringify(parsed, null, indent));
      } else {
        const parsed = YAML.parse(input);
        setInput(YAML.stringify(parsed, { indent }));
      }
      setError(null);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Formatting error");
      return false;
    }
  };

  const handleSwap = () => {
    setMode((prev) => (prev === "json-to-yaml" ? "yaml-to-json" : "json-to-yaml"));
    if (output) {
      setInput(output);
    }
  };

  const config = (
    <>
      <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setMode("json-to-yaml")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "json-to-yaml"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          JSON → YAML
        </button>
        <button
          onClick={() => setMode("yaml-to-json")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "yaml-to-json"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          YAML → JSON
        </button>
      </div>

      <button
        onClick={handleSwap}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>{t.ui.switchInputOutput}</span>
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor="jy-indent" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.indentation}:
        </label>
        <select
          id="jy-indent"
          value={indent}
          onChange={(e) => setIndent(Number(e.target.value))}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="2">{t.ui.spaces2}</option>
          <option value="4">{t.ui.spaces4}</option>
        </select>
      </div>
    </>
  );

  return (
    <ToolLayout
      id="json-yaml-converter"
      title="JSON ↔ YAML Converter"
      description="Convert JSON data to YAML, or YAML data to JSON"
      icon={FileCode2}
      categoryName="Converters"
      configuration={config}
      inputLabel={mode === "json-to-yaml" ? "JSON Input" : "YAML Input"}
      inputValue={input}
      onInputChange={setInput}
      onFormatInput={handleFormat}
      inputPlaceholder={mode === "json-to-yaml" ? '{\n  "key": "value"\n}' : "key: value"}
      outputLabel={mode === "json-to-yaml" ? "YAML Output" : "JSON Output"}
      outputValue={output}
      outputPlaceholder="Result will appear here..."
      error={error}
    />
  );
};
