import React, { useState } from "react";
import { Palette, CheckCircle2, XCircle } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const ColorPickerTool: React.FC = () => {
  const { t } = useTranslation();
  const [fgColor, setFgColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("#4f46e5");

  const hexToRgb = (hex: string): [number, number, number] => {
    let clean = hex.replace("#", "");
    if (clean.length === 3) {
      clean = clean.split("").map((c) => c + c).join("");
    }
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const getLuminance = (r: number, g: number, b: number): number => {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };

  const calculateContrastRatio = (hex1: string, hex2: string): number => {
    try {
      const [r1, g1, b1] = hexToRgb(hex1);
      const [r2, g2, b2] = hexToRgb(hex2);
      const l1 = getLuminance(r1, g1, b1);
      const l2 = getLuminance(r2, g2, b2);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return Math.round(ratio * 100) / 100;
    } catch {
      return 1;
    }
  };

  const ratio = calculateContrastRatio(fgColor, bgColor);

  const [bgR, bgG, bgB] = hexToRgb(bgColor);

  const wcagTests = [
    { label: "Normal Text (WCAG AA)", pass: ratio >= 4.5, req: "4.5:1" },
    { label: "Large Text (WCAG AA)", pass: ratio >= 3.0, req: "3.0:1" },
    { label: "Normal Text (WCAG AAA)", pass: ratio >= 7.0, req: "7.0:1" },
    { label: "Large Text (WCAG AAA)", pass: ratio >= 4.5, req: "4.5:1" },
  ];

  return (
    <ToolLayout
      id="color-picker-contrast"
      title="Color Picker & Contrast Checker"
      description="Inspect color spaces (HEX, RGB, HSL) and verify WCAG 2.1 accessibility contrast compliance"
      icon={Palette}
      categoryName="Graphic & Testing"
      customPanes={
        <div className="flex flex-col gap-6 flex-1 min-h-[500px] p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {/* Top: Color Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.ui.textColor}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-12 h-10 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.ui.backgroundColor}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-12 h-10 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                RGB: rgb({bgR}, {bgG}, {bgB})
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div
            style={{ backgroundColor: bgColor, color: fgColor }}
            className="p-8 rounded-2xl shadow-inner flex flex-col items-center justify-center text-center transition-colors duration-300 gap-2 border border-slate-200/40"
          >
            <div className="text-2xl font-bold tracking-tight">{t.ui.sampleSentence}</div>
            <div className="text-sm opacity-90">
              {t.ui.sampleParagraph}
            </div>
          </div>

          {/* Contrast Ratio & WCAG Badges */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.ui.contrastRatio}
              </span>
              <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {ratio}:1
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {wcagTests.map((t) => (
                <div
                  key={t.label}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    t.pass
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold">{t.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Required: {t.req}</div>
                  </div>
                  {t.pass ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
};
