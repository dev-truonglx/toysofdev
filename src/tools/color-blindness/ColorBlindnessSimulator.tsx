import React, { useState, useRef, useEffect, useCallback } from "react";
import { Eye, Upload, Download } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type DeficiencyType = "normal" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

export const ColorBlindnessSimulator: React.FC = () => {
  const { t } = useTranslation();
  const [deficiency, setDeficiency] = useState<DeficiencyType>("deuteranopia");
  const [imageSrc, setImageSrc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate a default colorful test gradient image if none uploaded
  useEffect(() => {
    const defaultCanvas = document.createElement("canvas");
    defaultCanvas.width = 400;
    defaultCanvas.height = 250;
    const ctx = defaultCanvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 400, 250);
      grad.addColorStop(0, "#ef4444"); // red
      grad.addColorStop(0.25, "#eab308"); // yellow
      grad.addColorStop(0.5, "#22c55e"); // green
      grad.addColorStop(0.75, "#06b6d4"); // cyan
      grad.addColorStop(1, "#6366f1"); // indigo
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 250);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("Toys of Dev Color Test", 30, 60);

      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath();
      ctx.arc(320, 180, 45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f43f5e";
      ctx.fillRect(50, 120, 100, 60);

      setImageSrc(defaultCanvas.toDataURL());
    }
  }, []);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const applyDeficiency = useCallback(() => {
    if (!imageSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (deficiency === "normal") return;

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Color matrix transformations
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let nr = r;
        let ng = g;
        let nb = b;

        if (deficiency === "protanopia") {
          nr = 0.56667 * r + 0.43333 * g + 0.0 * b;
          ng = 0.55833 * r + 0.44167 * g + 0.0 * b;
          nb = 0.0 * r + 0.24167 * g + 0.75833 * b;
        } else if (deficiency === "deuteranopia") {
          nr = 0.625 * r + 0.375 * g + 0.0 * b;
          ng = 0.7 * r + 0.3 * g + 0.0 * b;
          nb = 0.0 * r + 0.3 * g + 0.7 * b;
        } else if (deficiency === "tritanopia") {
          nr = 0.95 * r + 0.05 * g + 0.0 * b;
          ng = 0.0 * r + 0.43333 * g + 0.56667 * b;
          nb = 0.0 * r + 0.475 * g + 0.525 * b;
        } else if (deficiency === "achromatopsia") {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          nr = gray;
          ng = gray;
          nb = gray;
        }

        data[i] = Math.min(255, Math.max(0, nr));
        data[i + 1] = Math.min(255, Math.max(0, ng));
        data[i + 2] = Math.min(255, Math.max(0, nb));
      }

      ctx.putImageData(imgData, 0, 0);
    };
    img.src = imageSrc;
  }, [imageSrc, deficiency]);

  useEffect(() => {
    applyDeficiency();
  }, [applyDeficiency]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `simulated-${deficiency}.png`;
    a.click();
  };

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="blindness-type" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.visionType}
        </label>
        <select
          id="blindness-type"
          value={deficiency}
          onChange={(e) => setDeficiency(e.target.value as DeficiencyType)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="normal">{t.ui.normalVision}</option>
          <option value="deuteranopia">Deuteranopia (Green-Weak / Most Common ~6% males)</option>
          <option value="protanopia">Protanopia (Red-Weak ~2% males)</option>
          <option value="tritanopia">Tritanopia (Blue-Yellow Blind ~0.01%)</option>
          <option value="achromatopsia">Achromatopsia (Total Color Blindness)</option>
        </select>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        <span>{t.ui.selectImage}</span>
      </button>

      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t.ui.download}</span>
      </button>
    </>
  );

  return (
    <ToolLayout
      id="color-blindness-simulator"
      title="Color Blindness Simulator"
      description="Simulate how images and UI designs appear to individuals with different color vision deficiencies"
      icon={Eye}
      categoryName="Graphic & Testing"
      configuration={config}
      customPanes={
        <div className="flex flex-col flex-1 min-h-[460px] p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
            {/* Original Preview */}
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Original Image (Normal Vision)
              </div>
              <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
                {imageSrc && (
                  <img src={imageSrc} alt="Original" className="max-h-72 max-w-full object-contain rounded-lg shadow-sm" />
                )}
              </div>
            </div>

            {/* Simulated Canvas */}
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
                Simulated: {deficiency}
              </div>
              <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
                <canvas ref={canvasRef} className="max-h-72 max-w-full object-contain rounded-lg shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
};
