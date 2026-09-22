import React, { useState } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const CronParser: React.FC = () => {
  const { t, language } = useTranslation();
  const [expression, setExpression] = useState("*/15 0 1,15 * 1-5");
  const [error, setError] = useState<string | null>(null);

  const parts = expression.trim().split(/\s+/);
  const isValid = parts.length === 5;

  const describeField = (val: string, name: string): string => {
    const isVi = language === "vi";
    if (val === "*") return `${t.ui.every} ${isVi ? name.toLowerCase() : name}`;
    if (val.startsWith("*/")) {
      const step = val.substring(2);
      return isVi ? `Mỗi ${step} ${name.toLowerCase()}` : `Every ${step} ${name}s`;
    }
    if (val.includes(",")) {
      return isVi ? `Tại các ${name.toLowerCase()}: ${val}` : `At ${name}s: ${val}`;
    }
    if (val.includes("-")) {
      return isVi ? `Trong khoảng ${name.toLowerCase()}: ${val}` : `Between ${name}s: ${val}`;
    }
    return `${t.ui.at} ${isVi ? name.toLowerCase() : name} ${val}`;
  };

  const getUpcomingDates = (_cron: string, count = 5): Date[] => {
    const dates: Date[] = [];
    if (!isValid) return dates;
    const now = new Date();
    let iter = new Date(now.getTime() + 60000);

    for (let i = 0; i < 1000 && dates.length < count; i++) {
      const m = iter.getMinutes();
      const h = iter.getHours();
      const dom = iter.getDate();
      const month = iter.getMonth() + 1;
      const dow = iter.getDay();

      const matchField = (fieldStr: string, currentVal: number): boolean => {
        if (fieldStr === "*") return true;
        if (fieldStr.startsWith("*/")) {
          const step = parseInt(fieldStr.substring(2), 10);
          return currentVal % step === 0;
        }
        if (fieldStr.includes(",")) {
          return fieldStr.split(",").some((v) => parseInt(v, 10) === currentVal);
        }
        if (fieldStr.includes("-")) {
          const [start, end] = fieldStr.split("-").map((v) => parseInt(v, 10));
          return currentVal >= start && currentVal <= end;
        }
        return parseInt(fieldStr, 10) === currentVal;
      };

      if (
        matchField(parts[0], m) &&
        matchField(parts[1], h) &&
        matchField(parts[2], dom) &&
        matchField(parts[3], month) &&
        matchField(parts[4], dow)
      ) {
        dates.push(new Date(iter));
      }
      iter = new Date(iter.getTime() + 60000);
    }
    return dates;
  };

  const presets = [
    { label: t.ui.everyMinute, val: "* * * * *" },
    { label: t.ui.every15Mins, val: "*/15 * * * *" },
    { label: t.ui.everyHour, val: "0 * * * *" },
    { label: t.ui.dailyMidnight, val: "0 0 * * *" },
    { label: t.ui.weekdays9Am, val: "0 9 * * 1-5" },
  ];

  const upcoming = isValid ? getUpcomingDates(expression) : [];
  const fieldNames = [
    t.ui.minute,
    t.ui.hour,
    t.ui.dayOfMonth,
    t.ui.month,
    t.ui.dayOfWeek,
  ];

  return (
    <ToolLayout
      id="cron-parser"
      title="Cron Expression Parser"
      description="Parse, explain and calculate upcoming execution dates for cron schedules"
      icon={CalendarClock}
      categoryName="Converters"
      error={!isValid ? t.ui.cronFieldsRequired : error}
      customPanes={
        <div className="flex flex-col gap-6 flex-1 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.ui.cronFieldsHint}
              </label>
              <div className="flex items-center gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.val}
                    onClick={() => {
                      setExpression(p.val);
                      setError(null);
                    }}
                    className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="* * * * *"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 font-mono text-base tracking-widest text-indigo-600 dark:text-indigo-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {isValid && (
            <div className="grid grid-cols-5 gap-3 text-center">
              {fieldNames.map((name, i) => (
                <div
                  key={name}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60"
                >
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">{name}</div>
                  <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{parts[i]}</div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{describeField(parts[i], name)}</div>
                </div>
              ))}
            </div>
          )}

          {isValid && upcoming.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>{t.ui.nextExecutions}</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                {upcoming.map((date, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between"
                  >
                    <span>{idx + 1}. {date.toLocaleString()}</span>
                    <span className="text-[11px] text-slate-400">{date.toISOString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
};
