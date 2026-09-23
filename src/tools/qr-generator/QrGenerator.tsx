import React, { useState, useEffect } from "react";
import { QrCode, Download, Copy, Check } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import QRCode from "qrcode";

type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export const QrGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("https://github.com/dev-truonglx/toysofdev");
  const [ecLevel, setEcLevel] = useState<ErrorCorrectionLevel>("M");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!input.trim()) {
      setDataUrl("");
      setError(null);
      return;
    }

    QRCode.toDataURL(input, {
      errorCorrectionLevel: ecLevel,
      margin: 2,
      width: 320,
      color: {
        dark: "#1e1b4b",
        light: "#ffffff",
      },
    })
      .then((url) => {
        setDataUrl(url);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to generate QR Code");
        setDataUrl("");
      });
  }, [input, ecLevel]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-${Date.now()}.png`;
    a.click();
  };

  const handleCopy = () => {
    if (!dataUrl) return;
    navigator.clipboard.writeText(dataUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const config = (
    <div className="flex items-center gap-2">
      <label htmlFor="qr-ec" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
        {t.ui.errorCorrection}
      </label>
      <select
        id="qr-ec"
        value={ecLevel}
        onChange={(e) => setEcLevel(e.target.value as ErrorCorrectionLevel)}
        className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="L">Low (7% recovery)</option>
        <option value="M">Medium (15% recovery)</option>
        <option value="Q">Quartile (25% recovery)</option>
        <option value="H">High (30% recovery)</option>
      </select>
    </div>
  );

  return (
    <ToolLayout
      id="qr-generator"
      title="QR Code Generator"
      description="Generate customizable QR codes from text, URLs, or contact information"
      icon={QrCode}
      categoryName="Encoders / Decoders"
      configuration={config}
      error={error}
      customPanes={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[440px]">
          {/* Left: Text Input */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.payloadContent}</span>
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
              placeholder={t.ui.enterTextQrPlaceholder}
              spellCheck={false}
              className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>

          {/* Right: QR Preview & Download */}
          <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm gap-4">
            {dataUrl ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-100">
                  <img src={dataUrl} alt="QR Code" className="w-64 h-64 object-contain" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.ui.download} PNG</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-500">{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{t.common.copy} Data URI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic">{t.ui.enterTextQrPrompt}</div>
            )}
          </div>
        </div>
      }
    />
  );
};
