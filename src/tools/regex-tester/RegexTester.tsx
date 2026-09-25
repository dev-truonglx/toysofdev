import React, { useState, useMemo, useEffect } from "react";
import { Regex, Copy, Check } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

interface MatchItem {
  index: number;
  match: string;
  groups: string[];
  namedGroups?: Record<string, string>;
}

export const RegexTester: React.FC = () => {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState(
    "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
  );
  const [flagGlobal, setFlagGlobal] = useState(true);
  const [flagIgnoreCase, setFlagIgnoreCase] = useState(true);
  const [flagMultiline, setFlagMultiline] = useState(false);
  const [flagDotAll, setFlagDotAll] = useState(false);

  const [text, setText] = useState(
    "Contact us at support@example.com or sales-team@devtoys.app for queries. Invalid: test@.com",
  );

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Debounced pattern & text to avoid freezing UI while typing
  const [debouncedPattern, setDebouncedPattern] = useState(pattern);
  const [debouncedText, setDebouncedText] = useState(text);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPattern(pattern);
      setDebouncedText(text);
    }, 100);
    return () => clearTimeout(timer);
  }, [pattern, text]);

  const presets = [
    { label: "Email Address", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
    {
      label: "URL",
      pattern:
        "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)",
    },
    {
      label: "IPv4 Address",
      pattern:
        "\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b",
    },
    { label: "HEX Color", pattern: "#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})" },
    {
      label: "UUID",
      pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
    },
  ];

  const { matches, error }: { matches: MatchItem[]; error: string | null } = useMemo(() => {
    const list: MatchItem[] = [];
    if (!debouncedPattern) return { matches: list, error: null };

    const startTime = performance.now();

    try {
      let flags = "";
      if (flagGlobal) flags += "g";
      if (flagIgnoreCase) flags += "i";
      if (flagMultiline) flags += "m";
      if (flagDotAll) flags += "s";

      const reg = new RegExp(debouncedPattern, flags);
      if (flagGlobal) {
        let m: RegExpExecArray | null;
        let count = 0;
        while ((m = reg.exec(debouncedText)) !== null && count < 500) {
          // ReDoS protection: stop if regex takes > 250ms
          if (performance.now() - startTime > 250) {
            throw new Error(
              "Regex execution timeout (> 250ms). The expression may be too complex or causing catastrophic backtracking (ReDoS).",
            );
          }

          list.push({
            index: m.index,
            match: m[0],
            groups: m.slice(1),
            namedGroups: m.groups ? { ...m.groups } : undefined,
          });
          count++;

          // Safe handling for zero-length matches (e.g. ^, \b, a*)
          if (m[0].length === 0) {
            if (reg.lastIndex >= debouncedText.length) break;
            reg.lastIndex++;
          }
        }
      } else {
        const m = reg.exec(debouncedText);
        if (m) {
          list.push({
            index: m.index,
            match: m[0],
            groups: m.slice(1),
            namedGroups: m.groups ? { ...m.groups } : undefined,
          });
        }
      }
      return { matches: list, error: null };
    } catch (err: unknown) {
      return {
        matches: list,
        error: err instanceof Error ? err.message : "Invalid Regex pattern",
      };
    }
  }, [debouncedPattern, debouncedText, flagGlobal, flagIgnoreCase, flagMultiline, flagDotAll]);

  const copyMatch = (val: string, idx: number) => {
    navigator.clipboard.writeText(val);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const config = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={flagGlobal}
            onChange={(e) => setFlagGlobal(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-mono font-bold">g (Global)</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={flagIgnoreCase}
            onChange={(e) => setFlagIgnoreCase(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-mono font-bold">i (Ignore Case)</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={flagMultiline}
            onChange={(e) => setFlagMultiline(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-mono font-bold">m (Multiline)</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={flagDotAll}
            onChange={(e) => setFlagDotAll(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-mono font-bold">s (DotAll)</span>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400">{t.ui.presets}</span>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setPattern(p.pattern)}
            className="px-2 py-0.5 text-[11px] rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <ToolLayout
      id="regex-tester"
      title={t.tools["regex-tester"]?.title || "Regular Expression (Regex) Tester"}
      description={
        t.tools["regex-tester"]?.description ||
        "Test, debug and validate regular expressions against text in real-time"
      }
      icon={Regex}
      categoryName="graphic"
      configuration={config}
      error={error}
      customPanes={
        <div className="flex flex-col gap-4 flex-1 min-h-[500px]">
          {/* Regex Pattern Input */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <span className="font-mono font-bold text-slate-400 text-base">/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t.ui.enterRegexPlaceholder}
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-xs font-semibold focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <span className="font-mono font-bold text-slate-400 text-base">/</span>
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
              {flagGlobal ? "g" : ""}
              {flagIgnoreCase ? "i" : ""}
              {flagMultiline ? "m" : ""}
              {flagDotAll ? "s" : ""}
            </span>
          </div>

          {/* Test Text and Matches Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
            {/* Input Text */}
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.ui.testText}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.ui.enterRegexSampleText}
                spellCheck={false}
                className="flex-1 w-full p-3 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Match Results */}
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>{t.ui.matchResults}</span>
                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                  {matches.length} matches found
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
                {matches.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-sans italic">
                    {t.ui.noMatchesFound}
                  </div>
                ) : (
                  matches.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          Match #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Index: {m.index}</span>
                          <button
                            onClick={() => copyMatch(m.match, idx)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            title="Copy match"
                          >
                            {copiedIdx === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold break-all">
                        {m.match}
                      </div>
                      {m.groups.length > 0 && (
                        <div className="pt-0.5 text-[11px] text-slate-500">
                          Groups: {m.groups.map((g, gIdx) => `$${gIdx + 1}: "${g}"`).join(", ")}
                        </div>
                      )}
                      {m.namedGroups && Object.keys(m.namedGroups).length > 0 && (
                        <div className="pt-0.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          Named:{" "}
                          {Object.entries(m.namedGroups)
                            .map(([k, v]) => `${k}: "${v}"`)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
};
