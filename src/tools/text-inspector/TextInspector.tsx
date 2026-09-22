import React, { useState } from "react";
import { CaseSensitive, Copy, Check } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const TextInspector: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("Hello World! This is Toys of Dev developer tools.");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Statistics
  const chars = input.length;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const lines = input ? input.split("\n").length : 0;
  const bytes = new TextEncoder().encode(input).length;

  const toWords = (str: string) => {
    return str
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_\-]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  };

  const casingTransforms = [
    {
      key: "lower",
      label: "lower case",
      val: input.toLowerCase(),
    },
    {
      key: "upper",
      label: "UPPER CASE",
      val: input.toUpperCase(),
    },
    {
      key: "title",
      label: "Title Case",
      val: toWords(input)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" "),
    },
    {
      key: "camel",
      label: "camelCase",
      val: toWords(input)
        .map((w, i) =>
          i === 0
            ? w.toLowerCase()
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join(""),
    },
    {
      key: "pascal",
      label: "PascalCase",
      val: toWords(input)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(""),
    },
    {
      key: "snake",
      label: "snake_case",
      val: toWords(input).map((w) => w.toLowerCase()).join("_"),
    },
    {
      key: "constant",
      label: "CONSTANT_CASE",
      val: toWords(input).map((w) => w.toUpperCase()).join("_"),
    },
    {
      key: "kebab",
      label: "kebab-case",
      val: toWords(input).map((w) => w.toLowerCase()).join("-"),
    },
  ];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <ToolLayout
      id="text-case-converter"
      title="Text Case Converter & Inspector"
      description="Analyze text statistics and convert strings between camelCase, snake_case, PascalCase, and more"
      icon={CaseSensitive}
      categoryName="Text Utilities"
      customPanes={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[440px]">
          {/* Left: Input Textarea */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.inputText}</span>
              <button
                onClick={() => setInput("")}
                disabled={!input}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
              >
                {t.common.clear}
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.ui.typeOrPasteText}
              spellCheck={false}
              className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
            {/* Stats Bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{t.common.characters}</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{chars}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{t.ui.words}</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{words}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{t.common.lines}</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{lines}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{t.ui.bytes}</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{bytes}</div>
              </div>
            </div>
          </div>

          {/* Right: Casing Cards */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.ui.caseTransformations}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {casingTransforms.map((c) => (
                <div
                  key={c.key}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">{c.label}</div>
                    <div className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate mt-0.5 select-all">
                      {c.val || <span className="italic text-slate-400 text-[11px]">{t.ui.empty}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(c.val, c.key)}
                    disabled={!c.val}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0 disabled:opacity-40"
                  >
                    {copiedKey === c.key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
};
