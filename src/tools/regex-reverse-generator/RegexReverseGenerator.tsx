import React, { useState, useMemo } from "react";
import {
  Wand2,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import { ToolLayout } from "../../components/common/ToolLayout";
import {
  REGEX_PRESETS,
  generateRegexTestSuite,
  exportRegexCasesToMarkdown,
  exportRegexCasesToCsv,
} from "./regexReverseEngine";

export const RegexReverseGenerator: React.FC = () => {
  const { language } = useTranslation();
  const isVi = language === "vi";

  // Configuration
  const [selectedPresetId, setSelectedPresetId] = useState<string>("email");
  const [pattern, setPattern] = useState<string>(REGEX_PRESETS[0].pattern);
  const [flags, setFlags] = useState<string>("");
  const [variantCount, setVariantCount] = useState<number>(5);

  // Active view tab & filters
  const [activeTab, setActiveTab] = useState<"all" | "pass" | "fail">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live test string tester
  const [liveTestInput, setLiveTestInput] = useState<string>("");

  // Seed for regeneration
  const [seed, setSeed] = useState(0);

  // Load preset
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === "custom") return;
    const found = REGEX_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setPattern(found.pattern);
      setFlags(found.flags);
    }
  };

  // Generate test suite
  const suiteResult = useMemo(() => {
    return generateRegexTestSuite(pattern, flags, variantCount, isVi);
  }, [pattern, flags, variantCount, isVi, seed]);

  // Live test result
  const liveMatchStatus = useMemo(() => {
    if (!suiteResult.isValidRegex) return null;
    try {
      const reg = new RegExp(pattern, flags);
      return reg.test(liveTestInput);
    } catch {
      return null;
    }
  }, [pattern, flags, liveTestInput, suiteResult.isValidRegex]);

  // Filtered test cases
  const filteredCases = useMemo(() => {
    return suiteResult.testCases.filter((c) => {
      let matchesTab = true;
      if (activeTab === "pass") matchesTab = c.expected === "PASS";
      if (activeTab === "fail") matchesTab = c.expected === "FAIL";

      const matchesSearch =
        !searchQuery.trim() ||
        c.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [suiteResult.testCases, activeTab, searchQuery]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadCsv = () => {
    const csv = exportRegexCasesToCsv(suiteResult.testCases, isVi);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `regex_test_cases_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolLayout
      id="regex-reverse-generator"
      title={isVi ? "Bộ Sinh Chuỗi Kiểm Thử Regex (Regex Reverse & Fuzzer)" : "Regex Reverse Test String Generator"}
      description={isVi
        ? "Tự động dịch ngược Regular Expression để sinh ra các chuỗi thỏa mãn (Happy Path) và các chuỗi vi phạm tinh vi (Negative/Boundary) cho Tester."
        : "Reverse-engineer any Regular Expression to produce both valid matching strings and intelligent negative boundary cases for QA testing."}
      icon={Wand2}
      categoryName="graphic"
      titleBadge={
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          {isVi ? "Tự Động Sinh Test Cases" : "Positive & Negative Cases"}
        </span>
      }
      actionsRight={
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {isVi ? "Mẫu Regex:" : "Regex Library:"}
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium cursor-pointer shadow-sm transition-all"
          >
            {REGEX_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {isVi ? p.titleVi : p.title}
              </option>
            ))}
            <option value="custom">{isVi ? "Tự nhập Regex tùy chỉnh..." : "Custom Regex Pattern..."}</option>
          </select>
        </div>
      }
      customPanes={
        <div className="space-y-5">

      {/* Regex Pattern Input Card with Unified Input Styling */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isVi ? "Biểu Thức Chính Quy (Regular Expression Pattern):" : "Regular Expression Pattern:"}
            </label>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
                <input
                  type="checkbox"
                  checked={flags.includes("i")}
                  onChange={(e) => {
                    setSelectedPresetId("custom");
                    setFlags(e.target.checked ? flags + "i" : flags.replace("i", ""));
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Case-Insensitive (i)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
                <input
                  type="checkbox"
                  checked={flags.includes("m")}
                  onChange={(e) => {
                    setSelectedPresetId("custom");
                    setFlags(e.target.checked ? flags + "m" : flags.replace("m", ""));
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Multiline (m)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={pattern}
                onChange={(e) => {
                  setSelectedPresetId("custom");
                  setPattern(e.target.value);
                }}
                placeholder="^[a-zA-Z0-9]+@[a-zA-Z0-9]+\.[a-z]{2,}$"
                className="w-full h-10 font-mono text-xs px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={variantCount}
                onChange={(e) => setVariantCount(Number(e.target.value))}
                className="h-10 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
                title="Number of variations"
              >
                <option value={3}>3 {isVi ? "mẫu" : "variants"}</option>
                <option value={5}>5 {isVi ? "mẫu" : "variants"}</option>
                <option value={10}>10 {isVi ? "mẫu" : "variants"}</option>
              </select>

              <button
                onClick={() => setSeed((s) => s + 1)}
                className="h-10 px-4 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isVi ? "Tạo Lại" : "Regenerate"}</span>
              </button>
            </div>
          </div>

          {/* Error notice if regex syntax is invalid */}
          {!suiteResult.isValidRegex && (
            <div className="flex items-center gap-2 p-3 mt-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {isVi ? "Lỗi cú pháp Regex: " : "Invalid Regex syntax: "}
                {suiteResult.errorMessage}
              </span>
            </div>
          )}
        </div>

        {/* Live Interactive Tester */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {isVi ? "Kiểm tra chuỗi tức thì:" : "Live Match Verifier:"}
          </span>
          <div className="relative flex-1">
            <input
              type="text"
              value={liveTestInput}
              onChange={(e) => setLiveTestInput(e.target.value)}
              placeholder={isVi ? "Nhập thử bất kỳ chuỗi nào vào đây để kiểm tra..." : "Type any test string here to verify against regex..."}
              className="w-full h-9 font-mono text-xs px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          {liveTestInput.length > 0 && liveMatchStatus !== null && (
            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold">
              {liveMatchStatus ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  MATCH (Hợp Lệ)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800">
                  <XCircle className="w-4 h-4" />
                  NO MATCH (Không Khớp)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generated Test Cases View */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
          {/* Tabs: All / Pass / Fail */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              {isVi ? "Tất cả test cases" : "All Cases"} ({suiteResult.testCases.length})
            </button>

            <button
              onClick={() => setActiveTab("pass")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "pass"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-300/60 dark:border-emerald-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-emerald-600 font-medium"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {isVi ? "Chuỗi Hợp Lệ (Pass)" : "Matching (Pass)"}
            </button>

            <button
              onClick={() => setActiveTab("fail")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "fail"
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shadow-sm border border-rose-300/60 dark:border-rose-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-rose-600 font-medium"
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              {isVi ? "Chuỗi Bị Lỗi (Fail)" : "Mismatch (Fail)"}
            </button>
          </div>

          {/* Export bar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                handleCopy(exportRegexCasesToMarkdown(suiteResult.testCases, isVi), "markdown")
              }
              className="h-8 px-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all font-medium flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === "markdown" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{copiedKey === "markdown" ? (isVi ? "Đã chép" : "Copied") : "Markdown"}</span>
            </button>

            <button
              onClick={() =>
                handleCopy(exportRegexCasesToCsv(suiteResult.testCases, isVi), "csv")
              }
              className="h-8 px-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all font-medium flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === "csv" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{copiedKey === "csv" ? (isVi ? "Đã chép" : "Copied") : "CSV"}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isVi ? "Tìm kiếm test case, chuỗi hoặc lý do..." : "Search test cases by string, reason or category..."}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
        </div>

        {/* Cases Table View */}
        <div className="overflow-x-auto max-h-[500px] border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold z-10 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-28 text-center">{isVi ? "Dự Kiến" : "Expected"}</th>
                <th className="py-2.5 px-3 w-32">{isVi ? "Phân Loại" : "Category"}</th>
                <th className="py-2.5 px-3 min-w-[200px]">{isVi ? "Chuỗi Kiểm Thử (Input Value)" : "Test Input Value"}</th>
                <th className="py-2.5 px-3 min-w-[220px]">{isVi ? "Mục Tiêu / Lý Do Vi Phạm" : "Objective / Failure Reason"}</th>
                <th className="py-2.5 px-3 w-20 text-center">{isVi ? "Hành Động" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    {isVi ? "Không có test case nào" : "No test cases found"}
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 font-medium">
                      {c.id}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.expected === "PASS"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                        }`}
                      >
                        {c.expected === "PASS" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {c.expected}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-medium">
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {c.category}
                      </span>
                    </td>

                    <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100 break-all select-all">
                      {c.value === "" ? (
                        <span className="text-slate-400 italic font-normal">{"<Empty String>"}</span>
                      ) : (
                        <span>{c.value}</span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                      {c.reason}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleCopy(c.value, `case_${c.id}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all font-medium cursor-pointer"
                        title="Copy test input value"
                      >
                        {copiedKey === `case_${c.id}` ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === `case_${c.id}` ? (isVi ? "Đã chép" : "Copied") : isVi ? "Chép" : "Copy"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QA Guidance Card */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5 text-xs text-slate-700 dark:text-slate-300 space-y-2">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
          <HelpCircle className="w-4 h-4" />
          <span>
            {isVi
              ? "Cách QA Sử Dụng Tool Regex Fuzzer Này Hiệu Quả Nhất"
              : "How QA Can Leverage This Regex Reverse Tool"}
          </span>
        </div>
        <p className="leading-relaxed text-slate-600 dark:text-slate-300">
          {isVi
            ? "Khi nhận được yêu cầu tính năng (hoặc xem source code backend/frontend của Dev có regex validation): Bạn chỉ cần paste Regex vào đây. Tool sẽ tự động sinh ra các chuỗi Hợp lệ (Happy path) để test chức năng bình thường, và đặc biệt là các chuỗi Bất thường (Negative cases như chuỗi rỗng, lỗi khoảng trắng, cắt ngắn độ dài, tấn công XSS/SQLi) để kiểm tra xem hệ thống có bắt lỗi chặt chẽ hay không mà không cần phải vắt óc suy nghĩ từng ca test."
            : "Whenever you receive a feature requirement or review dev validation regex: Simply paste the pattern here. The tool automatically generates matching Happy Path variants as well as intelligent Negative boundary test cases (empty string, whitespace bypasses, length truncation, XSS/SQLi injection breakers) to verify rigorous input sanitization without manual guesswork."}
        </p>
      </div>
    </div>
  }
/>
);
};
