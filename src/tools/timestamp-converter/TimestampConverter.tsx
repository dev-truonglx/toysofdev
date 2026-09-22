import React, { useState, useEffect } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const TimestampConverter: React.FC = () => {
  const { t } = useTranslation();
  const [epochInput, setEpochInput] = useState<string>(() => Math.floor(Date.now() / 1000).toString());
  const [isMilliseconds, setIsMilliseconds] = useState(false);
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  // Live timer for current time
  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSetNow = () => {
    const now = Date.now();
    setEpochInput(isMilliseconds ? now.toString() : Math.floor(now / 1000).toString());
  };

  let parsedDate: Date | null = null;
  let parseError: string | null = null;

  if (epochInput.trim()) {
    const num = Number(epochInput.trim());
    if (isNaN(num)) {
      parseError = `${t.ui.invalid} timestamp`;
    } else {
      const ms = isMilliseconds ? num : num * 1000;
      parsedDate = new Date(ms);
      if (isNaN(parsedDate.getTime())) {
        parseError = "Out of range date timestamp";
        parsedDate = null;
      }
    }
  }

  const formatOutput = () => {
    if (!parsedDate) return "";
    return [
      `UTC (ISO 8601):      ${parsedDate.toISOString()}`,
      `UTC String:          ${parsedDate.toUTCString()}`,
      `Local Time:          ${parsedDate.toLocaleString()}`,
      `Local Date:          ${parsedDate.toLocaleDateString()}`,
      `Epoch (Seconds):     ${Math.floor(parsedDate.getTime() / 1000)}`,
      `Epoch (Milliseconds):${parsedDate.getTime()}`,
      `Timezone Offset:     ${parsedDate.getTimezoneOffset()} minutes`,
    ].join("\n");
  };

  const config = (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSetNow}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.ui.now}</span>
        </button>

        <span className="text-xs text-slate-400">
          {t.ui.currentTimestamp}: <code className="font-mono text-slate-700 dark:text-slate-300">{nowSec}</code>
        </span>
      </div>

      <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setIsMilliseconds(false)}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            !isMilliseconds
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.epochSeconds}
        </button>
        <button
          onClick={() => setIsMilliseconds(true)}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            isMilliseconds
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t.ui.epochMillis}
        </button>
      </div>
    </>
  );

  return (
    <ToolLayout
      id="timestamp-converter"
      title="Timestamp / Date Converter"
      description="Convert Epoch Unix timestamp to human-readable date & time and vice-versa"
      icon={Clock}
      categoryName="Converters"
      configuration={config}
      inputLabel={isMilliseconds ? t.ui.epochMillis : t.ui.epochSeconds}
      inputValue={epochInput}
      onInputChange={setEpochInput}
      inputPlaceholder="e.g. 1700000000"
      outputLabel={t.ui.humanDate}
      outputValue={formatOutput()}
      error={parseError}
    />
  );
};
