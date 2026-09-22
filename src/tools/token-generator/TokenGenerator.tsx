import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const TokenGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [length, setLength] = useState(21);
  const [count, setCount] = useState(5);
  const [alphabetPreset, setAlphabetPreset] = useState<string>("url-safe");
  const [customAlphabet, setCustomAlphabet] = useState("");
  const [output, setOutput] = useState("");

  const getAlphabet = (): string => {
    switch (alphabetPreset) {
      case "url-safe":
        return "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLFGQZ_file";
      case "hex":
        return "0123456789abcdef";
      case "alphanumeric":
        return "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      case "numbers":
        return "0123456789";
      case "custom":
        return customAlphabet || "abc";
      default:
        return "0123456789abcdef";
    }
  };

  const generate = useCallback(() => {
    const chars = getAlphabet();
    const tokens: string[] = [];

    for (let c = 0; c < count; c++) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      let token = "";
      for (let i = 0; i < length; i++) {
        token += chars[bytes[i] % chars.length];
      }
      tokens.push(token);
    }

    setOutput(tokens.join("\n"));
  }, [length, count, alphabetPreset, customAlphabet]);

  useEffect(() => {
    generate();
  }, [generate]);

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="token-alphabet" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.alphabet}
        </label>
        <select
          id="token-alphabet"
          value={alphabetPreset}
          onChange={(e) => setAlphabetPreset(e.target.value)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="url-safe">NanoID (URL-Safe)</option>
          <option value="alphanumeric">Alphanumeric (A-Z, a-z, 0-9)</option>
          <option value="hex">Hexadecimal (0-9, a-f)</option>
          <option value="numbers">Numbers Only (0-9)</option>
          <option value="custom">{t.ui.customAlphabet}</option>
        </select>
      </div>

      {alphabetPreset === "custom" && (
        <input
          type="text"
          value={customAlphabet}
          onChange={(e) => setCustomAlphabet(e.target.value)}
          placeholder={t.ui.customCharsPlaceholder}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
        />
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="token-length" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.length}:
        </label>
        <input
          id="token-length"
          type="number"
          min={4}
          max={128}
          value={length}
          onChange={(e) => setLength(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-center font-mono"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="token-count" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.count}:
        </label>
        <input
          id="token-count"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-center font-mono"
        />
      </div>
    </>
  );

  const actionsRight = (
    <button
      onClick={generate}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>{t.ui.generate}</span>
    </button>
  );

  return (
    <ToolLayout
      id="token-generator"
      title="NanoID / Random Token Generator"
      description="Generate secure random URL-safe NanoIDs and customizable tokens"
      icon={Sparkles}
      categoryName="Generators"
      configuration={config}
      outputLabel="Generated Tokens"
      outputValue={output}
      actionsRight={actionsRight}
      outputPlaceholder="Tokens will appear here..."
      customPanes={
        <div className="flex flex-col flex-1 min-h-[400px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Generated Tokens ({count} items)</span>
          </div>
          <textarea
            value={output}
            readOnly
            spellCheck={false}
            className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
          />
        </div>
      }
    />
  );
};
