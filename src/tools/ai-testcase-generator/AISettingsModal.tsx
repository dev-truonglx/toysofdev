import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Zap,
  Sliders,
  RefreshCw,
  Terminal,
} from "lucide-react";
import {
  AIConfig,
  DEFAULT_AI_CONFIG,
  loadAIConfigFromDisk,
  saveAIConfigToDisk,
} from "../../services/storeService";
import {
  testAIConnection,
  fetchAvailableGeminiModels,
  checkLocalCliStatus,
  LocalCliStatus,
} from "../../services/aiService";

interface ModelOption {
  id: string;
  name: string;
  badge?: string;
  desc?: string;
}

const GEMINI_MODELS: ModelOption[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    badge: "Mới nhất 09/2026",
    desc: "Mô hình mới nhất (09/2026), tối ưu cho Agentic workflows, QA & Testing suy luận đa bước",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    badge: "08/2026",
    desc: "Bản Flash ổn định cao, 1M token context, năng lực code & phân tích xuất sắc",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    badge: "Tốc độ",
    desc: "Cực nhanh, tiết kiệm chi phí cho tài liệu kiểm thử vừa và lớn",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    badge: "Flash-Lite",
    desc: "Phiên bản siêu nhẹ, tối ưu throughput cao và độ trễ thấp nhất",
  },
  {
    id: "gemini-3.0-pro",
    name: "Gemini 3.0 Pro",
    badge: "Next-Gen Pro",
    desc: "Dòng Gemini 3 Pro kiến trúc suy luận chuyên sâu",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    badge: "Reasoning",
    desc: "Deep Reasoning, phân tích đặc tả SRS/BRD phức tạp",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    badge: "Thế hệ 2.5",
    desc: "Bản 2.5 Flash ổn định",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    badge: "Thế hệ 2.0",
    desc: "Thế hệ 2.0 phản hồi tức thì, xử lý nhanh",
  },
  {
    id: "gemini-1.5-pro-latest",
    name: "Gemini 1.5 Pro (Latest)",
    badge: "2M Context",
    desc: "Context window siêu lớn 2M tokens",
  },
];

const CLAUDE_MODELS: ModelOption[] = [
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    badge: "Mới nhất 28/09/2026",
    desc: "Mới nhất (28/09/2026), Adaptive Thinking, 1M context, cân bằng tốc độ & trí tuệ nhân tạo",
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    badge: "Mới nhất 22/09/2026",
    desc: "Đỉnh cao Agentic coding, suy luận kiểm thử logic sâu phức tạp nhất thế giới",
  },
  {
    id: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    badge: "Reasoning",
    desc: "Chuyên biệt cho các bài toán phân tích dài hạn và logic đa tầng",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    badge: "Tốc độ",
    desc: "Siêu tốc độ thế hệ 4.5, tối ưu chi phí token",
  },
  {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    badge: "Thế hệ 3.7",
    desc: "Thế hệ 3.7 Hybrid Reasoning",
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet v2",
    badge: "Thế hệ 3.5",
    desc: "Chuẩn mực ISTQB, phân tích biên BVA và logic rẽ nhánh sắc nét",
  },
];

const QUICK_GEMINI = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.0-pro",
];

const QUICK_CLAUDE = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-haiku-4-5",
  "claude-3-7-sonnet-20250219",
];

const LOCAL_CLI_MODELS: ModelOption[] = [
  {
    id: "gemini-3.8-flash-high",
    name: "Gemini 3.8 Flash (High Reasoning)",
    badge: "Mới nhất 09/2026 - Khuyên dùng",
    desc: "Mô hình mới nhất (09/2026), suy luận sâu, tốc độ cao, hưởng trọn gói Google One Pro",
  },
  {
    id: "gemini-3.8-flash-medium",
    name: "Gemini 3.8 Flash (Medium)",
    badge: "Cân bằng",
    desc: "Tốc độ phản hồi nhanh, suy luận tiêu chuẩn",
  },
  {
    id: "gemini-3.8-flash-low",
    name: "Gemini 3.8 Flash (Low)",
    badge: "Siêu tốc",
    desc: "Phản hồi tức thì, tối ưu độ trễ",
  },
  {
    id: "gemini-3.7-flash-high",
    name: "Gemini 3.7 Flash (High)",
    badge: "08/2026",
    desc: "Bản Flash 3.7 ổn định, năng lực phân tích xuất sắc",
  },
  {
    id: "gemini-3.7-flash-medium",
    name: "Gemini 3.7 Flash (Medium)",
    badge: "Ổn định",
    desc: "Cân bằng tốc độ và chất lượng",
  },
  {
    id: "gemini-3.1-pro-high",
    name: "Gemini 3.1 Pro (High)",
    badge: "Pro Reasoning",
    desc: "Kiến trúc Gemini 3.1 Pro suy luận logic sâu chuyên nghiệp",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (Thinking)",
    badge: "Claude CLI",
    desc: "Mô hình Claude có tính năng Thinking tích hợp sẵn qua CLI",
  },
  {
    id: "claude-opus-4-6-thinking",
    name: "Claude Opus 4.6 (Thinking)",
    badge: "Claude Deepest",
    desc: "Claude Opus phân tích logic phức tạp qua CLI",
  },
];

