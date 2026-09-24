import React, { useState, useEffect } from "react";
import { Code2, Sparkles } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import { generateCodeFromJson, TargetLanguage } from "./jsonToCodeEngine";

const SAMPLE_JSON = JSON.stringify(
  {
    id: 101,
    name: "John Doe",
    email: "john.doe@example.com",
    isActive: true,
    roles: ["admin", "developer"],
    profile: {
      avatarUrl: "https://example.com/avatar.png",
      age: 28,
      location: "San Francisco, CA",
    },
    settings: {
      notifications: true,
      theme: "dark",
    },
  },
  null,
  2
);

export const JsonToCodeConverter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState(SAMPLE_JSON);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<TargetLanguage>("typescript-interface");
  const [rootName, setRootName] = useState("UserProfile");
  const [optionalFields, setOptionalFields] = useState(false);
  const [separateNested, setSeparateNested] = useState(true);

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      const code = generateCodeFromJson(input, {
        rootName: rootName || "Root",
        language,
        optionalFields,
        separateNested,
      });
      setOutput(code);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate code from JSON");
      setOutput("");
    }
  }, [input, language, rootName, optionalFields, separateNested]);

  const handleFormat = () => {
    if (!input.trim()) return false;
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setError(null);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      return false;
    }
  };

  const handleLoadSample = () => {
    setInput(SAMPLE_JSON);
  };

  const config = (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <label className="text-slate-600 dark:text-slate-400 font-medium">{t.jsonToCode.targetLanguage}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as TargetLanguage)}
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-sm"
        >
          <option value="typescript-interface">TypeScript (Interface)</option>
          <option value="typescript-type">TypeScript (Type)</option>
          <option value="golang">Go (Golang Struct)</option>
          <option value="python-pydantic">Python (Pydantic BaseModel)</option>
          <option value="python-dataclass">Python (Dataclass)</option>
          <option value="rust-serde">Rust (Serde Struct)</option>
          <option value="java-record">Java (Record)</option>
          <option value="csharp-record">C# (Record)</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-slate-600 dark:text-slate-400 font-medium">{t.jsonToCode.rootName}</label>
        <input
          type="text"
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
          placeholder="Root"
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
        />
      </div>

      <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={optionalFields}
          onChange={(e) => setOptionalFields(e.target.checked)}
          className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
        />
        <span>{t.jsonToCode.optionalFields}</span>
      </label>

      {language.startsWith("typescript") && (
        <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={separateNested}
            onChange={(e) => setSeparateNested(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
          />
          <span>{t.jsonToCode.separateNested}</span>
        </label>
      )}

      <button
        onClick={handleLoadSample}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ml-auto cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>{t.ui.sample}</span>
      </button>
    </div>
  );

  return (
    <ToolLayout
      id="json-to-code"
      title={t.tools["json-to-code"]?.title || "JSON to Code / Types Converter"}
      description={t.tools["json-to-code"]?.description || "Generate TypeScript, Go Structs, Python Pydantic, Rust Serde, Java and C# models directly from JSON"}
      icon={Code2}
      categoryName="Converters"
      configuration={config}
      inputLabel={t.jsonToCode.jsonInput}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder="Paste raw JSON object or array here..."
      outputLabel={t.jsonToCode.generatedCode.replace("{language}", language)}
      outputValue={output}
      outputPlaceholder="Generated typed code will appear here..."
      error={error}
      onFormatInput={handleFormat}
    />
  );
};
