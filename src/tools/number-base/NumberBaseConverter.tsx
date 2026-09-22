import React, { useState } from "react";
import { Binary, Copy, Check } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const NumberBaseConverter: React.FC = () => {
  const { t } = useTranslation();
  const [dec, setDec] = useState("42");
  const [hex, setHex] = useState("2a");
  const [bin, setBin] = useState("101010");
  const [oct, setOct] = useState("52");
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const updateFromBigInt = (val: bigint) => {
    setDec(val.toString(10));
    setHex(val.toString(16));
    setBin(val.toString(2));
    setOct(val.toString(8));
    setError(null);
  };

  const handleDecChange = (v: string) => {
    setDec(v);
    if (!v.trim()) return;
    try {
      const val = BigInt(v.trim());
      updateFromBigInt(val);
    } catch {
      setError(`${t.ui.invalid} ${t.ui.decimal}`);
    }
  };

  const handleHexChange = (v: string) => {
    setHex(v);
    if (!v.trim()) return;
    try {
      const clean = v.trim().replace(/^0x/i, "");
      const val = BigInt(`0x${clean}`);
      updateFromBigInt(val);
    } catch {
      setError(`${t.ui.invalid} ${t.ui.hexadecimal}`);
    }
  };

  const handleBinChange = (v: string) => {
    setBin(v);
    if (!v.trim()) return;
    try {
      const clean = v.trim().replace(/^0b/i, "").replace(/\s/g, "");
      const val = BigInt(`0b${clean}`);
      updateFromBigInt(val);
    } catch {
      setError(`${t.ui.invalid} ${t.ui.binary}`);
    }
  };

  const handleOctChange = (v: string) => {
    setOct(v);
    if (!v.trim()) return;
    try {
      const clean = v.trim().replace(/^0o/i, "");
      const val = BigInt(`0o${clean}`);
      updateFromBigInt(val);
    } catch {
      setError(`${t.ui.invalid} ${t.ui.octal}`);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const fields = [
    { key: "dec", label: `${t.ui.decimal} (Base 10)`, value: dec, onChange: handleDecChange, placeholder: "e.g. 255" },
    { key: "hex", label: `${t.ui.hexadecimal} (Base 16)`, value: hex, onChange: handleHexChange, placeholder: "e.g. ff" },
    { key: "bin", label: `${t.ui.binary} (Base 2)`, value: bin, onChange: handleBinChange, placeholder: "e.g. 11111111" },
    { key: "oct", label: `${t.ui.octal} (Base 8)`, value: oct, onChange: handleOctChange, placeholder: "e.g. 377" },
  ];

  return (
    <ToolLayout
      id="number-base-converter"
      title="Number Base Converter"
      description="Convert numbers in real-time between Decimal, Hexadecimal, Binary, and Octal bases"
      icon={Binary}
      categoryName="Converters"
      error={error}
      customPanes={
        <div className="flex flex-col gap-4 flex-1 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>{f.label}</span>
                  <button
                    onClick={() => copyToClipboard(f.value, f.key)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {copiedKey === f.key ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  placeholder={f.placeholder}
                  spellCheck={false}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
};