const QUICK_CLI = [
  "gemini-3.8-flash-high",
  "gemini-3.8-flash-medium",
  "gemini-3.7-flash-high",
  "claude-sonnet-4-6",
];

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newConfig: AIConfig) => void;
  isVi?: boolean;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  isVi = false,
}) => {
  const [config, setConfig] = useState<AIConfig>({ ...DEFAULT_AI_CONFIG });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSyncingModels, setIsSyncingModels] = useState(false);
  const [syncedModels, setSyncedModels] = useState<{ id: string; name: string; desc: string }[] | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [cliStatus, setCliStatus] = useState<LocalCliStatus | null>(null);
  const [isCheckingCli, setIsCheckingCli] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAIConfigFromDisk().then((loaded) => {
        setConfig(loaded);
        setTestResult(null);
        setSaveSuccess(false);
        setSyncMessage(null);
        checkLocalCliStatus(loaded.localCliPath).then(setCliStatus);
      });
    }
  }, [isOpen]);

  const handleRefreshCli = async () => {
    setIsCheckingCli(true);
    try {
      const res = await checkLocalCliStatus(config.localCliPath);
      setCliStatus(res);
    } catch {
      // ignore
    } finally {
      setIsCheckingCli(false);
    }
  };

  if (!isOpen) return null;

  const handleSyncModels = async () => {
    if (!config.geminiApiKey || !config.geminiApiKey.trim()) {
      setSyncMessage({
        text: isVi ? "Vui lòng nhập Gemini API Key trước!" : "Please enter Gemini API Key first!",
        isError: true,
      });
      return;
    }
    setIsSyncingModels(true);
    setSyncMessage(null);
    try {
      const list = await fetchAvailableGeminiModels(config.geminiApiKey);
      if (list.length > 0) {
        const formatted = list.map((m) => ({
          id: m.id,
          name: m.displayName || m.id,
          desc: m.description || "",
        }));
        setSyncedModels(formatted);
        setSyncMessage({
          text: isVi
            ? `Google xác nhận Key của bạn có ${list.length} model khả dụng!`
            : `Google confirmed ${list.length} available models for your Key!`,
          isError: false,
        });
      } else {
        setSyncMessage({
          text: isVi ? "Không tìm thấy model nào khả dụng cho Key này." : "No models found for this Key.",
          isError: true,
        });
      }
    } catch (err: any) {
      setSyncMessage({
        text: err.message || "Lỗi quét danh sách model từ Google.",
        isError: true,
      });
    } finally {
      setIsSyncingModels(false);
    }
  };

  const handleTestConnection = async (overrideModel?: string) => {
    setIsTesting(true);
    setTestResult(null);
    let activeKey = "";
    let activeModel = "";
    if (config.provider === "gemini") {
      activeKey = config.geminiApiKey;
      activeModel = typeof overrideModel === "string" ? overrideModel : config.geminiModel;
    } else if (config.provider === "claude") {
      activeKey = config.claudeApiKey;
      activeModel = typeof overrideModel === "string" ? overrideModel : config.claudeModel;
    } else {
      activeKey = "";
      activeModel =
        typeof overrideModel === "string"
          ? overrideModel
          : config.localCliModel || "gemini-3.8-flash-high";
    }

    const res = await testAIConnection(
      config.provider,
      activeKey,
      activeModel,
      config.localCliPath
    );
    setIsTesting(false);
    setTestResult(res);
    if (
      res.availableModels &&
      res.availableModels.length > 0 &&
      (!syncedModels || syncedModels.length === 0)
    ) {
      setSyncedModels(
        res.availableModels.map((m) => ({
          id: m.id,
          name: m.displayName || m.id,
          desc: m.description || "",
        }))
      );
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveAIConfigToDisk(config);
    setIsSaving(false);
    setSaveSuccess(true);
    onSaved?.(config);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isVi ? "Cấu hình AI Model & API Key" : "AI Provider & API Key Configuration"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isVi
                  ? "Lưu vào file config.json một lần duy nhất, mở app tự nhận"
                  : "Saved once to local config.json, persists across app restarts"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {isVi ? "Chọn phương thức AI" : "Select AI Engine"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfig({ ...config, provider: "local-cli" });
                  setTestResult(null);
                }}
                className={`relative flex flex-col justify-between p-3 rounded-xl border transition-all text-left ${
                  config.provider === "local-cli"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    {isVi ? "Khuyên dùng" : "Recommended"}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">
                    Local CLI (agy)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {isVi ? "Gói Google One, không cần Key" : "Direct Google One, no Key"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfig({ ...config, provider: "gemini" });
                  setTestResult(null);
                }}
                className={`flex flex-col justify-between p-3 rounded-xl border transition-all text-left ${
                  config.provider === "gemini"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                    API Key
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">
                    Google Gemini
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    AI Studio API Key
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfig({ ...config, provider: "claude" });
                  setTestResult(null);
                }}
                className={`flex flex-col justify-between p-3 rounded-xl border transition-all text-left ${
                  config.provider === "claude"
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    API Key
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">
                    Anthropic Claude
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Anthropic API Key
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* LOCAL CLI SETTINGS BOX */}
          {config.provider === "local-cli" && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                    {isVi ? "Local CLI (Google One / agy)" : "Local CLI Engine (agy)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshCli}
                  disabled={isCheckingCli}
                  className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingCli ? "animate-spin" : ""}`} />
                  {isCheckingCli ? (isVi ? "Đang quét..." : "Checking...") : isVi ? "Quét lại CLI" : "Refresh CLI"}
                </button>
              </div>

              {/* Status info */}
              {cliStatus?.available ? (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {isVi
                        ? `Đã phát hiện CLI agy (v${cliStatus.version}) sẵn sàng!`
                        : `agy CLI detected (v${cliStatus.version}) and ready!`}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] font-mono break-all pl-5">
                    {cliStatus.path}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] pl-5 leading-relaxed">
                    {isVi
                      ? "💡 Ứng dụng sẽ thực thi thông qua phiên đăng nhập Google One / Gemini Advanced cá nhân của máy bạn. Hạn ngạch lớn, dùng tẹt ga và không lo bị lỗi Free Tier 20 req/ngày của API Key!"
                      : "💡 Requests route via your local machine's Google One subscription session. High personal quota with no API Key rate limits!"}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      {isVi
                        ? "Chưa tìm thấy CLI agy tại ~/.local/bin/agy"
                        : "agy CLI was not found at ~/.local/bin/agy"}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] pl-5 leading-relaxed">
                    {isVi
                      ? "Vui lòng nhập đường dẫn chính xác của file thực thi CLI ở mục bên dưới hoặc cài đặt agy."
                      : "Please specify the custom path to your agy CLI binary below or install agy."}
                  </p>
                </div>
              )}

              {/* Model selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {isVi ? "Model xử lý:" : "Select Model:"}
                  </label>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded font-semibold">
                    {config.localCliModel || "gemini-3.8-flash-high"}
                  </span>
                </div>

                <select
                  value={config.localCliModel || "gemini-3.8-flash-high"}
                  onChange={(e) => setConfig({ ...config, localCliModel: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <optgroup label={isVi ? "Gemini Models (Khuyên dùng)" : "Gemini Models (Recommended)"}>
                    {LOCAL_CLI_MODELS.slice(0, 6).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} [{m.badge}]
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={isVi ? "Claude Models (CLI Thinking)" : "Claude Models (CLI Thinking)"}>
                    {LOCAL_CLI_MODELS.slice(6).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} [{m.badge}]
                      </option>
                    ))}
                  </optgroup>
                </select>

                {/* Quick Select Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-400 mr-1">
                    {isVi ? "Gợi ý nhanh:" : "Quick pick:"}
                  </span>
                  {QUICK_CLI.map((mId) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setConfig({ ...config, localCliModel: mId })}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded-md border transition-all ${
                        (config.localCliModel || "gemini-3.8-flash-high") === mId
                          ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                      }`}
                    >
                      {mId}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom CLI Path (optional) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {isVi
                    ? "Đường dẫn file thực thi CLI (để trống nếu dùng mặc định ~/.local/bin/agy):"
                    : "Custom CLI executable path (leave empty for default ~/.local/bin/agy):"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={config.localCliPath || ""}
                    onChange={(e) => setConfig({ ...config, localCliPath: e.target.value })}
                    placeholder="Mặc định: ~/.local/bin/agy"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gemini Settings Box */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-4 ${
              config.provider === "gemini"
                ? "border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                Google Gemini API Key
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isVi ? "Lấy Key miễn phí tại Google AI Studio" : "Get Key at Google AI Studio"}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showGeminiKey ? "text" : "password"}
                value={config.geminiApiKey}
                onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {isVi ? "Model Gemini sử dụng:" : "Select Gemini Model:"}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncModels}
                    disabled={isSyncingModels || !config.geminiApiKey}
                    className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingModels ? "animate-spin" : ""}`} />
                    {isSyncingModels
                      ? isVi
                        ? "Đang quét..."
                        : "Syncing..."
                      : isVi
                      ? "Quét model từ Key Pro"
                      : "Sync models from Key"}
                  </button>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                    {config.geminiModel}
                  </span>
                </div>
              </div>

              {syncMessage && (
                <div
                  className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${
                    syncMessage.isError
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{syncMessage.text}</span>
                </div>
              )}

              {/* Preset Dropdown */}
              <select
                value={
                  GEMINI_MODELS.some((m) => m.id === config.geminiModel) ||
                  (syncedModels && syncedModels.some((m) => m.id === config.geminiModel))
                    ? config.geminiModel
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    setConfig({ ...config, geminiModel: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {syncedModels && syncedModels.length > 0 && (
                  <optgroup label={isVi ? "🌟 Model trực tiếp từ Key Pro của bạn" : "🌟 Direct Models from your Key"}>
                    {syncedModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        ✓ {m.name} ({m.id})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={isVi ? "Thế hệ 3.x (Mới nhất 2026)" : "Generation 3.x (Latest 2026)"}>
                  {GEMINI_MODELS.slice(0, 5).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.badge}] - {m.desc}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={isVi ? "Thế hệ 2.x & 1.x" : "Generation 2.x & 1.x"}>
                  {GEMINI_MODELS.slice(5).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.badge}] - {m.desc}
                    </option>
                  ))}
                </optgroup>
                <option value="custom">
                  {isVi
                    ? "⚙️ Tùy chỉnh (Nhập Model ID bất kỳ bên dưới)..."
                    : "⚙️ Custom (Enter custom Model ID below)..."}
                </option>
              </select>

              {/* Custom / Editable input */}
              <div className="relative">
                <input
                  type="text"
                  value={config.geminiModel}
                  onChange={(e) => setConfig({ ...config, geminiModel: e.target.value.trim() })}
                  placeholder="e.g. gemini-3.8-flash"
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Sliders className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              </div>

              {/* Quick Select Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-slate-400 mr-1">
                  {isVi ? "Gợi ý nhanh:" : "Quick pick:"}
                </span>
                {QUICK_GEMINI.map((modelId) => (
                  <button
                    key={modelId}
                    type="button"
                    onClick={() => setConfig({ ...config, geminiModel: modelId })}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded-md border transition-all ${
                      config.geminiModel === modelId
                        ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                    }`}
                  >
                    {modelId}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Claude Settings Box */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-4 ${
              config.provider === "claude"
                ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                Anthropic Claude API Key
              </span>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                {isVi ? "Lấy Key tại Anthropic Console" : "Get Key at Anthropic Console"}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showClaudeKey ? "text" : "password"}
                value={config.claudeApiKey}
                onChange={(e) => setConfig({ ...config, claudeApiKey: e.target.value })}
                placeholder="sk-ant-api03-..."
                className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowClaudeKey(!showClaudeKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showClaudeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {isVi ? "Model Claude sử dụng:" : "Select Claude Model:"}
                </label>
                <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                  {config.claudeModel}
                </span>
              </div>

              {/* Preset Dropdown */}
              <select
                value={
                  CLAUDE_MODELS.some((m) => m.id === config.claudeModel)
                    ? config.claudeModel
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    setConfig({ ...config, claudeModel: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <optgroup label={isVi ? "Thế hệ 5.x & 4.x (Mới nhất 2026)" : "Generation 5.x & 4.x (Latest 2026)"}>
                  {CLAUDE_MODELS.slice(0, 4).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.badge}] - {m.desc}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={isVi ? "Thế hệ 3.x" : "Generation 3.x"}>
                  {CLAUDE_MODELS.slice(4).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.badge}] - {m.desc}
                    </option>
                  ))}
                </optgroup>
                <option value="custom">
                  {isVi
                    ? "⚙️ Tùy chỉnh (Nhập Model ID bất kỳ bên dưới)..."
                    : "⚙️ Custom (Enter custom Model ID below)..."}
                </option>
              </select>

              {/* Custom / Editable input */}
              <div className="relative">
                <input
                  type="text"
                  value={config.claudeModel}
                  onChange={(e) => setConfig({ ...config, claudeModel: e.target.value.trim() })}
                  placeholder="e.g. claude-sonnet-5-5"
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Sliders className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              </div>

              {/* Quick Select Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-slate-400 mr-1">
                  {isVi ? "Gợi ý nhanh:" : "Quick pick:"}
                </span>
                {QUICK_CLAUDE.map((modelId) => {
                  const label =
                    modelId === "claude-sonnet-5-5"
                      ? "Sonnet 5.5"
                      : modelId === "claude-opus-5-5"
                      ? "Opus 5.5"
                      : modelId === "claude-haiku-4-5"
                      ? "Haiku 4.5"
                      : "Sonnet 3.7";
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => setConfig({ ...config, claudeModel: modelId })}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded-md border transition-all ${
                        config.claudeModel === modelId
                          ? "bg-amber-600 text-white border-amber-600 font-semibold shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Test Connection Feedback */}
          {testResult && (() => {
            const errStr = (testResult.error || "").toLowerCase();
            const isQuotaLimit =
              errStr.includes("quota") ||
              errStr.includes("free_tier_requests") ||
              errStr.includes("rate-limit") ||
              errStr.includes("resource_exhausted") ||
              errStr.includes("exceeded your current quota");
            const isHighDemand =
              errStr.includes("high demand") ||
              errStr.includes("spikes in demand") ||
              errStr.includes("overloaded") ||
              errStr.includes("503");

            return (
              <div
                className={`p-3.5 rounded-xl text-sm animate-in fade-in space-y-2.5 ${
                  testResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {testResult.success ? (
                      <div>
                        <span className="font-semibold">
                          {isVi ? "Kết nối thành công!" : "Connection verified!"}
                        </span>{" "}
                        ({testResult.latencyMs}ms)
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-xs mb-1">
                          {isQuotaLimit
                            ? isVi
                              ? "⚠️ Đã chạm giới hạn hạn ngạch (Free Tier Rate Limit - 20 req/phút) của model này!"
                              : "⚠️ Free Tier Quota / Rate Limit reached for this model!"
                            : isHighDemand
                            ? isVi
                              ? "⚠️ Máy chủ Google AI đang bị quá tải tạm thời với model này (Spike in Demand)!"
                              : "⚠️ Model is currently experiencing temporary high demand!"
                            : isVi
                            ? "Kiểm tra kết nối thất bại:"
                            : "Connection test failed:"}
                        </div>
                        <div className="text-xs break-all opacity-90">{testResult.error}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick 1-click Fallback Actions for High Demand or Quota Limit */}
                {!testResult.success && (isHighDemand || isQuotaLimit) && config.provider === "gemini" && (
                  <div className="pt-2 border-t border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs text-rose-700 dark:text-rose-300">
                      {isVi
                        ? "👉 Chuyển sang Gemini 2.5 Flash ngay để chạy tiếp (mỗi model có quỹ hạn ngạch riêng):"
                        : "👉 Switch to Gemini 2.5 Flash to continue immediately (separate quota pool):"}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = "gemini-2.5-flash";
                          setConfig((prev) => ({ ...prev, geminiModel: target }));
                          handleTestConnection(target);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition-all shrink-0"
                      >
                        {isVi ? "Đổi sang Gemini 2.5 Flash" : "Try 2.5 Flash"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfig((prev) => ({ ...prev, provider: "local-cli" }));
                          setTestResult(null);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all shrink-0 flex items-center gap-1"
                      >
                        <Terminal className="w-3 h-3" />
                        {isVi ? "Dùng Local CLI (Google One)" : "Use Local CLI"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={() => handleTestConnection()}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                {isVi ? "Đang thử kết nối..." : "Testing..."}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-500" />
                {isVi ? "Kiểm tra kết nối" : "Test Connection"}
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {isVi ? "Đóng" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isVi ? "Đang lưu..." : "Saving..."}
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  {isVi ? "Đã lưu!" : "Saved!"}
                </>
              ) : (
                <>{isVi ? "Lưu cấu hình" : "Save Config"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
