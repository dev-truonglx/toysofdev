import React, { useState, useMemo } from "react";
import {
  CheckCheck,
  Copy,
  Check,
  ShieldAlert,
  Sliders,
  FileSpreadsheet,
  FileCode,
  Search,
  Filter,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import {
  BoundaryType,
  StringConfig,
  NumberConfig,
  getSecurityPayloads,
  generateStringBoundaryCases,
  generateNumberBoundaryCases,
  generateEmailBoundaryCases,
  exportToMarkdownTable,
  exportToCsv,
} from "./boundaryEngine";

export const BoundaryTester: React.FC = () => {
  const { language, t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"bva" | "security">("bva");
  const [bvaType, setBvaType] = useState<BoundaryType>("string-length");

  // String config
  const [stringConfig, setStringConfig] = useState<StringConfig>({
    minLength: 6,
    maxLength: 30,
    charset: "alphanumeric",
  });

  // Number config
  const [numberConfig, setNumberConfig] = useState<NumberConfig>({
    minValue: 1,
    maxValue: 100,
    allowDecimals: false,
    decimalPlaces: 2,
  });

  // Filters & State
  const [filterType, setFilterType] = useState<"all" | "Valid" | "Invalid" | "Edge / Warning">("all");
  const [securityFilter, setSecurityFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Generated BVA cases
  const bvaCases = useMemo(() => {
    switch (bvaType) {
      case "string-length":
        return generateStringBoundaryCases(stringConfig, language);
      case "number-range":
        return generateNumberBoundaryCases(numberConfig, language);
      case "email-format":
        return generateEmailBoundaryCases(language);
      default:
        return generateStringBoundaryCases(stringConfig, language);
    }
  }, [bvaType, stringConfig, numberConfig, language]);

  const filteredBvaCases = useMemo(() => {
    return bvaCases.filter((c) => {
      let matchesFilter = filterType === "all";
      if (!matchesFilter) {
        if (filterType === "Valid") matchesFilter = c.type === "Valid" || c.type === "Hợp lệ";
        else if (filterType === "Invalid") matchesFilter = c.type === "Invalid" || c.type === "Không hợp lệ";
        else if (filterType === "Edge / Warning") matchesFilter = c.type === "Edge / Warning" || c.type === "Cảnh báo / Biên";
      }
      const matchesSearch =
        !searchQuery.trim() ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.testValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [bvaCases, filterType, searchQuery]);

  const securityPayloads = useMemo(() => {
    return getSecurityPayloads(language);
  }, [language]);

  const filteredSecurityPayloads = useMemo(() => {
    return securityPayloads.filter((p) => {
      const matchesGroup = securityFilter === "All" || p.group === securityFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.payload.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGroup && matchesSearch;
    });
  }, [securityPayloads, securityFilter, searchQuery]);

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  const handleExportMarkdown = () => {
    const md = exportToMarkdownTable(filteredBvaCases, language);
    navigator.clipboard.writeText(md);
    setExportFeedback(t.boundaryTester.copiedMarkdown);
    setTimeout(() => setExportFeedback(null), 2000);
  };

  const handleExportCsv = () => {
    const csv = exportToCsv(filteredBvaCases, language);
    navigator.clipboard.writeText(csv);
    setExportFeedback(t.boundaryTester.copiedCsv);
    setTimeout(() => setExportFeedback(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {t.boundaryTester.title}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {t.boundaryTester.qaBadge}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t.boundaryTester.description}
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700/80 text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("bva")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "bva"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{t.boundaryTester.bvaTab}</span>
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "security"
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{t.boundaryTester.securityTab}</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === "bva" ? (
        <div className="space-y-6">
          {/* Configuration Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.boundaryTester.targetFieldRule}
                </span>
                <select
                  value={bvaType}
                  onChange={(e) => setBvaType(e.target.value as BoundaryType)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="string-length">{t.boundaryTester.ruleStringLength}</option>
                  <option value="number-range">{t.boundaryTester.ruleNumberRange}</option>
                  <option value="email-format">{t.boundaryTester.ruleEmailFormat}</option>
                </select>
              </div>

              {/* Export Actions */}
              <div className="flex items-center gap-2">
                {exportFeedback && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in">
                    {exportFeedback}
                  </span>
                )}
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                  title="Copy as Markdown table for Jira or PR"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{t.boundaryTester.copyMarkdown}</span>
                </button>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                  title="Copy as CSV for Excel or TestRail"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t.boundaryTester.copyCsv}</span>
                </button>
              </div>
            </div>

            {/* Dynamic Controls based on BVA type */}
            {bvaType === "string-length" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                    {t.boundaryTester.minChars}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stringConfig.minLength}
                    onChange={(e) =>
                      setStringConfig({ ...stringConfig, minLength: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                    {t.boundaryTester.maxChars}
                  </label>
                  <input
                    type="number"
                    min={stringConfig.minLength}
                    value={stringConfig.maxLength}
                    onChange={(e) =>
                      setStringConfig({ ...stringConfig, maxLength: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-end">
                  <div className="h-10 px-3.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between font-semibold">
                    <span>{t.boundaryTester.boundaryRange}</span>
                    <span className="font-mono bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded text-indigo-800 dark:text-indigo-200">
                      {stringConfig.minLength} → {stringConfig.maxLength}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {bvaType === "number-range" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                    {t.boundaryTester.minNumber}
                  </label>
                  <input
                    type="number"
                    value={numberConfig.minValue}
                    onChange={(e) =>
                      setNumberConfig({ ...numberConfig, minValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                    {t.boundaryTester.maxNumber}
                  </label>
                  <input
                    type="number"
                    value={numberConfig.maxValue}
                    onChange={(e) =>
                      setNumberConfig({ ...numberConfig, maxValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={numberConfig.allowDecimals}
                      onChange={(e) => setNumberConfig({ ...numberConfig, allowDecimals: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.boundaryTester.allowDecimals}
                    </span>
                  </label>
                </div>
                {numberConfig.allowDecimals && (
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 h-4 flex items-center">
                      {t.boundaryTester.decimalPlaces}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={numberConfig.decimalPlaces}
                      onChange={(e) =>
                        setNumberConfig({ ...numberConfig, decimalPlaces: parseInt(e.target.value) || 2 })
                      }
                      className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Cases Table Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.boundaryTester.filterStatus}</span>
                <div className="flex gap-1.5 text-xs">
                  {([
                    { key: "all", label: `${t.boundaryTester.filterAll} (${bvaCases.length})` },
                    { key: "Valid", label: t.boundaryTester.filterValid },
                    { key: "Invalid", label: t.boundaryTester.filterInvalid },
                    { key: "Edge / Warning", label: t.boundaryTester.filterEdge },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilterType(key)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        filterType === key
                          ? "bg-indigo-600 text-white font-semibold"
                          : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.boundaryTester.searchCasesPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 w-48 sm:w-60"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 font-bold">{t.boundaryTester.colCategoryType}</th>
                    <th className="py-3 px-4 font-bold">{t.boundaryTester.colTitle}</th>
                    <th className="py-3 px-4 font-bold">{t.boundaryTester.colValue}</th>
                    <th className="py-3 px-4 font-bold">{t.boundaryTester.colExpected}</th>
                    <th className="py-3 px-4 font-bold text-right">{t.boundaryTester.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
                  {filteredBvaCases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {c.category}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                              c.type === "Valid" || c.type === "Hợp lệ"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : c.type === "Invalid" || c.type === "Không hợp lệ"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {c.type}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {c.description}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <div className="font-mono text-xs bg-slate-100 dark:bg-slate-900/90 text-indigo-600 dark:text-indigo-400 p-1.5 rounded border border-slate-200 dark:border-slate-800 break-all select-all">
                          {c.testValue === '""' ? t.boundaryTester.emptyString : c.testValue}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {c.expectedResult}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleCopyText(c.id, c.testValue === '""' ? "" : c.testValue)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Copy test value"
                        >
                          {copiedId === c.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span className="text-[10px] font-semibold">{copiedId === c.id ? t.boundaryTester.copied : t.boundaryTester.copy}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Security Payloads Tab */
        <div className="space-y-6">
          {/* Security Filter & Search */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                  {t.boundaryTester.payloadType}
                </span>
                {[
                  { key: "All", label: t.boundaryTester.groupAll },
                  { key: "XSS", label: t.boundaryTester.groupXss },
                  { key: "SQL Injection", label: t.boundaryTester.groupSqli },
                  { key: "NoSQL Injection", label: t.boundaryTester.groupNosqli },
                  { key: "Command Injection", label: t.boundaryTester.groupCmd },
                  { key: "Path Traversal", label: t.boundaryTester.groupPathTraversal },
                  { key: "String Breakers", label: t.boundaryTester.groupStringBreakers },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSecurityFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      securityFilter === key
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.boundaryTester.searchPayloadsPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800 dark:text-slate-200 w-60"
                />
              </div>
            </div>
          </div>

          {/* Payloads List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSecurityPayloads.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm flex flex-col justify-between gap-3 hover:border-rose-400 dark:hover:border-rose-500/60 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                      {p.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {p.group}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                    {p.description}
                  </p>

                  <div className="relative">
                    <pre className="font-mono text-xs p-2.5 rounded-lg bg-slate-900 text-rose-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all select-all">
                      {p.payload}
                    </pre>
                  </div>

                  {p.exampleScenario && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-[11px] leading-relaxed">
                      <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-0.5">
                        💡 {t.boundaryTester.exampleScenario}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {p.exampleScenario}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 italic">
                    {t.boundaryTester.expected} {p.expectedBehavior}
                  </span>
                  <button
                    onClick={() => handleCopyText(p.id, p.payload)}
                    className="p-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 font-semibold text-xs cursor-pointer"
                  >
                    {copiedId === p.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === p.id ? t.boundaryTester.copied : t.boundaryTester.copyPayload}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
