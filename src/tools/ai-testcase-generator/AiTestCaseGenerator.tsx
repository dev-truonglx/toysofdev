import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Upload,
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  Settings,
  ArrowRight,
  RotateCcw,
  Search,
  ChevronRight,
  Sliders,
  HelpCircle,
  Eye,
  FileCheck,
  Bot,
  Terminal,
  Clock,
  Loader2,
  Zap,
} from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import {
  AIConfig,
  DEFAULT_AI_CONFIG,
  loadAIConfigFromDisk,
} from "../../services/storeService";
import { AISettingsModal } from "./AISettingsModal";
import {
  IngestionResult,
  DeconstructionResult,
  TestCase,
  AuditResult,
  GeneratorPreferences,
  DEFAULT_PREFERENCES,
  GenerationStep,
  AgentProgress,
} from "./types";
import { ingestDocument } from "./documentParser";
import { runSpecAnalystAgent } from "./specAnalystEngine";
import { runMultiTierGeneratorCrew } from "./multiTierEngine";
import { runAuditEngine } from "./auditEngine";
import {
  exportToExcel,
  exportToJiraXrayCsv,
  exportToTestRailCsv,
  exportToBddFeature,
  downloadFile,
} from "./exportEngine";

const SAMPLE_SPEC_TEXT = `# HỆ THỐNG ĐẶT PHÒNG KHÁCH SẠN TRỰC TUYẾN (BOOKING ENGINE)

## 1. Yêu cầu chức năng
Hệ thống cho phép khách hàng tìm kiếm và đặt phòng khách sạn. Người dùng chọn điểm đến, ngày nhận phòng, ngày trả phòng và số lượng khách.

## 2. Quy tắc nghiệp vụ (Business Rules)
- Tên khách hàng: bắt buộc, độ dài từ 2 đến 50 ký tự, hỗ trợ tiếng Việt có dấu.
- Email liên hệ: định dạng chuẩn RFC 5322 (ví dụ: khachhang@domain.com).
- Số điện thoại: 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09.
- Ngày nhận phòng: không được là ngày trong quá khứ.
- Ngày trả phòng: phải sau ngày nhận phòng tối thiểu 1 đêm và tối đa 30 đêm.
- Số lượng khách: từ 1 đến 10 người mỗi phòng.
- Khi chọn phương thức thanh toán = "Thẻ tín dụng", bắt buộc nhập Số thẻ (16 chữ số), Ngày hết hạn (MM/YY) và Mã CVV (3 chữ số).

## 3. Ma trận phân quyền (RBAC Matrix)
| Chức năng | Khách (Guest) | Khách hàng đăng nhập (User) | Quản lý khách sạn (Manager) | Quản trị viên (Admin) |
|---|---|---|---|---|
| Tìm kiếm phòng | Cho phép | Cho phép | Cho phép | Cho phép |
| Đặt phòng | Cho phép | Cho phép | Từ chối | Cho phép |
| Hủy đơn đặt phòng | Từ chối | Trong vòng 24h | Toàn quyền | Toàn quyền |
| Chỉnh sửa giá phòng | Từ chối | Từ chối | Cho phép | Cho phép |

## 4. Xử lý sự cố và gián đoạn
- Hệ thống xử lý giao dịch tức thì và trả về mã đặt chỗ.
- Hỗ trợ tải lên các tệp xác nhận thanh toán thông dụng.`;

