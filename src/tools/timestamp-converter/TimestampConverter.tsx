import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Clock,
  Calendar,
  Copy,
  Check,
  Globe,
  Search,
  ChevronDown,
  Columns,
  RefreshCw,
  Clipboard,
  Trash2,
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import {
  TimestampUnit,
  getLocalTimezone,
  getTimezoneOffset,
  getAllSupportedTimezones,
  autoDetectUnit,
  toMilliseconds,
  datePartsToEpoch,
  getDatePartsInTimezone,
  getDetailedFormattedDate,
  parseDateInputString,
  formatDatePartsToString,
} from "./timestampUtils";

type ViewMode = "dual" | "timestamp-to-date" | "date-to-timestamp";

export const TimestampConverter: React.FC = () => {
  const { t, language } = useTranslation();

  // -------------------------------------------------------------
  // Global Timezone & Real-time Clock State
  // -------------------------------------------------------------
  const [selectedTz, setSelectedTz] = useState<string>(() => getLocalTimezone());
  const [isTzDropdownOpen, setIsTzDropdownOpen] = useState(false);
  const [tzSearch, setTzSearch] = useState("");
  const tzDropdownRef = useRef<HTMLDivElement>(null);

  const localTz = useMemo(() => getLocalTimezone(), []);
  const allTimezones = useMemo(() => getAllSupportedTimezones(), []);

  // Real-time ticking epoch clock
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setNowSec(Math.floor(now / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close timezone popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tzDropdownRef.current && !tzDropdownRef.current.contains(e.target as Node)) {
        setIsTzDropdownOpen(false);
      }
    };
    if (isTzDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTzDropdownOpen]);

  // View Mode: Dual, Timestamp->Date, Date->Timestamp
  const [viewMode, setViewMode] = useState<ViewMode>("dual");

  // Copy feedback state: tracks key of currently copied item
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyToClipboard = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // -------------------------------------------------------------
  // PANEL 1: Timestamp -> Date State
  // -------------------------------------------------------------
  const [epochInput, setEpochInput] = useState<string>(() => Math.floor(Date.now() / 1000).toString());
  const [unit, setUnit] = useState<TimestampUnit>("auto");

  const detectedUnit = useMemo(() => {
    return autoDetectUnit(epochInput);
  }, [epochInput]);

  const timestampConversion = useMemo(() => {
    if (!epochInput.trim()) {
      return { details: null, error: null };
    }
    const { ms } = toMilliseconds(epochInput.trim(), unit);
    if (isNaN(ms)) {
      return { details: null, error: `${t.ui.invalid} timestamp` };
    }
    const details = getDetailedFormattedDate(ms, selectedTz);
    if (!details) {
      return { details: null, error: "Out of range timestamp" };
    }
    return { details, error: null };
  }, [epochInput, unit, selectedTz, t.ui.invalid]);

  // Adjust timestamp input by delta seconds
  const adjustTimestamp = (deltaSec: number) => {
    const trimmed = epochInput.trim();
    const effectiveUnit = unit === "auto" ? detectedUnit : unit;
    const currentNum = Number(trimmed);
    if (isNaN(currentNum)) return;

    let multiplier = 1;
    if (effectiveUnit === "milliseconds") multiplier = 1000;
    else if (effectiveUnit === "microseconds") multiplier = 1000000;
    else if (effectiveUnit === "nanoseconds") multiplier = 1000000000;

    const nextVal = currentNum + deltaSec * multiplier;
    setEpochInput(Math.floor(nextVal).toString());
  };

  const handlePasteTimestamp = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setEpochInput(text.trim());
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  // -------------------------------------------------------------
  // PANEL 2: Date -> Timestamp State
  // -------------------------------------------------------------
  const [dateInput, setDateInput] = useState<string>(() => {
    return formatDatePartsToString(getDatePartsInTimezone(new Date(), selectedTz));
  });

  // Calculate epoch result from manual dateInput in selected timezone
  const dateConversion = useMemo(() => {
    const trimmed = dateInput.trim();
    if (!trimmed) {
      return { result: null, error: null };
    }
    const parts = parseDateInputString(trimmed, selectedTz);
    if (!parts) {
      return {
        result: null,
        error: language === "vi" ? "Định dạng ngày giờ không hợp lệ" : "Invalid date format",
      };
    }
    try {
      const res = datePartsToEpoch(parts, selectedTz);
      return { result: res, error: null };
    } catch {
      return {
        result: null,
        error: language === "vi" ? "Lỗi tính toán timestamp" : "Error calculating timestamp",
      };
    }
  }, [dateInput, selectedTz, language]);

  const handleSetDateNow = () => {
    setDateInput(formatDatePartsToString(getDatePartsInTimezone(new Date(), selectedTz)));
  };

  const handlePasteDate = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDateInput(text.trim());
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  // -------------------------------------------------------------
  // Filtered Timezones List
  // -------------------------------------------------------------
  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return allTimezones;
    return allTimezones.filter((tz) => {
      return (
        tz.id.toLowerCase().includes(q) ||
        tz.name.toLowerCase().includes(q) ||
        tz.offset.toLowerCase().includes(q)
      );
    });
  }, [allTimezones, tzSearch]);

  const currentTzInfo = useMemo(() => {
    const { offsetStr } = getTimezoneOffset(selectedTz);
    return {
      id: selectedTz,
      name: selectedTz.replace(/_/g, " "),
      offset: offsetStr,
    };
  }, [selectedTz]);

  // -------------------------------------------------------------
  // Configuration Bar (placed inside ToolLayout)
  // -------------------------------------------------------------
  const configurationBar = (
    <div className="flex flex-wrap items-center justify-between w-full gap-3">
      {/* Left: View Mode Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">
          {t.ui.options}:
        </span>
        <div className="flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs">
          <button
            onClick={() => setViewMode("dual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              viewMode === "dual"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            title={t.ui.dualView}
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.ui.dualView}</span>
          </button>
          <button
            onClick={() => setViewMode("timestamp-to-date")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              viewMode === "timestamp-to-date"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            title={t.ui.timestampToDate}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t.ui.timestampToDate}</span>
          </button>
          <button
            onClick={() => setViewMode("date-to-timestamp")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              viewMode === "date-to-timestamp"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            title={t.ui.dateToTimestamp}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t.ui.dateToTimestamp}</span>
          </button>
        </div>
      </div>

      {/* Middle: Searchable Timezone Picker */}
      <div className="relative flex items-center gap-2" ref={tzDropdownRef}>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t.ui.timezone}:
          </span>
        </div>

        <button
          onClick={() => setIsTzDropdownOpen(!isTzDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-500 transition-colors shadow-sm"
        >
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-semibold">
            {currentTzInfo.offset}
          </span>
          <span className="max-w-[160px] sm:max-w-[200px] truncate">{currentTzInfo.name}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isTzDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Quick TZ buttons */}
        <div className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => setSelectedTz(localTz)}
            className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
              selectedTz === localTz
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            }`}
            title={`Local (${localTz})`}
          >
            {t.ui.localTimezone}
          </button>
          <button
            onClick={() => setSelectedTz("UTC")}
            className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
              selectedTz === "UTC"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            }`}
            title="UTC (Coordinated Universal Time)"
          >
            UTC
          </button>
        </div>

        {/* Timezone Popover Dropdown */}
        {isTzDropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 max-h-[380px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input */}
            <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tzSearch}
                  onChange={(e) => setTzSearch(e.target.value)}
                  placeholder={t.ui.searchTimezone}
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Timezones Scroll List */}
            <div className="overflow-y-auto flex-1 p-1.5 space-y-0.5 text-xs">
              {!tzSearch && (
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Popular Timezones
                </div>
              )}
              {filteredTimezones.slice(0, 100).map((tz) => {
                const isSelected = selectedTz === tz.id;
                return (
                  <button
                    key={tz.id}
                    onClick={() => {
                      setSelectedTz(tz.id);
                      setIsTzDropdownOpen(false);
                      setTzSearch("");
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="truncate pr-2">{tz.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      {tz.offset}
                    </span>
                  </button>
                );
              })}
              {filteredTimezones.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No timezones matching "{tzSearch}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Live Ticking Epoch Badge */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const current = unit === "milliseconds" ? nowMs.toString() : nowSec.toString();
            setEpochInput(current);
            copyToClipboard(current, "live-epoch-badge");
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100/70 transition-colors shadow-sm"
          title="Click to copy & insert current live timestamp"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
            {t.ui.currentTimestamp}:
          </span>
          <code className="font-mono font-bold tracking-tight">{nowSec}</code>
          {copiedKey === "live-epoch-badge" ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-1" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-400/70 ml-1" />
          )}
        </button>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // PANEL 1: TIMESTAMP -> DATE COMPONENT
  // -------------------------------------------------------------
  const renderTimestampToDatePanel = () => {
    const details = timestampConversion.details;
    const error = timestampConversion.error;

    return (
      <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex-1">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t.ui.timestampToDate}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Epoch Unix timestamp ➔ Human date
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const now = Date.now();
                setEpochInput(unit === "milliseconds" ? now.toString() : Math.floor(now / 1000).toString());
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.ui.now}</span>
            </button>
            <button
              onClick={handlePasteTimestamp}
              className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title={t.common.paste}
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEpochInput("")}
              disabled={!epochInput}
              className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
              title={t.common.clear}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Panel Content */}
        <div className="p-5 space-y-5 flex-1">
          {/* Input Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Unix Timestamp:
              </label>
              {unit === "auto" && epochInput.trim() && (
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Auto-detected: <span className="capitalize">{detectedUnit}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={epochInput}
                onChange={(e) => setEpochInput(e.target.value)}
                placeholder="e.g. 1774253023"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
              />
            </div>

            {/* Unit selector pills and adjustment buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5 text-xs">
                {(["auto", "seconds", "milliseconds", "microseconds", "nanoseconds"] as TimestampUnit[]).map((u) => {
                  const labelMap: Record<TimestampUnit, string> = {
                    auto: t.ui.unitAuto,
                    seconds: "s",
                    milliseconds: "ms",
                    microseconds: "μs",
                    nanoseconds: "ns",
                  };
                  return (
                    <button
                      key={u}
                      onClick={() => setUnit(u)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        unit === u
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {labelMap[u]}
                    </button>
                  );
                })}
              </div>

              {/* Quick Math adjust buttons */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => adjustTimestamp(-86400)}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Subtract 1 Day"
                >
                  -1d
                </button>
                <button
                  onClick={() => adjustTimestamp(-3600)}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Subtract 1 Hour"
                >
                  -1h
                </button>
                <button
                  onClick={() => adjustTimestamp(3600)}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Add 1 Hour"
                >
                  +1h
                </button>
                <button
                  onClick={() => adjustTimestamp(86400)}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Add 1 Day"
                >
                  +1d
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Formatted Outputs Display */}
          {details && (
            <div className="space-y-3 pt-2">
              {/* Card 1: Selected Timezone Output */}
              <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-800/80 dark:to-slate-900/80 shadow-sm relative group">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{currentTzInfo.name} ({currentTzInfo.offset})</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(details.selectedTzIso, "p1-tz-iso")}
                    className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors"
                    title={t.common.copy}
                  >
                    {copiedKey === "p1-tz-iso" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 break-all select-all">
                  {details.selectedTzIso}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {details.selectedTzFormatted}
                </div>
              </div>

              {/* Card 2: UTC Times */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">UTC (ISO 8601):</span>
                  <button
                    onClick={() => copyToClipboard(details.utcIso, "p1-utc-iso")}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    {copiedKey === "p1-utc-iso" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 select-all">
                  {details.utcIso}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="font-medium text-slate-500 dark:text-slate-400">RFC 2822:</span>
                  <button
                    onClick={() => copyToClipboard(details.rfc2822, "p1-rfc2822")}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    {copiedKey === "p1-rfc2822" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-700 dark:text-slate-300 select-all">
                  {details.rfc2822}
                </div>
              </div>

              {/* Card 3: Relative Time & Calendar Metadata */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t.ui.relativeTime}:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    {language === "vi" ? details.relativeTimeVi : details.relativeTimeEn}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {t.ui.dayOfYear}: <strong className="text-slate-800 dark:text-slate-200">{details.dayOfYear}/{details.totalDaysInYear}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {t.ui.weekOfYear}: <strong className="text-slate-800 dark:text-slate-200">{details.weekOfYear}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {t.ui.leapYear}: <strong className="text-slate-800 dark:text-slate-200">{details.isLeapYear ? t.ui.yes : t.ui.no}</strong>
                  </span>
                </div>
              </div>

              {/* Card 4: Multi-unit Epoch Values */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  Equivalent Epoch Units
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {[
                    { label: t.ui.epochSeconds, val: details.epochSeconds.toString(), key: "p1-s" },
                    { label: t.ui.epochMillis, val: details.epochMillis.toString(), key: "p1-ms" },
                    { label: t.ui.epochMicro, val: details.epochMicro, key: "p1-us" },
                    { label: t.ui.epochNano, val: details.epochNano, key: "p1-ns" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-slate-800 dark:text-slate-200 select-all font-medium text-[11px]">
                          {item.val}
                        </code>
                        <button
                          onClick={() => copyToClipboard(item.val, item.key)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          {copiedKey === item.key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // PANEL 2: DATE -> TIMESTAMP COMPONENT
  // -------------------------------------------------------------
  const renderDateToTimestampPanel = () => {
    const result = dateConversion.result;
    const error = dateConversion.error;

    return (
      <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex-1">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t.ui.dateToTimestamp}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Human date & time ➔ Epoch Unix timestamp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSetDateNow}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.ui.now}</span>
            </button>
            <button
              onClick={handlePasteDate}
              className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title={t.common.paste}
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDateInput("")}
              disabled={!dateInput}
              className="p-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
              title={t.common.clear}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Panel Content */}
        <div className="p-5 space-y-5 flex-1">
          {/* Timezone Context Badge */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Interpreting input in:</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>{currentTzInfo.name}</span>
              <span className="text-slate-400 font-mono text-[11px]">({currentTzInfo.offset})</span>
            </div>
          </div>

          {/* Manual Date & Time String Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                {t.ui.dateInput}:
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                placeholder="e.g. 2026-09-23 15:30:00, 23/09/2026 15:30:00, 2026-09-23T08:00:00Z"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {language === "vi"
                ? "Hỗ trợ: YYYY-MM-DD HH:mm:ss, DD/MM/YYYY HH:mm:ss, ISO 8601, RFC 2822"
                : "Supported: YYYY-MM-DD HH:mm:ss, DD/MM/YYYY HH:mm:ss, ISO 8601, RFC 2822"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Epoch Output Cards */}
          {result && (
            <div className="space-y-3 pt-2">
              {/* Epoch Seconds (Highlighted) */}
              <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/50 to-white dark:from-slate-800/80 dark:to-slate-900/80 shadow-sm relative group">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                  <span>{t.ui.epochSeconds}</span>
                  <button
                    onClick={() => copyToClipboard(result.seconds.toString(), "p2-sec")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 text-xs transition-colors"
                  >
                    {copiedKey === "p2-sec" ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 select-all tracking-tight">
                  {result.seconds}
                </div>
              </div>

              {/* Epoch Milliseconds (Highlighted) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>{t.ui.epochMillis}</span>
                  <button
                    onClick={() => copyToClipboard(result.milliseconds.toString(), "p2-ms")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs transition-colors"
                  >
                    {copiedKey === "p2-ms" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 select-all tracking-tight">
                  {result.milliseconds}
                </div>
              </div>

              {/* Micro & Nano */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>{t.ui.epochMicro}</span>
                    <button
                      onClick={() => copyToClipboard(result.microseconds, "p2-us")}
                      className="p-1 hover:text-slate-800 dark:hover:text-slate-100"
                    >
                      {copiedKey === "p2-us" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 select-all truncate">
                    {result.microseconds}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>{t.ui.epochNano}</span>
                    <button
                      onClick={() => copyToClipboard(result.nanoseconds, "p2-ns")}
                      className="p-1 hover:text-slate-800 dark:hover:text-slate-100"
                    >
                      {copiedKey === "p2-ns" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 select-all truncate">
                    {result.nanoseconds}
                  </div>
                </div>
              </div>

              {/* Normalized UTC Representation */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Normalized UTC ISO 8601:</span>
                  <code className="font-mono text-slate-700 dark:text-slate-300 select-all font-medium">
                    {result.isoUtc}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(result.isoUtc, "p2-utc")}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  {copiedKey === "p2-utc" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // Content Layout based on active view mode
  // -------------------------------------------------------------
  const customPanes = (
    <div className="flex-1 w-full">
      {viewMode === "dual" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {renderTimestampToDatePanel()}
          {renderDateToTimestampPanel()}
        </div>
      )}
      {viewMode === "timestamp-to-date" && (
        <div className="max-w-3xl mx-auto">
          {renderTimestampToDatePanel()}
        </div>
      )}
      {viewMode === "date-to-timestamp" && (
        <div className="max-w-3xl mx-auto">
          {renderDateToTimestampPanel()}
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      id="timestamp-converter"
      title="Timestamp / Date Converter"
      description="Convert Epoch Unix timestamp to human-readable date & time and vice-versa"
      icon={Clock}
      categoryName="Converters"
      configuration={configurationBar}
      customPanes={customPanes}
    />
  );
};
