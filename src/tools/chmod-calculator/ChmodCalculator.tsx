import React, { useState } from "react";
import { Lock, Copy, Check, Terminal, Shield, CheckCircle2 } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import {
  ChmodState,
  DEFAULT_CHMOD_STATE,
  getOctalString,
  getSymbolicString,
  parseOctalToState,
  parseSymbolicToState,
  getChmodCommands,
  describePermissions,
  CHMOD_PRESETS,
  tripletToOctal,
} from "./chmodEngine";

export const ChmodCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<ChmodState>(DEFAULT_CHMOD_STATE);
  const [targetName, setTargetName] = useState("app.sh");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [octalInput, setOctalInput] = useState(getOctalString(DEFAULT_CHMOD_STATE));
  const [symbolicInput, setSymbolicInput] = useState(getSymbolicString(DEFAULT_CHMOD_STATE));
  const [error, setError] = useState<string | null>(null);

  const syncState = (newState: ChmodState) => {
    setState(newState);
    setOctalInput(getOctalString(newState));
    setSymbolicInput(getSymbolicString(newState));
    setError(null);
  };

  const handleCheckboxChange = (
    category: "owner" | "group" | "others",
    perm: "read" | "write" | "execute",
    checked: boolean
  ) => {
    const next: ChmodState = {
      ...state,
      [category]: {
        ...state[category],
        [perm]: checked,
      },
    };
    syncState(next);
  };

  const handleSpecialChange = (key: "setuid" | "setgid" | "sticky", checked: boolean) => {
    const next: ChmodState = {
      ...state,
      special: {
        ...state.special,
        [key]: checked,
      },
    };
    syncState(next);
  };

  const handleOctalChange = (val: string) => {
    setOctalInput(val);
    try {
      if (val.trim()) {
        const next = parseOctalToState(val, state);
        setState(next);
        setSymbolicInput(getSymbolicString(next));
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid octal value");
    }
  };

  const handleSymbolicChange = (val: string) => {
    setSymbolicInput(val);
    try {
      if (val.trim()) {
        const next = parseSymbolicToState(val, state);
        setState(next);
        setOctalInput(getOctalString(next));
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid symbolic permission");
    }
  };

  const handleApplyPreset = (octal: string) => {
    try {
      const next = parseOctalToState(octal, state);
      syncState(next);
    } catch {
      // ignore
    }
  };

  const handleCopyCommand = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const commands = getChmodCommands(state, targetName);
  const description = describePermissions(state);
  const octalValue = getOctalString(state);

  const customPanes = (
    <div className="flex flex-col gap-5 w-full">
      {/* Top Banner: Real-time Octal & Symbolic Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Octal Box */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.chmodCalculator.octalRepresentation}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium">
              Base-8
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={octalInput}
              onChange={(e) => handleOctalChange(e.target.value)}
              className="text-3xl font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="755"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              u: <b className="text-slate-700 dark:text-slate-200">{tripletToOctal(state.owner)}</b> | g:{" "}
              <b className="text-slate-700 dark:text-slate-200">{tripletToOctal(state.group)}</b> | o:{" "}
              <b className="text-slate-700 dark:text-slate-200">{tripletToOctal(state.others)}</b>
            </div>
          </div>
        </div>

        {/* Symbolic Box */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.chmodCalculator.symbolicNotation}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
              rwx
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={symbolicInput}
              onChange={(e) => handleSymbolicChange(e.target.value)}
              className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="-rwxr-xr-x"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Permission Matrix */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          {t.chmodCalculator.interactiveMatrix}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="pb-3 font-semibold">{t.chmodCalculator.scope}</th>
                <th className="pb-3 text-center font-semibold">{t.chmodCalculator.read}</th>
                <th className="pb-3 text-center font-semibold">{t.chmodCalculator.write}</th>
                <th className="pb-3 text-center font-semibold">{t.chmodCalculator.execute}</th>
                <th className="pb-3 text-right font-semibold">Octal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {/* Owner */}
              <tr>
                <td className="py-3 font-medium text-slate-800 dark:text-slate-200">
                  {t.chmodCalculator.owner}
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.owner.read}
                    onChange={(e) => handleCheckboxChange("owner", "read", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.owner.write}
                    onChange={(e) => handleCheckboxChange("owner", "write", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.owner.execute}
                    onChange={(e) => handleCheckboxChange("owner", "execute", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                  {tripletToOctal(state.owner)}
                </td>
              </tr>

              {/* Group */}
              <tr>
                <td className="py-3 font-medium text-slate-800 dark:text-slate-200">
                  {t.chmodCalculator.group}
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.group.read}
                    onChange={(e) => handleCheckboxChange("group", "read", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.group.write}
                    onChange={(e) => handleCheckboxChange("group", "write", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.group.execute}
                    onChange={(e) => handleCheckboxChange("group", "execute", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                  {tripletToOctal(state.group)}
                </td>
              </tr>

              {/* Others */}
              <tr>
                <td className="py-3 font-medium text-slate-800 dark:text-slate-200">
                  {t.chmodCalculator.others}
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.others.read}
                    onChange={(e) => handleCheckboxChange("others", "read", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.others.write}
                    onChange={(e) => handleCheckboxChange("others", "write", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-center">
                  <input
                    type="checkbox"
                    checked={state.others.execute}
                    onChange={(e) => handleCheckboxChange("others", "execute", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                <td className="py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                  {tripletToOctal(state.others)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Special Permissions / Flags */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
            {t.chmodCalculator.specialPermissions}
          </span>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300" title={t.chmodCalculator.setuidDesc}>
              <input
                type="checkbox"
                checked={state.special.setuid}
                onChange={(e) => handleSpecialChange("setuid", e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>{t.chmodCalculator.setuid}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300" title={t.chmodCalculator.setgidDesc}>
              <input
                type="checkbox"
                checked={state.special.setgid}
                onChange={(e) => handleSpecialChange("setgid", e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>{t.chmodCalculator.setgid}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300" title={t.chmodCalculator.stickyDesc}>
              <input
                type="checkbox"
                checked={state.special.sticky}
                onChange={(e) => handleSpecialChange("sticky", e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>{t.chmodCalculator.sticky}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          {t.chmodCalculator.quickPresets}
        </h3>
        <div className="flex flex-wrap gap-2">
          {CHMOD_PRESETS.map((preset) => {
            const isActive = octalValue === preset.octal;
            return (
              <button
                key={preset.octal}
                onClick={() => handleApplyPreset(preset.octal)}
                title={preset.desc}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generated Linux Commands & Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Terminal Commands */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                {t.chmodCalculator.terminalCommands}
              </h3>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">{t.chmodCalculator.targetFileName}</span>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 w-24 text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Numeric command */}
              <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs flex items-center justify-between">
                <code>{commands.numeric}</code>
                <button
                  onClick={() => handleCopyCommand(commands.numeric, "numeric")}
                  className="p-1 hover:text-indigo-400 transition-colors"
                  title="Copy command"
                >
                  {copiedKey === "numeric" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Symbolic command */}
              <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs flex items-center justify-between">
                <code>{commands.symbolic}</code>
                <button
                  onClick={() => handleCopyCommand(commands.symbolic, "symbolic")}
                  className="p-1 hover:text-indigo-400 transition-colors"
                  title="Copy command"
                >
                  {copiedKey === "symbolic" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Recursive command */}
              <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs flex items-center justify-between">
                <code>{commands.recursive}</code>
                <button
                  onClick={() => handleCopyCommand(commands.recursive, "recursive")}
                  className="p-1 hover:text-indigo-400 transition-colors"
                  title="Copy command"
                >
                  {copiedKey === "recursive" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Human Readable Explanation */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            {t.chmodCalculator.permissionSummary}
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Owner: </span>
              <span className="text-slate-600 dark:text-slate-400">{description.owner.join(", ")}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Group: </span>
              <span className="text-slate-600 dark:text-slate-400">{description.group.join(", ")}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Others: </span>
              <span className="text-slate-600 dark:text-slate-400">{description.others.join(", ")}</span>
            </div>
            {description.special.length > 0 && (
              <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Special: </span>
                {description.special.join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ToolLayout
      id="chmod-calculator"
      title={t.tools["chmod-calculator"]?.title || "Chmod / Linux Permissions Calculator"}
      description={t.tools["chmod-calculator"]?.description || "Interactive calculator for Linux file permissions with octal numbers, symbolic strings, presets, and terminal commands"}
      icon={Lock}
      categoryName="Generators"
      customPanes={customPanes}
    />
  );
};

