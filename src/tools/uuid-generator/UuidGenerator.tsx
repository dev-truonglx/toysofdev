import React, { useState, useEffect, useCallback } from "react";
import { Fingerprint, RefreshCw } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const UuidGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [hyphens, setHyphens] = useState(true);
  const [uppercase, setUppercase] = useState(false);
  const [braces, setBraces] = useState(false);
  const [count, setCount] = useState(1);
  const [output, setOutput] = useState("");

  const generateUuidString = useCallback(() => {
    let id: string = crypto.randomUUID();
    if (!hyphens) {
      id = id.replace(/-/g, "");
    }
    if (uppercase) {
      id = id.toUpperCase();
    }
    if (braces) {
      id = `{${id}}`;
    }
    return id;
  }, [hyphens, uppercase, braces]);

  const generateUuids = useCallback(() => {
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.push(generateUuidString());
    }
    setOutput(list.join("\n"));
  }, [count, generateUuidString]);

  useEffect(() => {
    generateUuids();
  }, [generateUuids]);

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="uuid-count" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.count}:
        </label>
        <select
          id="uuid-count"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="1">1 UUID</option>
          <option value="5">5 UUIDs</option>
          <option value="10">10 UUIDs</option>
          <option value="25">25 UUIDs</option>
          <option value="50">50 UUIDs</option>
          <option value="100">100 UUIDs</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={hyphens}
          onChange={(e) => setHyphens(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>{t.ui.hyphens}</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={uppercase}
          onChange={(e) => setUppercase(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>{t.ui.uppercase}</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={braces}
          onChange={(e) => setBraces(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>&#123; &#125;</span>
      </label>
    </>
  );

  const actionsRight = (
    <button
      onClick={generateUuids}
      className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all"
    >
      <RefreshCw className="w-4 h-4" />
      <span>{t.ui.generate} UUID</span>
    </button>
  );

  return (
    <ToolLayout
      id="uuid-generator"
      title="UUID / GUID Generator"
      description="Generate cryptographically strong Universally Unique Identifiers (v4) using Web Crypto"
      icon={Fingerprint}
      categoryName="Generators"
      configuration={config}
      outputValue={output}
      actionsRight={actionsRight}
    />
  );
};
