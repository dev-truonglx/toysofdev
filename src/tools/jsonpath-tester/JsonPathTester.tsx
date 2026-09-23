import React, { useState, useEffect } from "react";
import { SearchCode, Code2, Check, Copy, Clipboard, Trash2 } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const JsonPathTester: React.FC = () => {
  const { t } = useTranslation();
  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(
      {
        store: {
          book: [
            { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
            { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
            { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
            { category: "fiction", author: "J. R. R. Tolkien", title: "The Lord of the Rings", isbn: "0-395-19395-8", price: 22.99 },
          ],
          bicycle: { color: "red", price: 19.95 },
        },
      },
      null,
      2,
    ),
  );

  const [pathQuery, setPathQuery] = useState("$.store.book[*].title");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isFormatted, setIsFormatted] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);

  // Self-contained JSONPath query engine
  const evaluateJsonPath = (obj: unknown, query: string): unknown => {
    let clean = query.trim();
    if (clean.startsWith("$")) {
      clean = clean.substring(1);
    }
    if (clean.startsWith(".")) {
      clean = clean.substring(1);
    }

    if (!clean) return obj;

    // Handle simple recursive descent: ..property
    if (clean.startsWith(".")) {
      const targetKey = clean.substring(1);
      const results: unknown[] = [];
      const traverse = (node: unknown) => {
        if (node && typeof node === "object") {
          if (targetKey in (node as Record<string, unknown>)) {
            results.push((node as Record<string, unknown>)[targetKey]);
          }
          Object.values(node as Record<string, unknown>).forEach(traverse);
        }
      };
      traverse(obj);
      return results;
    }

    const tokens = clean.split(/\.(?![^[]*\])/);
    let current: unknown[] = [obj];

    for (const token of tokens) {
      const next: unknown[] = [];

      for (const item of current) {
        if (!item || typeof item !== "object") continue;

        // Array index or wildcard: e.g. book[*] or book[0]
        const arrayMatch = token.match(/^([^[]+)\[(.*?)\]$/);

        if (arrayMatch) {
          const propName = arrayMatch[1];
          const indexExpr = arrayMatch[2];
          const subObj = (item as Record<string, unknown>)[propName];

          if (Array.isArray(subObj)) {
            if (indexExpr === "*") {
              next.push(...subObj);
            } else if (/^\d+$/.test(indexExpr)) {
              const idx = parseInt(indexExpr, 10);
              if (idx < subObj.length) next.push(subObj[idx]);
            } else if (indexExpr.startsWith("?(@.")) {
              // Simple filter: ?(@.price > 10) or ?(@.category == 'fiction')
              const filterMatch = indexExpr.match(/\?\( *?@\.(\w+) *?([!=><]+) *?['"]?([^'"]+)['"]? *?\)/);
              if (filterMatch) {
                const [, field, op, target] = filterMatch;
                const filtered = subObj.filter((elem) => {
                  if (!elem || typeof elem !== "object") return false;
                  const val = String((elem as Record<string, unknown>)[field]);
                  if (op === "==" || op === "=") return val === target;
                  if (op === "!=") return val !== target;
                  if (op === ">") return Number(val) > Number(target);
                  if (op === "<") return Number(val) < Number(target);
                  return false;
                });
                next.push(...filtered);
              }
            }
          }
        } else if (token === "*") {
          next.push(...Object.values(item as Record<string, unknown>));
        } else {
          const val = (item as Record<string, unknown>)[token];
          if (val !== undefined) {
            next.push(val);
          }
        }
      }

      current = next;
    }

    return current.length === 1 ? current[0] : current;
  };

  useEffect(() => {
    if (!jsonInput.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const result = evaluateJsonPath(parsed, pathQuery);
      setOutput(JSON.stringify(result, null, 2));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.ui.invalidJsonOrJsonPath);
      setOutput("");
    }
  }, [jsonInput, pathQuery, t]);

  const handleFormat = () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setError(null);
      setIsFormatted(true);
      setTimeout(() => setIsFormatted(false), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.ui.invalidJsonOrJsonPath);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonInput(text);
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  const handleClear = () => {
    setJsonInput("");
    setOutput("");
    setError(null);
  };

  const handleCopyResult = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 1500);
    } catch (err) {
      console.error("Failed to copy result:", err);
    }
  };

  const presets = [
    "$.store.book[*].title",
    "$.store.book[*].author",
    "$.store.book[0]",
    "$.store.book[?(@.category == 'fiction')]",
    "$.store.bicycle.color",
  ];

  const config = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">{t.ui.sampleQueries}</span>
      {presets.map((p) => (
        <button
          key={p}
          onClick={() => setPathQuery(p)}
          className="px-2 py-0.5 text-[11px] rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors font-mono"
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <ToolLayout
      id="jsonpath-tester"
      title="JSONPath Tester"
      description="Query, filter, and extract sub-trees from complex JSON data using JSONPath syntax"
      icon={SearchCode}
      categoryName="Graphic & Testing"
      configuration={config}
      error={error}
      customPanes={
        <div className="flex flex-col gap-4 flex-1 min-h-[500px]">
          {/* Query Bar */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="text-xs font-semibold uppercase text-slate-400">JSONPath:</span>
            <input
              type="text"
              value={pathQuery}
              onChange={(e) => setPathQuery(e.target.value)}
              placeholder="e.g. $.store.book[*].author"
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-xs font-bold focus:outline-none text-indigo-600 dark:text-indigo-400"
            />
          </div>

          {/* Dual Panes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
            {/* Source JSON */}
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.sourceJson}</span>
                  {jsonInput && (
                    <span className="text-[11px] text-slate-400 font-mono font-normal">
                      ({jsonInput.length} {t.common.characters})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFormat}
                    disabled={!jsonInput.trim()}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      isFormatted
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                    title={t.ui.format}
                  >
                    {isFormatted ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t.ui.formatted}</span>
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5" />
                        <span>{t.ui.format}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    title={t.common.paste}
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!jsonInput}
                    className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t.common.clear}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={t.ui.pasteJsonHere}
                spellCheck={false}
                className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* JSONPath Result */}
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.jsonPathResult}</span>
                  {output && (
                    <span className="text-[11px] text-slate-400 font-mono font-normal">
                      ({output.length} {t.common.characters})
                    </span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    disabled={!output}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
                      copiedResult
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                    title={t.common.copy}
                  >
                    {copiedResult ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-medium text-[11px]">{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <textarea
                value={output}
                readOnly
                placeholder={t.ui.evaluationResultPlaceholder}
                spellCheck={false}
                className="flex-1 w-full p-4 resize-none bg-slate-50/40 dark:bg-slate-950/40 font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        </div>
      }
    />
  );
};