export const AiTestCaseGenerator: React.FC = () => {
  const { language } = useTranslation();
  const isVi = language === "vi";

  // AI Configuration state
  const [aiConfig, setAiConfig] = useState<AIConfig>({ ...DEFAULT_AI_CONFIG });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Workflow State
  const [step, setStep] = useState<GenerationStep>("ingestion");
  const [rawInputText, setRawInputText] = useState(SAMPLE_SPEC_TEXT);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<GeneratorPreferences>({
    ...DEFAULT_PREFERENCES,
  });

  // Intermediate Engine Data
  const [, setIngestionResult] = useState<IngestionResult | null>(null);
  const [deconstruction, setDeconstruction] = useState<DeconstructionResult | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  // Progress Tracking
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([]);
  const [currentAgentMessage, setCurrentAgentMessage] = useState("");

  // Filters & Search for Test Suite View
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [activeOutputTab, setActiveOutputTab] = useState<"cases" | "rtm" | "questions" | "export">("cases");
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [deconstructionStatus, setDeconstructionStatus] = useState<{
    stage: "prepare" | "execute" | "validating" | "offline";
    message: string;
    elapsedSeconds: number;
    logs: { time: string; text: string }[];
  }>({
    stage: "prepare",
    message: "",
    elapsedSeconds: 0,
    logs: [],
  });

  // Load config on mount
  useEffect(() => {
    loadAIConfigFromDisk().then(setAiConfig);
  }, []);

  const hasConfiguredKey = useMemo(() => {
    if (aiConfig.provider === "local-cli") {
      return true;
    }
    if (aiConfig.provider === "gemini") {
      return aiConfig.geminiApiKey.trim().length > 5;
    }
    return aiConfig.claudeApiKey.trim().length > 5;
  }, [aiConfig]);

  // Handle File Upload (.docx, .xlsx, .md, .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIngesting(true);
    try {
      const res = await ingestDocument(file);
      setIngestionResult(res);
      setRawInputText(res.cleanedContent);
      setUploadedFileName(file.name);
    } catch (err: any) {
      alert(`Lỗi khi đọc file: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  // Step 1 -> Step 2: Trigger Deconstruction
  const handleStartDeconstruction = async () => {
    if (!rawInputText.trim()) {
      alert(isVi ? "Vui lòng nhập hoặc tải file tài liệu đặc tả!" : "Please provide specification content!");
      return;
    }

    const providerLabel =
      aiConfig.provider === "local-cli"
        ? `Local CLI (agy - ${aiConfig.localCliModel || "gemini-3.8-flash-high"})`
        : aiConfig.provider === "gemini"
        ? `Google Gemini (${aiConfig.geminiModel})`
        : `Anthropic Claude (${aiConfig.claudeModel})`;

    setIsIngesting(true);
    setStep("deconstruction");
    setDeconstructionStatus({
      stage: "prepare",
      message: isVi
        ? "Đang đọc & chuẩn hóa cấu trúc văn bản đặc tả..."
        : "Parsing and normalizing specification document...",
      elapsedSeconds: 0,
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          text: isVi
            ? `Khởi động bộ phân rã đặc tả với ${providerLabel} (${rawInputText.length.toLocaleString()} ký tự)`
            : `Starting spec analyst with ${providerLabel} (${rawInputText.length.toLocaleString()} chars)`,
        },
      ],
    });

    const timer = setInterval(() => {
      setDeconstructionStatus((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }));
    }, 1000);

    try {
      const parsedDoc = await ingestDocument(rawInputText, uploadedFileName || undefined);
      setIngestionResult(parsedDoc);

      setDeconstructionStatus((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            time: new Date().toLocaleTimeString(),
            text: isVi
              ? `Tài liệu đã chuẩn hóa (${parsedDoc.cleanedContent.length.toLocaleString()} ký tự, ${parsedDoc.chunks.length} phân đoạn)`
              : `Document AST ready (${parsedDoc.cleanedContent.length.toLocaleString()} chars, ${parsedDoc.chunks.length} chunks)`,
          },
        ],
      }));

      const decomp = await runSpecAnalystAgent(
        parsedDoc.cleanedContent,
        aiConfig,
        (stage, msg) => {
          setDeconstructionStatus((prev) => ({
            ...prev,
            stage: stage as any,
            message: msg,
            logs: [
              ...prev.logs,
              {
                time: new Date().toLocaleTimeString(),
                text: msg,
              },
            ],
          }));
        }
      );
      setDeconstruction(decomp);

      if (preferences.humanInTheLoop) {
        setStep("review_pause");
      } else {
        handleExecuteGeneration(decomp, parsedDoc.cleanedContent);
      }
    } catch (err: any) {
      alert(`Error during analysis: ${err.message}`);
      setStep("ingestion");
    } finally {
      clearInterval(timer);
      setIsIngesting(false);
    }
  };

  // Step 2 / 3 -> Step 4: Execute Multi-Agent Test Generation
  const handleExecuteGeneration = async (
    decompData?: DeconstructionResult,
    specContent?: string
  ) => {
    const targetDecomp = decompData || deconstruction;
    const targetSpec = specContent || rawInputText;
    if (!targetDecomp) return;

    setStep("generation");
    setAgentProgress([
      { agentName: "Functional QA Agent", status: "running", message: "Designing Happy Path scenarios..." },
      { agentName: "Boundary & Equivalence Agent", status: "pending", message: "Awaiting BVA data analysis..." },
      { agentName: "Negative & Edge Case Agent", status: "pending", message: "Queued..." },
      { agentName: "Security & RBAC Agent", status: "pending", message: "Queued..." },
      { agentName: "QA Lead Auditor", status: "pending", message: "Queued for RTM check..." },
    ]);

    try {
      const rawCases = await runMultiTierGeneratorCrew(
        targetDecomp,
        preferences,
        aiConfig,
        (progress) => {
          setCurrentAgentMessage(progress.message);
        }
      );

      // Run Audit Engine (RTM >= 95%, Hallucination check, Deduplication)
      const { auditedCases, auditReport } = runAuditEngine(
        targetDecomp,
        rawCases,
        targetSpec
      );

      setTestCases(auditedCases);
      setAuditResult(auditReport);
      setStep("complete");
    } catch (err: any) {
      alert(`Error during testcase generation: ${err.message}`);
      setStep("review_pause");
    }
  };

  // Reset workflow
  const handleReset = () => {
    setStep("ingestion");
    setDeconstruction(null);
    setTestCases([]);
    setAuditResult(null);
    setUploadedFileName(null);
  };

  // Filtered Test Cases
  const filteredCases = useMemo(() => {
    return testCases.filter((tc) => {
      const matchesSearch =
        !searchQuery.trim() ||
        tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.reqId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.testData.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.expectedResult.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || tc.category === selectedCategory;

      const matchesPriority =
        selectedPriority === "all" || tc.priority === selectedPriority;

      return matchesSearch && matchesCategory && matchesPriority;
    });
  }, [testCases, searchQuery, selectedCategory, selectedPriority]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(label);
    setTimeout(() => setCopiedNotification(null), 1500);
  };

  return (
    <ToolLayout
      id="ai-testcase-generator"
      title={isVi ? "AI Test Case Generator Agent (Chuẩn ISTQB)" : "AI Test Case Generator Agent (ISTQB Compliant)"}
      description={
        isVi
          ? "Tự động phân rã tài liệu BA Spec/PRD, sinh bộ test case toàn diện đa tầng với dàn Agent chuyên trách"
          : "Autonomous multi-tier test case engineering from BRD/PRD specifications with dedicated QA agents"
      }
      icon={Bot}
      categoryName={isVi ? "Đồ họa & Kiểm thử" : "Graphics & QA Testing"}
      actionsRight={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              hasConfiguredKey
                ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 animate-pulse"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>
              {aiConfig.provider === "local-cli"
                ? `Local CLI (${aiConfig.localCliModel || "gemini-3.8-flash-high"})`
                : aiConfig.provider === "gemini"
                ? `Gemini: ${aiConfig.geminiModel}`
                : `Claude: ${aiConfig.claudeModel}`}
            </span>
            {!hasConfiguredKey && (
              <span className="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
                {isVi ? "Chưa có Key" : "No Key"}
              </span>
            )}
          </button>
        </div>
      }
      customPanes={
        <div className="space-y-6">
        {/* Workflow Stepper Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  step === "ingestion"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {step === "ingestion" ? "1" : <Check className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {isVi ? "1. Tiếp nhận tài liệu" : "1. Document Ingestion"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isVi ? "Upload .docx, .xlsx, .md hoặc dán spec" : "Parse and clean spec"}
                </div>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  step === "deconstruction" || step === "review_pause"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : step === "generation" || step === "complete"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                {step === "complete" ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {isVi ? "2. Phân rã nghiệp vụ" : "2. Spec Deconstruction"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isVi ? "Flows, Rules, REQ_xxx, Điểm mờ" : "Rules & Acceptance Criteria"}
                </div>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  step === "generation"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 animate-pulse"
                    : step === "complete"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                {step === "complete" ? <Check className="w-4 h-4" /> : "3"}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {isVi ? "3. Sinh Test Suite đa tầng" : "3. Multi-Agent Run"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isVi ? "Functional, BVA, Negative, Security" : "Specialist QA Agents"}
                </div>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  step === "complete"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                4
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {isVi ? "4. Quản lý & Xuất file" : "4. Hub & Export"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isVi ? "Excel, Jira, TestRail, BDD Gherkin" : "RTM & Multi-format export"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 1: INGESTION VIEW */}
        {step === "ingestion" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Input Textarea & Drag Drop */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>
                      {isVi ? "Tài liệu yêu cầu nghiệp vụ (PRD / BA Spec / User Stories)" : "Specification Input"}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer border border-indigo-200 dark:border-indigo-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadedFileName || (isVi ? "Tải lên file (.docx, .xlsx, .md)" : "Upload File")}</span>
                    <input
                      type="file"
                      accept=".docx,.xlsx,.xls,.md,.txt,.html"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="relative">
                  <textarea
                    rows={16}
                    value={rawInputText}
                    onChange={(e) => setRawInputText(e.target.value)}
                    placeholder={
                      isVi
                        ? "Dán nội dung tài liệu nghiệp vụ, User Story, hoặc ma trận ràng buộc vào đây..."
                        : "Paste requirements specification, user stories, or data tables here..."
                    }
                    className="w-full p-4 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
                  />
                  {rawInputText && (
                    <div className="absolute right-3 bottom-3 text-[11px] text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur">
                      {rawInputText.length.toLocaleString()} ký tự
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Preferences & Scope Filter */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>{isVi ? "Cấu hình sinh Test Case" : "Generation Preferences"}</span>
                </div>

                {/* Granularity */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isVi ? "Mức độ chi tiết (Granularity)" : "Granularity"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreferences({ ...preferences, granularity: "detailed" })}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        preferences.granularity === "detailed"
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-bold">{isVi ? "Chi tiết (Detailed)" : "Detailed"}</div>
                      <div className="text-[10px] text-slate-400">Preconditions, steps, concrete data</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreferences({ ...preferences, granularity: "high-level" })}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        preferences.granularity === "high-level"
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <div className="font-bold">{isVi ? "Tổng quan (High-level)" : "High-Level"}</div>
                      <div className="text-[10px] text-slate-400">Smoke & Sanity checks</div>
                    </button>
                  </div>
                </div>

                {/* Scope Filter */}
                <div className="space-y-2.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isVi ? "Phạm vi kiểm thử (Scope Filters)" : "Test Scope Categories"}
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: "functional", label: "Functional & Happy Path", desc: "Luồng chính và xác thực lưu vết" },
                      { key: "boundary", label: "Boundary & Data (BVA)", desc: "Phân tích giá trị biên Min/Max cụ thể" },
                      { key: "negative", label: "Negative & Edge Cases", desc: "Double click, Back, Session Timeout" },
                      { key: "security", label: "Security (SQLi / XSS)", desc: "Kiểm thử injection mức giao diện" },
                      { key: "rbac", label: "Phân quyền (RBAC Matrix)", desc: "Quyền CRUD cho từng Role" },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={preferences.enabledCategories[item.key as keyof typeof preferences.enabledCategories]}
                          onChange={(e) =>
                            setPreferences({
                              ...preferences,
                              enabledCategories: {
                                ...preferences.enabledCategories,
                                [item.key]: e.target.checked,
                              },
                            })
                          }
                          className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">{item.label}</div>
                          <div className="text-[10px] text-slate-400">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Human in the loop toggle */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={preferences.humanInTheLoop}
                      onChange={(e) => setPreferences({ ...preferences, humanInTheLoop: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{isVi ? "Tạm dừng để duyệt Acceptance Criteria (Module 6.3)" : "Human-in-the-loop review"}</span>
                  </label>
                </div>

                {/* Unconfigured Key Tip */}
                {!hasConfiguredKey && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{isVi ? "Chưa có API Key AI:" : "No AI Key:"}</span>{" "}
                      {isVi
                        ? "Hệ thống sẽ chạy thuật toán bóc tách Offline. Để dùng mô hình Gemini / Claude thực tế, hãy bấm nút Cấu hình ở góc trên để nhập Key."
                        : "System will run deterministic offline heuristic. To use real Gemini/Claude, configure key above."}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={handleStartDeconstruction}
                  disabled={isIngesting}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {hasConfiguredKey
                      ? isVi
                        ? `Bóc tách với ${
                            aiConfig.provider === "local-cli"
                              ? "Local CLI"
                              : aiConfig.provider === "gemini"
                              ? "Gemini"
                              : "Claude"
                          }`
                        : `Deconstruct with ${
                            aiConfig.provider === "local-cli"
                              ? "Local CLI"
                              : aiConfig.provider === "gemini"
                              ? "Gemini"
                              : "Claude"
                          }`
                      : isVi
                      ? "Bóc tách & Phân tích nghiệp vụ"
                      : "Deconstruct & Analyze"}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2-A: LIVE DECONSTRUCTION & CLI RUNNING VIEW */}
        {step === "deconstruction" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Main Status Hero Card */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="relative p-3.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 shrink-0">
                    {aiConfig.provider === "local-cli" ? (
                      <Terminal className="w-7 h-7 animate-pulse text-emerald-300" />
                    ) : aiConfig.provider === "gemini" ? (
                      <Sparkles className="w-7 h-7 animate-pulse text-blue-300" />
                    ) : (
                      <Zap className="w-7 h-7 animate-pulse text-amber-300" />
                    )}
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isVi ? "Đang phân rã nghiệp vụ & bóc tách cấu trúc kiểm thử" : "Deconstructing Specification & Flows"}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        aiConfig.provider === "local-cli"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                      }`}>
                        {aiConfig.provider === "local-cli" ? (
                          <>
                            <Terminal className="w-3 h-3" />
                            Local CLI (agy)
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            {aiConfig.provider.toUpperCase()} API
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-500" />
                      <span>{deconstructionStatus.message || (isVi ? "AI đang tiến hành phân tích sâu tài liệu..." : "AI analyzing...")}</span>
                    </p>
                  </div>
                </div>

                {/* Right timer badge & Cancel button */}
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center gap-2.5 text-xs font-mono">
                    <Clock className="w-4 h-4 text-slate-500 animate-spin" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{isVi ? "Thời gian chạy" : "Elapsed"}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {Math.floor(deconstructionStatus.elapsedSeconds / 60)
                          .toString()
                          .padStart(2, "0")}
                        :
                        {(deconstructionStatus.elapsedSeconds % 60)
                          .toString()
                          .padStart(2, "0")}s
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("ingestion");
                      setIsIngesting(false);
                    }}
                    className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                  >
                    {isVi ? "Hủy bỏ" : "Cancel"}
                  </button>
                </div>
              </div>

              {/* Progress Milestones Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-6">
                <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-800/60 border-emerald-200 dark:border-emerald-800/50 shadow-sm flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      1. {isVi ? "Tiếp nhận đặc tả" : "Document Ingestion"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isVi ? `${rawInputText.length.toLocaleString()} ký tự chuẩn hóa` : "Normalized AST"}
                    </div>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  deconstructionStatus.stage === "execute" || deconstructionStatus.stage === "validating"
                    ? "bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20"
                    : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800"
                }`}>
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      2. {isVi ? "Thực thi AI Model" : "AI Execution"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                      {aiConfig.provider === "local-cli"
                        ? `agy: ${aiConfig.localCliModel || "gemini-3.8-flash-high"}`
                        : aiConfig.provider === "gemini"
                        ? aiConfig.geminiModel
                        : aiConfig.claudeModel}
                    </div>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  deconstructionStatus.stage === "validating"
                    ? "bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20"
                    : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 opacity-60"
                }`}>
                  <Layers className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      3. {isVi ? "Bóc tách cấu trúc ISTQB" : "ISTQB Extraction"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isVi ? "Flows, Rules, AC & Gaps" : "Flows & Rules"}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 opacity-60 flex items-start gap-3">
                  <Check className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      4. {isVi ? "Xác nhận & Review" : "Human Review"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isVi ? "Sẵn sàng tinh chỉnh" : "Ready for review"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational Guidance Note */}
              {aiConfig.provider === "local-cli" && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <Terminal className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>
                      {isVi
                        ? "Tiến trình đang chạy ngầm trên máy thông qua Local CLI và được trừ trực tiếp vào tài khoản Google One cá nhân của bạn (không tốn quota API Key)."
                        : "Running locally via CLI, charged directly to your personal Google One subscription."}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                    ~5-15s
                  </span>
                </div>
              )}
            </div>

            {/* Live Terminal / Activity Console Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl text-xs font-mono space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                  </div>
                  <span className="text-slate-300 font-semibold ml-2">
                    {aiConfig.provider === "local-cli" ? "agy --print (Local CLI Execution)" : "AI Engine Stream"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE EXECUTION
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1 text-slate-300">
                {deconstructionStatus.logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed animate-in fade-in">
                    <span className="text-slate-500 select-none">[{log.time}]</span>
                    <span className="text-emerald-400 font-bold select-none">&gt;</span>
                    <span className={index === deconstructionStatus.logs.length - 1 ? "text-indigo-200 font-medium" : "text-slate-300"}>
                      {log.text}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-1 text-emerald-400 animate-pulse pt-1">
                  <span>&gt;</span>
                  <span className="w-2 h-4 bg-emerald-400 inline-block animate-pulse"></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & DECONSTRUCTION PAUSE VIEW (Human-in-the-loop) */}
        {step === "review_pause" && deconstruction && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                      {isVi ? "Báo cáo phân rã nghiệp vụ (Spec Analyst Agent)" : "Business Deconstruction Review"}
                    </h3>
                    {deconstruction.usedAI ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        AI: {deconstruction.aiProvider?.toUpperCase()} ({deconstruction.aiModel})
                      </span>
                    ) : (
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
                        title={isVi ? "Bấm vào để cấu hình API Key" : "Click to configure API Key"}
                      >
                        <Sliders className="w-3 h-3 text-amber-600" />
                        <span>{isVi ? "Chế độ: Heuristic Offline (Bấm để nhập Key)" : "Mode: Offline Heuristic"}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                    {deconstruction.summary}
                  </p>
                  {deconstruction.aiError && (
                    <div className="mt-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-300/50">
                      {deconstruction.aiError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  {isVi ? "Quay lại" : "Back"}
                </button>
                <button
                  onClick={() => handleExecuteGeneration()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isVi ? "Phê duyệt & Sinh hàng loạt Test Case" : "Approve & Generate Test Suite"}</span>
                </button>
              </div>
            </div>

            {/* 3 Columns: User Flows, Business Rules, Clarification Questions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Flows */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span>{isVi ? "Luồng người dùng (User Flows)" : "User Flows"}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 text-xs font-semibold">
                    {deconstruction.flows.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {deconstruction.flows.map((flow) => (
                    <div
                      key={flow.id}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{flow.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            flow.type === "main"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : flow.type === "exception"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {flow.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{flow.description}</p>
                      <div className="space-y-1 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                        {flow.steps.map((st, i) => (
                          <div key={i} className="text-[10px] text-slate-600 dark:text-slate-400 flex items-start gap-1">
                            <span className="text-slate-400 shrink-0">•</span>
                            <span>{st}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules & Acceptance Criteria */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>{isVi ? "Tiêu chí chấp thuận (AC / Rules)" : "Rules & Acceptance"}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-xs font-semibold">
                    {deconstruction.acceptanceCriteria.length} ACs
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {deconstruction.acceptanceCriteria.map((ac) => (
                    <div
                      key={ac.id}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">{ac.id}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">{ac.flowType}</span>
                      </div>
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">{ac.title}</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{ac.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clarification Questions */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                    <HelpCircle className="w-4 h-4 text-amber-500" />
                    <span>{isVi ? "Câu hỏi làm rõ nghiệp vụ" : "Clarification Questions"}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 text-xs font-semibold">
                    {deconstruction.clarificationQuestions.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {deconstruction.clarificationQuestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {isVi ? "Không phát hiện điểm mờ hoặc mơ hồ nào!" : "No ambiguity detected."}
                    </div>
                  ) : (
                    deconstruction.clarificationQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-amber-900 dark:text-amber-200">{q.id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold">
                            {q.impact} Impact
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{q.question}</p>
                        <div className="text-[10px] text-slate-400 italic">Ngữ cảnh: {q.context}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RUNNING GENERATION STEPPER VIEW */}
        {step === "generation" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-6 max-w-xl mx-auto shadow-sm animate-in fade-in">
            <div className="relative flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {isVi ? "Dàn Agent đang đồng thời sinh Test Cases..." : "Specialist QA Agents are generating test suites..."}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentAgentMessage || (isVi ? "Đang áp dụng tiêu chuẩn ISTQB và tính toán giá trị BVA cụ thể..." : "Computing ISTQB boundary values and security matrices...")}
              </p>
            </div>

            <div className="space-y-2 text-left pt-4 border-t border-slate-100 dark:border-slate-800">
              {agentProgress.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{p.agentName}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">{p.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETE HUB & EXPORT VIEW */}
        {step === "complete" && auditResult && deconstruction && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {isVi ? "Tổng số Test Cases" : "Total Test Cases"}
                  </span>
                  <Layers className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {testCases.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {isVi ? "Phủ 5 danh mục ISTQB" : "Across 5 categories"}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {isVi ? "Độ bao phủ RTM" : "RTM Coverage"}
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {auditResult.coveragePercentage}%
                </div>
                <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                  {auditResult.coveredACs}/{auditResult.totalACs} ACs (Tiêu chuẩn &ge; 95%)
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {isVi ? "Đã lọc trùng lặp" : "Deduplicated"}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {auditResult.deduplicatedCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {isVi ? "Loại bỏ ca thừa" : "Semantic deduplication"}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {isVi ? "Cảnh báo ảo giác" : "Hallucination Check"}
                  </span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {auditResult.hallucinationWarnings.length === 0 ? "0 (Sạch)" : auditResult.hallucinationWarnings.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {isVi ? "Đối soát spec gốc" : "Factuality verified"}
                </div>
              </div>
            </div>

            {/* Navigation Tabs & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveOutputTab("cases")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activeOutputTab === "cases"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {isVi ? `Test Cases (${filteredCases.length})` : `Test Cases (${filteredCases.length})`}
                </button>

                <button
                  onClick={() => setActiveOutputTab("rtm")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activeOutputTab === "rtm"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {isVi ? "Ma trận RTM" : "RTM Matrix"}
                </button>

                <button
                  onClick={() => setActiveOutputTab("questions")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activeOutputTab === "questions"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {isVi ? `Clarification Log (${deconstruction.clarificationQuestions.length})` : "Clarification Log"}
                </button>

                <button
                  onClick={() => setActiveOutputTab("export")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activeOutputTab === "export"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {isVi ? "Xuất dữ liệu & Tích hợp" : "Export Hub"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isVi ? "Làm mới / Tài liệu khác" : "New Spec"}</span>
                </button>

                {/* Instant Excel Download */}
                <button
                  onClick={() => exportToExcel(testCases, deconstruction, auditResult)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isVi ? "Tải Excel (.xlsx)" : "Export Excel (.xlsx)"}</span>
                </button>
              </div>
            </div>

            {/* TAB 1: TEST CASES LIST */}
            {activeOutputTab === "cases" && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isVi ? "Tìm theo ID, tiêu đề, dữ liệu kiểm thử..." : "Search test cases..."}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="all">{isVi ? "Tất cả danh mục" : "All Categories"}</option>
                    <option value="functional">Functional</option>
                    <option value="boundary">Boundary (BVA)</option>
                    <option value="negative">Negative</option>
                    <option value="security">Security</option>
                    <option value="rbac">RBAC</option>
                  </select>

                  {/* Priority Filter */}
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="all">{isVi ? "Tất cả mức độ" : "All Priorities"}</option>
                    <option value="P1">P1 - Critical</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>
                </div>

                {/* Test Cases Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px]">
                          <th className="py-3 px-4">Test ID</th>
                          <th className="py-3 px-3">Req ID</th>
                          <th className="py-3 px-3">Category</th>
                          <th className="py-3 px-2">Priority</th>
                          <th className="py-3 px-4">Test Scenario / Title</th>
                          <th className="py-3 px-4">Concrete Test Data</th>
                          <th className="py-3 px-4">Expected Result</th>
                          <th className="py-3 px-3 text-right">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                        {filteredCases.map((tc) => (
                          <tr
                            key={tc.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {tc.id}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                              {tc.reqId}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                  tc.category === "functional"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                    : tc.category === "boundary"
                                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                    : tc.category === "negative"
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                    : tc.category === "security"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                    : "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                }`}
                              >
                                {tc.category}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                                  tc.priority === "P1"
                                    ? "bg-rose-500 text-white"
                                    : tc.priority === "P2"
                                    ? "bg-amber-500 text-white"
                                    : tc.priority === "P3"
                                    ? "bg-blue-500 text-white"
                                    : "bg-slate-400 text-white"
                                }`}
                              >
                                {tc.priority}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-[280px]">
                              {tc.title}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={tc.testData}>
                              {tc.testData}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[280px] line-clamp-2">
                              {tc.expectedResult}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setSelectedTestCase(tc)}
                                className="p-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                title="Xem chi tiết các bước"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: RTM MATRIX */}
            {activeOutputTab === "rtm" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {isVi ? "Ma trận đối soát truy vết yêu cầu (Requirement Traceability Matrix)" : "Requirement Traceability Matrix (RTM)"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isVi ? "Đảm bảo mỗi Acceptance Criteria có tối thiểu 1 Happy Path và 1 Negative/Boundary" : "Ensures each requirement is tested for both positive and negative outcomes"}
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 font-bold text-xs">
                    {auditResult.coveragePercentage}% Covered
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-semibold text-[10px]">
                        <th className="py-2.5 px-3">Req ID</th>
                        <th className="py-2.5 px-4">Acceptance Criteria</th>
                        <th className="py-2.5 px-3 text-center">Happy Path</th>
                        <th className="py-2.5 px-3 text-center">Negative / Edge</th>
                        <th className="py-2.5 px-3 text-center">Trạng thái</th>
                        <th className="py-2.5 px-4">Test Case IDs đã liên kết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {auditResult.rtmMatrix.map((r) => (
                        <tr key={r.reqId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {r.reqId}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {r.reqTitle}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.hasHappyPath ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                            ) : (
                              <span className="text-rose-500 font-bold">MISSING</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.hasNegative ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                            ) : (
                              <span className="text-rose-500 font-bold">MISSING</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                r.isCovered
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {r.isCovered ? "PASS" : "INCOMPLETE"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {r.testCaseIds.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CLARIFICATION LOG */}
            {activeOutputTab === "questions" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isVi ? "Nhật ký câu hỏi làm rõ nghiệp vụ (Clarification Log)" : "Clarification Questions Log"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi ? "Các cảnh báo về yêu cầu mơ hồ, thiếu ranh giới cụ thể cần gửi cho Product Owner / BA" : "Identified ambiguities or missing edge rules needing BA clarification"}
                  </p>
                </div>

                <div className="space-y-3">
                  {deconstruction.clarificationQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">{q.id}</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{q.question}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {q.impact} Impact
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <strong>Ngữ cảnh:</strong> {q.context}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: EXPORT HUB */}
            {activeOutputTab === "export" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Excel Export Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">Excel Spreadsheet (.xlsx)</h4>
                      <p className="text-xs text-slate-500">Multi-sheet: Test Cases, RTM Matrix, Clarification Log</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Bao gồm freeze panes, auto-filters, định dạng màu sắc cho Priority và đầy đủ các cột tiêu chuẩn ISTQB.
                  </p>
                  <button
                    onClick={() => exportToExcel(testCases, deconstruction, auditResult)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải về File .xlsx</span>
                  </button>
                </div>

                {/* Jira Xray CSV */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
                      <FileCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">Jira Xray / Zephyr CSV</h4>
                      <p className="text-xs text-slate-500">Tương thích 100% Import Wizard của Jira</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Chuyển đổi các kịch bản thành định dạng CSV chuẩn với Issue Key, Preconditions, Action, Data, Expected Result.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const csv = exportToJiraXrayCsv(testCases, deconstruction.moduleName);
                        downloadFile(`${deconstruction.moduleName}_Jira_Xray.csv`, csv, "text/csv");
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV</span>
                    </button>
                    <button
                      onClick={() => {
                        const csv = exportToJiraXrayCsv(testCases, deconstruction.moduleName);
                        copyToClipboard(csv, "Jira CSV");
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {copiedNotification === "Jira CSV" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* TestRail CSV */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">TestRail Suites CSV</h4>
                      <p className="text-xs text-slate-500">Import thẳng vào TestRail Test Cases</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Phân tách Section, Title, Type, Priority, Preconditions, Steps và Expected Result theo mẫu TestRail.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const csv = exportToTestRailCsv(testCases);
                        downloadFile(`${deconstruction.moduleName}_TestRail.csv`, csv, "text/csv");
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV</span>
                    </button>
                    <button
                      onClick={() => {
                        const csv = exportToTestRailCsv(testCases);
                        copyToClipboard(csv, "TestRail CSV");
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {copiedNotification === "TestRail CSV" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* BDD Gherkin (.feature) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                      <Code2Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">BDD Gherkin (.feature)</h4>
                      <p className="text-xs text-slate-500">Cucumber / SpecFlow / Behave Automation</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Tự động format thành các Scenario với cú pháp Given - When - Then sẵn sàng cho kỹ sư Automation.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const feature = exportToBddFeature(testCases, deconstruction.moduleName);
                        downloadFile(`${deconstruction.moduleName}.feature`, feature, "text/plain");
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .feature</span>
                    </button>
                    <button
                      onClick={() => {
                        const feature = exportToBddFeature(testCases, deconstruction.moduleName);
                        copyToClipboard(feature, "BDD Feature");
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {copiedNotification === "BDD Feature" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detailed Test Case Drawer / Modal */}
        {selectedTestCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                    {selectedTestCase.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      selectedTestCase.priority === "P1"
                        ? "bg-rose-500 text-white"
                        : "bg-blue-500 text-white"
                    }`}
                  >
                    {selectedTestCase.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {selectedTestCase.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTestCase(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 overflow-y-auto text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    {selectedTestCase.title}
                  </h3>
                  <div className="text-slate-400">Liên kết yêu cầu: {selectedTestCase.reqId} | Module: {selectedTestCase.module}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <div className="font-bold text-slate-700 dark:text-slate-300">Tiền điều kiện (Pre-conditions):</div>
                  <div className="text-slate-600 dark:text-slate-400">{selectedTestCase.preconditions}</div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-1">
                  <div className="font-bold text-indigo-900 dark:text-indigo-300">Dữ liệu thử nghiệm (Concrete Test Data):</div>
                  <div className="font-mono text-indigo-700 dark:text-indigo-400 break-all">{selectedTestCase.testData}</div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200">Các bước thực hiện (Steps):</div>
                  <div className="space-y-1.5 pl-2">
                    {selectedTestCase.steps.map((st, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-indigo-500 shrink-0">{i + 1}.</span>
                        <span>{st.replace(/^\d+\.\s*/, "")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300">Kết quả mong đợi (Expected Result):</div>
                  <div className="text-emerald-800 dark:text-emerald-300">{selectedTestCase.expectedResult}</div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <button
                  onClick={() => setSelectedTestCase(null)}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Key Settings Modal */}
        <AISettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSaved={(newCfg) => setAiConfig(newCfg)}
          isVi={isVi}
        />
      </div>
      }
    />
  );
};

function Code2Icon(props: any) {
  return <FileCode {...props} />;
}
