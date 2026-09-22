import React, { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw, KeyRound } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type Mode = "password" | "passphrase";

const WORDS = [
  "apple", "banana", "castle", "dragon", "falcon", "galaxy", "island", "jungle",
  "kitten", "lemon", "mountain", "nebula", "ocean", "planet", "quantum", "river",
  "silver", "tiger", "umbrella", "valley", "wizard", "yellow", "zenith", "crystal",
  "shadow", "forest", "desert", "matrix", "beacon", "sunset", "harbor", "horizon",
];

export const PasswordGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("password");
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);

  // Passphrase options
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(true);

  const [output, setOutput] = useState("");

  const getRandomInt = (max: number): number => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  };

  const generate = useCallback(() => {
    if (mode === "passphrase") {
      const selectedWords: string[] = [];
      for (let i = 0; i < wordCount; i++) {
        let w = WORDS[getRandomInt(WORDS.length)];
        if (capitalize) {
          w = w.charAt(0).toUpperCase() + w.slice(1);
        }
        selectedWords.push(w);
      }
      setOutput(selectedWords.join(separator));
    } else {
      let charset = "";
      if (useLower) charset += "abcdefghijklmnopqrstuvwxyz";
      if (useUpper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      if (useDigits) charset += "0123456789";
      if (useSymbols) charset += "!@#$%^&*()_+~|}{[]:;?><,./-=";

      if (!charset) {
        setOutput("");
        return;
      }

      let result = "";
      for (let i = 0; i < length; i++) {
        result += charset[getRandomInt(charset.length)];
      }
      setOutput(result);
    }
  }, [mode, length, useUpper, useLower, useDigits, useSymbols, wordCount, separator, capitalize]);

  useEffect(() => {
    generate();
  }, [generate]);

  // Calculate rough entropy
  let entropy = 0;
  if (mode === "password") {
    let pool = 0;
    if (useLower) pool += 26;
    if (useUpper) pool += 26;
    if (useDigits) pool += 10;
    if (useSymbols) pool += 28;
    entropy = pool > 0 ? Math.round(length * Math.log2(pool)) : 0;
  } else {
    entropy = Math.round(wordCount * Math.log2(WORDS.length));
  }

  const getStrengthLabel = (bits: number) => {
    if (bits < 40) return { label: "Weak", color: "bg-rose-500 text-rose-600" };
    if (bits < 60) return { label: "Fair", color: "bg-amber-500 text-amber-600" };
    if (bits < 90) return { label: "Strong", color: "bg-emerald-500 text-emerald-600" };
    return { label: "Very Strong", color: "bg-indigo-500 text-indigo-600" };
  };

  const strength = getStrengthLabel(entropy);

  const config = (
    <>
      <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setMode("password")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "password"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.password}
        </button>
        <button
          onClick={() => setMode("passphrase")}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            mode === "passphrase"
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.passphrase}
        </button>
      </div>

      {mode === "password" ? (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="pwd-len" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {t.ui.length}: {length}
            </label>
            <input
              id="pwd-len"
              type="range"
              min={6}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-28 accent-indigo-600"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useUpper}
              onChange={(e) => setUseUpper(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>A-Z</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useLower}
              onChange={(e) => setUseLower(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>a-z</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useDigits}
              onChange={(e) => setUseDigits(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>0-9</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useSymbols}
              onChange={(e) => setUseSymbols(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>!@#$</span>
          </label>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="pp-words" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {t.ui.words}: {wordCount}
            </label>
            <input
              id="pp-words"
              type="range"
              min={3}
              max={10}
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              className="w-24 accent-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="pp-sep" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {t.ui.delimiter}:
            </label>
            <input
              id="pp-sep"
              type="text"
              maxLength={2}
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              className="w-10 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1 text-center font-mono"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={capitalize}
              onChange={(e) => setCapitalize(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>{t.ui.capitalize}</span>
          </label>
        </>
      )}
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
      id="password-generator"
      title="Password & Passphrase Generator"
      description="Generate cryptographically secure random passwords or memorable passphrases"
      icon={KeyRound}
      categoryName="Generators"
      configuration={config}
      outputLabel="Generated Secret"
      outputValue={output}
      actionsRight={actionsRight}
      outputPlaceholder="Generated password will appear here..."
      customPanes={
        <div className="flex flex-col flex-1 min-h-[380px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm p-6 justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Entropy & Strength</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">
                ~{entropy} bits ({strength.label})
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${strength.color.split(" ")[0]}`}
                style={{ width: `${Math.min(100, (entropy / 100) * 100)}%` }}
              />
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-wider text-slate-900 dark:text-slate-100 break-all select-all text-center">
                {output}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span>Entropy is generated locally with Web Crypto API (zero network transmission).</span>
          </div>
        </div>
      }
    />
  );
};
