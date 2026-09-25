import React, { useState, useMemo, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Check,
  Download,
  FileSpreadsheet,
  FileCode,
  Search,
  Sparkles,
  Sliders,
  HelpCircle,
  FileText,
  FilterX,
  Ban,
  Info,
  ExternalLink,
  X,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import { ToolLayout } from "../../components/common/ToolLayout";
import {
  ParameterDef,
  PAIRWISE_PRESETS,
  generatePairwiseTestCases,
  getExcludedCombinations,
  ExcludedCaseItem,
  TestConstraint,
  ConstraintOperator,
  exportPairwiseToMarkdown,
  exportPairwiseToCsv,
  exportPairwiseToJson,
} from "./pairwiseEngine";

export const PairwiseTester: React.FC = () => {
  const { language } = useTranslation();
  const isVi = language === "vi";

  // Parameters state initialized with the first preset
  const [parameters, setParameters] = useState<ParameterDef[]>(
    PAIRWISE_PRESETS[0].parameters.map((p) => ({ ...p, values: [...p.values] }))
  );
  // Constraints state initialized with the first preset
  const [constraints, setConstraints] = useState<TestConstraint[]>(() => {
    const p = PAIRWISE_PRESETS[0];
    return p.constraints
      ? p.constraints.map((c) => ({
          ...c,
          conditions: c.conditions.map((cd) => ({ ...cd })),
          thenClause: c.thenClause ? { ...c.thenClause } : undefined,
        }))
      : [];
  });

  // Raw text string for values input so users can type commas and spaces normally without them disappearing
  const [paramRawValues, setParamRawValues] = useState<Record<string, string>>({});

  const [selectedPreset, setSelectedPreset] = useState<string>("ecommerce-checkout");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInputText, setBulkInputText] = useState("");

  // Tab state: "optimal" (pairwise test cases) vs "excluded" (pruned test cases)
  const [activeTab, setActiveTab] = useState<"optimal" | "excluded">("optimal");
  const [excludedLimit, setExcludedLimit] = useState<number>(500);

  // Left panel view tab: "params" (parameters) vs "constraints" (business rules)
  const [leftPanelTab, setLeftPanelTab] = useState<"params" | "constraints">("params");

  // CSV Download / Save dialog state
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [lastDownloadedCsv, setLastDownloadedCsv] = useState<string | null>(null);

  // Auto-dismiss CSV download success toast after 6s
  useEffect(() => {
    if (!lastDownloadedCsv) return;
    const timer = setTimeout(() => {
      setLastDownloadedCsv(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [lastDownloadedCsv]);

  // Selected excluded case for Pair Breakdown Modal
  const [selectedExcludedCase, setSelectedExcludedCase] = useState<ExcludedCaseItem | null>(null);

  // Constraint Editor Modal state
  const [isConstraintModalOpen, setIsConstraintModalOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<TestConstraint | null>(null);

  // Value color palette for badges
  const BADGE_COLORS = [
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  ];

  // Generated pairwise test cases with constraint satisfaction
  const pairwiseResult = useMemo(() => {
    return generatePairwiseTestCases(parameters, constraints);
  }, [parameters, constraints]);

  // Excluded test cases generated on-demand with constraint violation categorization
  const excludedData = useMemo(() => {
    return getExcludedCombinations(
      pairwiseResult.parameters,
      pairwiseResult.testCases,
      excludedLimit,
      constraints
    );
  }, [pairwiseResult.parameters, pairwiseResult.testCases, excludedLimit, constraints]);

  // Current active list of cases
  const currentCases = useMemo(() => {
    return activeTab === "optimal" ? pairwiseResult.testCases : excludedData.excludedCases;
  }, [activeTab, pairwiseResult.testCases, excludedData.excludedCases]);

  // Filtered test cases based on search query
  const filteredTestCases = useMemo(() => {
    if (!searchQuery.trim()) return currentCases;
    const q = searchQuery.toLowerCase();
    return currentCases.filter((tc) =>
      Object.values(tc).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [currentCases, searchQuery]);

  // Load a preset
  const handleLoadPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setParamRawValues({});
    if (presetId === "custom") return;
    const found = PAIRWISE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setParameters(found.parameters.map((p) => ({ ...p, values: [...p.values] })));
      setConstraints(
        found.constraints
          ? found.constraints.map((c) => ({
              ...c,
              conditions: c.conditions.map((cd) => ({ ...cd })),
              thenClause: c.thenClause ? { ...c.thenClause } : undefined,
            }))
          : []
      );
    }
  };

  // Parameter manipulations
  const handleAddParameter = () => {
    setSelectedPreset("custom");
    const newId = `param_${Date.now()}`;
    const newIndex = parameters.length + 1;
    const defaultVals = [isVi ? "Giá trị 1" : "Option 1", isVi ? "Giá trị 2" : "Option 2"];
    setParameters([
      ...parameters,
      {
        id: newId,
        name: isVi ? `Tham số ${newIndex}` : `Parameter ${newIndex}`,
        values: defaultVals,
      },
    ]);
    setParamRawValues((prev) => ({
      ...prev,
      [newId]: defaultVals.join(", "),
    }));
  };

  const handleRemoveParameter = (id: string) => {
    setSelectedPreset("custom");
    const removedParam = parameters.find((p) => p.id === id);
    setParameters(parameters.filter((p) => p.id !== id));
    setParamRawValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Clean up constraints referencing the removed parameter
    if (removedParam) {
      setConstraints(
        constraints.filter(
          (c) =>
            !c.conditions.some((cd) => cd.paramName === removedParam.name) &&
            c.thenClause?.paramName !== removedParam.name
        )
      );
    }
  };

  const handleUpdateParamName = (id: string, newName: string) => {
    setSelectedPreset("custom");
    const oldParam = parameters.find((p) => p.id === id);
    setParameters(
      parameters.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
    // Update constraints references
    if (oldParam && oldParam.name !== newName) {
      setConstraints(
        constraints.map((c) => ({
          ...c,
          conditions: c.conditions.map((cd) =>
            cd.paramName === oldParam.name ? { ...cd, paramName: newName } : cd
          ),
          thenClause:
            c.thenClause?.paramName === oldParam.name
              ? { ...c.thenClause, paramName: newName }
              : c.thenClause,
        }))
      );
    }
  };

  const handleUpdateParamValues = (id: string, commaSeparated: string) => {
    setSelectedPreset("custom");
    setParamRawValues((prev) => ({ ...prev, [id]: commaSeparated }));
    const vals = commaSeparated.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
    setParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, values: vals } : p))
    );
  };

  // Constraint manipulations
  const handleToggleConstraint = (id: string) => {
    setSelectedPreset("custom");
    setConstraints(
      constraints.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleDeleteConstraint = (id: string) => {
    setSelectedPreset("custom");
    setConstraints(constraints.filter((c) => c.id !== id));
  };

  const handleOpenAddConstraint = () => {
    const param1 = parameters[0];
    const param2 = parameters[1] || parameters[0];
    const newConstraint: TestConstraint = {
      id: `c_${Date.now()}`,
      name: isVi ? `Ràng buộc ${constraints.length + 1}` : `Constraint ${constraints.length + 1}`,
      type: "incompatible",
      enabled: true,
      conditions: [
        {
          paramName: param1?.name || "",
          operator: "equals",
          value: param1?.values[0] || "",
        },
        {
          paramName: param2?.name || "",
          operator: "equals",
          value: param2?.values[0] || "",
        },
      ],
      thenClause: {
        paramName: param2?.name || "",
        operator: "equals",
        value: param2?.values[0] || "",
      },
      description: "",
    };
    setEditingConstraint(newConstraint);
    setIsConstraintModalOpen(true);
  };

  const handleOpenEditConstraint = (c: TestConstraint) => {
    setEditingConstraint(JSON.parse(JSON.stringify(c)));
    setIsConstraintModalOpen(true);
  };

  const handleSaveConstraint = (saved: TestConstraint) => {
    setSelectedPreset("custom");
    const exists = constraints.some((c) => c.id === saved.id);
    if (exists) {
      setConstraints(constraints.map((c) => (c.id === saved.id ? saved : c)));
    } else {
      setConstraints([...constraints, saved]);
    }
    setIsConstraintModalOpen(false);
    setEditingConstraint(null);
  };

  // Bulk import from text
  const handleApplyBulkText = () => {
    const lines = bulkInputText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: ParameterDef[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(":")) {
        const [namePart, valPart] = line.split(":", 2);
        const name = namePart.trim();
        const values = valPart
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        if (name && values.length > 0) {
          parsed.push({
            id: `p_bulk_${Date.now()}_${i}`,
            name,
            values,
          });
        }
      }
    }

    if (parsed.length > 0) {
      setParameters(parsed);
      setParamRawValues({});
      setSelectedPreset("custom");
      setShowBulkModal(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyCurrent = (format: "markdown" | "csv" | "json") => {
    let content = "";
    if (format === "markdown") content = exportPairwiseToMarkdown(pairwiseResult.parameters, currentCases);
    else if (format === "csv") content = exportPairwiseToCsv(pairwiseResult.parameters, currentCases);
    else if (format === "json") content = exportPairwiseToJson(pairwiseResult.parameters, currentCases);
    handleCopy(content, format);
  };

  // Download CSV with native save location / filename picker (like DummyFileGenerator)
  const handleDownloadCsv = async () => {
    try {
      setIsDownloadingCsv(true);

      const prefix = activeTab === "optimal" ? "pairwise_test_cases" : "pairwise_excluded_cases";
      const dateStr = new Date().toISOString().slice(0, 10);
      const defaultFilename = `${prefix}_${selectedPreset || "suite"}_${dateStr}.csv`;
      const csvContent = exportPairwiseToCsv(pairwiseResult.parameters, currentCases);
      const bomCsv = "\uFEFF" + csvContent;

      const isTauri =
        typeof window !== "undefined" &&
        ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

      // 1. Try Tauri Native Save Dialog
      if (isTauri) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { invoke } = await import("@tauri-apps/api/core");

          const selectedPath = await save({
            defaultPath: defaultFilename,
            filters: [
              {
                name: "CSV Spreadsheet (*.csv)",
                extensions: ["csv"],
              },
            ],
          });

          if (!selectedPath) {
            // User cancelled dialog
            setIsDownloadingCsv(false);
            return;
          }

          const encoder = new TextEncoder();
          const buffer = encoder.encode(bomCsv);

          await invoke("save_binary_file", {
            path: selectedPath,
            data: Array.from(buffer),
          });

          const savedFilename = selectedPath.split(/[/\\]/).pop() || defaultFilename;
          setLastDownloadedCsv(savedFilename);
          setIsDownloadingCsv(false);
          return;
        } catch (tauriErr) {
          console.warn("Tauri native save dialog unavailable, falling back:", tauriErr);
        }
      }

      // 2. Try Modern Browser File System Access API (showSaveFilePicker)
      if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          const fileHandle = await (window as unknown as {
            showSaveFilePicker: (options: unknown) => Promise<{
              name: string;
              createWritable: () => Promise<{
                write: (data: unknown) => Promise<void>;
                close: () => Promise<void>;
              }>;
            }>;
          }).showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [
              {
                description: "CSV Spreadsheet (*.csv)",
                accept: {
                  "text/csv": [".csv"],
                },
              },
            ],
          });

          const writable = await fileHandle.createWritable();
          const blob = new Blob([bomCsv], { type: "text/csv;charset=utf-8;" });
          await writable.write(blob);
          await writable.close();

          setLastDownloadedCsv(fileHandle.name);
          setIsDownloadingCsv(false);
          return;
        } catch (pickerErr: unknown) {
          if (
            pickerErr &&
            typeof pickerErr === "object" &&
            "name" in pickerErr &&
            (pickerErr as { name: string }).name === "AbortError"
          ) {
            // User cancelled folder/file selection dialog
            setIsDownloadingCsv(false);
            return;
          }
          console.warn("showSaveFilePicker failed, falling back to anchor download", pickerErr);
        }
      }

      // 3. Fallback: Browser Anchor Download
      const blob = new Blob([bomCsv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(url);
        setIsDownloadingCsv(false);
        setLastDownloadedCsv(defaultFilename);
      }, 300);
    } catch (err) {
      console.error("CSV Download failed:", err);
      setIsDownloadingCsv(false);
    }
  };

  return (
    <ToolLayout
      id="pairwise-tester"
      title={isVi ? "Bộ Sinh Test Case Tổ Hợp Tối Ưu (Pairwise / All-Pairs)" : "Pairwise / All-Pairs Test Case Generator"}
      description={isVi
        ? "Tối ưu hóa tổ hợp kiểm thử (All-Pairs): Phủ 100% cặp tương tác 2 chiều với số lượng test case tối thiểu."
        : "Generate an optimal combinatorial test suite covering 100% of 2-way interactions with the minimal number of test cases."}
      icon={Layers}
      categoryName="graphic"
      titleBadge={
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          ISTQB Standard
        </span>
      }
      actionsRight={
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {isVi ? "Bộ mẫu:" : "Presets:"}
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => handleLoadPreset(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium cursor-pointer shadow-sm transition-all"
          >
            {PAIRWISE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {isVi ? p.titleVi : p.title}
              </option>
            ))}
            <option value="custom">{isVi ? "Tự định nghĩa..." : "Custom Matrix..."}</option>
          </select>
        </div>
      }
      customPanes={
        <div className="space-y-5">

      {/* Analytics / Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Optimal Cases */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            {isVi ? "Test Case Tối Ưu (Pairwise)" : "Optimal Pairwise Cases"}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {pairwiseResult.testCases.length}
            </span>
            <span className="text-xs text-slate-400">cases</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
            {isVi ? "Cần thiết để kiểm thử" : "Active test suite"}
          </span>
        </div>

        {/* Card 2: Excluded Cases (Highlight for User) */}
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 block">
              {isVi ? "Test Case Đã Loại Trừ" : "Excluded / Saved Cases"}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
              -{pairwiseResult.reductionPercentage}%
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {pairwiseResult.excludedCount.toLocaleString()}
            </span>
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70">cases</span>
          </div>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 block truncate">
            {isVi ? "Lược bỏ vì trùng lặp cặp" : "Pruned redundant combos"}
          </span>
        </div>

        {/* Card 3: Full Cartesian Product */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            {isVi ? "Tổng tổ hợp lý thuyết" : "Full Cartesian Product"}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">
              {pairwiseResult.totalCombinations.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">cases</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
            {isVi ? "Nếu kiểm thử vét cạn" : "Exhaustive combinations"}
          </span>
        </div>

        {/* Card 4: Pair Coverage */}
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
            {isVi ? "Độ phủ Cặp 2 chiều" : "2-Way Pair Coverage"}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {pairwiseResult.totalPairs > 0
                ? `${Math.round((pairwiseResult.coveredPairs / pairwiseResult.totalPairs) * 100)}%`
                : "100%"}
            </span>
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              ({pairwiseResult.coveredPairs}/{pairwiseResult.totalPairs})
            </span>
          </div>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5 block truncate">
            {isVi ? "Chuẩn kiểm thử NIST/ISTQB" : "Full interaction matrix"}
          </span>
        </div>
      </div>

      {/* Main split: Parameter Editor (Left) and Results (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Parameters & Constraints Card (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          {/* Sub-tab navigation between Parameters and Constraints */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/80 gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              <button
                onClick={() => setLeftPanelTab("params")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  leftPanelTab === "params"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isVi ? "Tham Số" : "Parameters"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-bold">
                  {parameters.length}
                </span>
              </button>

              <button
                onClick={() => setLeftPanelTab("constraints")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  leftPanelTab === "constraints"
                    ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-sm border border-rose-300/60 dark:border-rose-700/60"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                <span>{isVi ? "Ràng Buộc" : "Constraints"}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    constraints.filter((c) => c.enabled).length > 0
                      ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {constraints.filter((c) => c.enabled).length}
                </span>
              </button>
            </div>

            {leftPanelTab === "params" ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setBulkInputText(
                      parameters
                        .map((p) => `${p.name}: ${p.values.join(", ")}`)
                        .join("\n")
                    );
                    setShowBulkModal(true);
                  }}
                  className="h-8 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-all font-medium cursor-pointer"
                  title={isVi ? "Nhập nhanh từ văn bản" : "Bulk import from text"}
                >
                  {isVi ? "Nhập nhanh" : "Bulk"}
                </button>
                <button
                  onClick={handleAddParameter}
                  className="h-8 flex items-center gap-1 px-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isVi ? "Thêm" : "Add"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenAddConstraint}
                className="h-8 flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isVi ? "Thêm Ràng Buộc" : "Add Rule"}</span>
              </button>
            )}
          </div>

          {/* TAB 1: PARAMETERS LIST */}
          {leftPanelTab === "params" && (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {parameters.map((param, pIdx) => (
                <div
                  key={param.id}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                        {pIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => handleUpdateParamName(param.id, e.target.value)}
                        placeholder={isVi ? "Tên tham số..." : "Parameter name..."}
                        className="h-8 font-semibold px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    {parameters.length > 2 && (
                      <button
                        onClick={() => handleRemoveParameter(param.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                        title={isVi ? "Xóa tham số" : "Delete parameter"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Values input (comma-separated) */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                      {isVi ? "Danh sách giá trị (phân cách bằng dấu phẩy):" : "Values (comma-separated):"}
                    </label>
                    <input
                      type="text"
                      value={paramRawValues[param.id] !== undefined ? paramRawValues[param.id] : param.values.join(", ")}
                      onChange={(e) => handleUpdateParamValues(param.id, e.target.value)}
                      placeholder="e.g. Option A, Option B, Option C"
                      className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                    {/* Visual preview pills */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {param.values.length > 0 ? (
                        param.values.map((val, vIdx) => (
                          <span
                            key={vIdx}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-medium"
                          >
                            {val}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                          {isVi ? "Nhập ít nhất 1 giá trị..." : "Enter at least 1 value..."}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: CONSTRAINTS LIST */}
          {leftPanelTab === "constraints" && (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {/* Educational info callout */}
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <Info className="w-4 h-4" />
                  <span>{isVi ? "Ràng buộc giữa các điều kiện" : "Condition Constraints"}</span>
                </div>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                  {isVi
                    ? "Dùng để loại trừ các tổ hợp không thể xảy ra trên thực tế (ví dụ: điều kiện A kết hợp B thì không dùng C, hoặc Windows không hỗ trợ Safari). Thuật toán All-Pairs sẽ tự động tuân thủ 100% các quy tắc này."
                    : "Exclude impossible real-world combinations (e.g. A + B cannot use C). All-Pairs engine guarantees 100% compliance with these rules."}
                </p>
              </div>

              {constraints.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isVi ? "Chưa có quy tắc ràng buộc nào" : "No active constraints"}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isVi
                        ? "Bấm nút bên dưới để thiết lập điều kiện cấm kết hợp hoặc bắt buộc."
                        : "Click below to add an exclusion or conditional rule."}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddConstraint}
                    className="h-8 px-3 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isVi ? "Thêm Ràng Buộc Mới" : "Create Constraint"}</span>
                  </button>
                </div>
              ) : (
                constraints.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-lg border transition-all text-xs space-y-2.5 ${
                      c.enabled
                        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-60"
                    }`}
                  >
                    {/* Top bar: toggle, title, badges, action buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <button
                          onClick={() => handleToggleConstraint(c.id)}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          title={
                            c.enabled
                              ? isVi
                                ? "Đang bật (Bấm để tắt)"
                                : "Active (Click to disable)"
                              : isVi
                              ? "Đang tắt (Bấm để bật)"
                              : "Disabled (Click to enable)"
                          }
                        >
                          {c.enabled ? (
                            <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {c.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                c.type === "incompatible"
                                  ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                  : "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                              }`}
                            >
                              {c.type === "incompatible"
                                ? isVi
                                  ? "Cấm kết hợp"
                                  : "Incompatible"
                                : isVi
                                ? "Nếu... Thì..."
                                : "If-Then"}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditConstraint(c)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
                          title={isVi ? "Chỉnh sửa" : "Edit"}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteConstraint(c.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                          title={isVi ? "Xóa" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Rule Visual Formula */}
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 font-mono text-[11px] space-y-1">
                      {c.type === "incompatible" ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-rose-600 dark:text-rose-400 font-bold not-mono text-[10px] uppercase tracking-wide">
                            {isVi ? "🚫 CẤM CÙNG LÚC:" : "🚫 FORBIDDEN:"}
                          </span>
                          {c.conditions.map((cond, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span className="text-slate-400 font-bold">+</span>}
                              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                <span className="text-slate-400 text-[10px]">{cond.paramName} = </span>
                                <span className="text-rose-600 dark:text-rose-400 font-bold">{cond.value}</span>
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold not-mono text-[10px] uppercase tracking-wide">
                            {isVi ? "NẾU:" : "IF:"}
                          </span>
                          {c.conditions.map((cond, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span className="text-slate-400 font-bold">&</span>}
                              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                <span className="text-slate-400 text-[10px]">
                                  {cond.paramName} {cond.operator === "equals" ? "=" : "!="}{" "}
                                </span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{cond.value}</span>
                              </span>
                            </React.Fragment>
                          ))}
                          <span className="text-slate-400 font-bold">➔</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold not-mono text-[10px] uppercase tracking-wide">
                            {isVi ? "THÌ:" : "THEN:"}
                          </span>
                          {c.thenClause && (
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                              <span className="text-slate-400 text-[10px]">
                                {c.thenClause.paramName} {c.thenClause.operator === "equals" ? "=" : "!="}{" "}
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {c.thenClause.value}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Test Cases Results Card (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-4 sm:p-5 shadow-sm">
          {/* Top header with View Switcher Tabs and Export buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              <button
                onClick={() => setActiveTab("optimal")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === "optimal"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isVi ? "Test Cases Tối Ưu" : "Optimal Cases"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold">
                  {pairwiseResult.testCases.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("excluded")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === "excluded"
                    ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-sm border border-amber-300/60 dark:border-amber-700/60"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                }`}
              >
                <FilterX className="w-3.5 h-3.5 text-amber-500" />
                <span>{isVi ? "Đã Loại Trừ" : "Excluded Cases"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold">
                  {pairwiseResult.excludedCount.toLocaleString()}
                </span>
              </button>
            </div>

            {/* Export buttons */}
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => handleCopyCurrent("markdown")}
                className="h-8 px-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all font-medium flex items-center gap-1 cursor-pointer"
                title="Copy as Markdown table"
              >
                {copiedType === "markdown" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5 text-indigo-500" />}
                <span>{copiedType === "markdown" ? (isVi ? "Đã chép" : "Copied") : "Markdown"}</span>
              </button>

              <button
                onClick={() => handleCopyCurrent("csv")}
                className="h-8 px-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all font-medium flex items-center gap-1 cursor-pointer"
                title="Copy as CSV"
              >
                {copiedType === "csv" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />}
                <span>{copiedType === "csv" ? (isVi ? "Đã chép" : "Copied") : "CSV"}</span>
              </button>

              <button
                onClick={() => handleCopyCurrent("json")}
                className="h-8 px-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all font-medium flex items-center gap-1 cursor-pointer"
                title="Copy as JSON array"
              >
                {copiedType === "json" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileCode className="w-3.5 h-3.5 text-indigo-500" />}
                <span>{copiedType === "json" ? (isVi ? "Đã chép" : "Copied") : "JSON"}</span>
              </button>

              <button
                onClick={handleDownloadCsv}
                disabled={isDownloadingCsv}
                className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isVi ? "Tải CSV (chọn nơi lưu và đặt tên file)" : "Download CSV (select save location and filename)"}
              >
                {isDownloadingCsv ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                    <span>{isVi ? "Đang lưu..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Download CSV Success Banner */}
          {lastDownloadedCsv && (
            <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">
                  {isVi ? "Đã lưu thành công file CSV:" : "Successfully saved CSV file:"}{" "}
                  <strong className="font-mono text-emerald-900 dark:text-emerald-200">{lastDownloadedCsv}</strong>
                </span>
              </div>
              <button
                onClick={() => setLastDownloadedCsv(null)}
                className="p-1 rounded-md hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 cursor-pointer shrink-0"
                title={isVi ? "Đóng thông báo" : "Close"}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Excluded Cases Educational Callout (When on Excluded Tab) */}
          {activeTab === "excluded" && (
            <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-xs text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {isVi
                      ? `Đã loại trừ ${pairwiseResult.excludedCount.toLocaleString()} test case thừa (Tiết kiệm ${pairwiseResult.reductionPercentage}%)`
                      : `Excluded ${pairwiseResult.excludedCount.toLocaleString()} redundant test cases (-${pairwiseResult.reductionPercentage}%)`}
                  </span>
                  {excludedData.isTruncated && (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-mono">
                      {isVi ? `Hiển thị ${excludedData.excludedCases.length} mẫu` : `Showing ${excludedData.excludedCases.length} sample`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  {isVi
                    ? "Tất cả các tổ hợp dưới đây đã được thuật toán All-Pairs lược bỏ vì mọi cặp tương tác 2 chiều trong đó đều đã xuất hiện ở danh sách Test Case Tối Ưu. Cột trạng thái bên dưới hiển thị rõ lý do và danh sách các Case tối ưu đã kiểm tra toàn bộ các cặp này."
                    : "These combinatorial cases were safely excluded by the All-Pairs algorithm because all their 2-way parameter interactions are already covered in the Optimal Test Cases list."}
                </p>
              </div>
            </div>
          )}

          {/* Search bar & Limit Selector */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "optimal"
                    ? isVi
                      ? "Tìm kiếm trong test cases tối ưu..."
                      : "Search optimal test cases..."
                    : isVi
                    ? "Tìm kiếm trong test cases đã loại trừ..."
                    : "Search excluded test cases..."
                }
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>

            {/* Limit Selector when on Excluded Tab */}
            {activeTab === "excluded" && pairwiseResult.excludedCount > 100 && (
              <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                <span className="hidden sm:inline">{isVi ? "Giới hạn mẫu:" : "Limit:"}</span>
                <select
                  value={excludedLimit}
                  onChange={(e) => setExcludedLimit(Number(e.target.value))}
                  className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={100}>100 {isVi ? "mẫu" : "cases"}</option>
                  <option value={250}>250 {isVi ? "mẫu" : "cases"}</option>
                  <option value={500}>500 {isVi ? "mẫu" : "cases"}</option>
                  <option value={1000}>1000 {isVi ? "mẫu" : "cases"}</option>
                </select>
              </div>
            )}
          </div>

          {/* Test cases table view */}
          <div className="overflow-x-auto max-h-[500px] border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  {pairwiseResult.parameters.map((param) => (
                    <th key={param.id} className="py-2.5 px-3 min-w-[130px]">
                      {param.name}
                    </th>
                  ))}
                  {activeTab === "excluded" && (
                    <th className="py-2.5 px-3 min-w-[280px]">
                      {isVi ? "Lý do & Ca kiểm thử đã phủ (Covered By)" : "Reason & Covering Test Cases"}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
                {filteredTestCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={pairwiseResult.parameters.length + (activeTab === "excluded" ? 2 : 1)}
                      className="py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      {activeTab === "excluded" && pairwiseResult.excludedCount === 0
                        ? isVi
                          ? "Không có test case nào bị loại trừ (Toàn bộ tổ hợp đều cần thiết để phủ các cặp)."
                          : "No test cases excluded (All combinations are required for full coverage)."
                        : isVi
                        ? "Không tìm thấy test case nào phù hợp với bộ lọc"
                        : "No matching test cases found"}
                    </td>
                  </tr>
                ) : (
                  filteredTestCases.map((tc, idx) => {
                    const isExcluded = activeTab === "excluded";
                    const excItem = isExcluded ? (tc as ExcludedCaseItem) : null;

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        {pairwiseResult.parameters.map((param, pIdx) => {
                          const val = tc[param.name] || "-";
                          const badgeStyle = BADGE_COLORS[pIdx % BADGE_COLORS.length];
                          return (
                            <td key={param.id} className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${badgeStyle}`}
                              >
                                {val}
                              </span>
                            </td>
                          );
                        })}

                        {/* Status, Covering Cases & Reason Column for Excluded Cases */}
                        {isExcluded && excItem && (
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1.5">
                              {/* Top row: Status tag + Covering cases pills or Constraint violation badge */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {excItem.isConstraintViolation ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300/40 dark:border-rose-700/40 shrink-0">
                                      <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                      {isVi ? "Vi phạm ràng buộc" : "Constraint Violation"}
                                    </span>
                                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 truncate">
                                      {excItem.violatedConstraintName}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/40 shrink-0">
                                      <Ban className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                      {isVi ? "Đã loại trừ" : "Excluded"}
                                    </span>

                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">
                                      {isVi ? "Được phủ bởi:" : "Covered in:"}
                                    </span>

                                    <div className="flex flex-wrap items-center gap-1">
                                      {excItem.coveringCaseIds?.map((cId) => (
                                        <button
                                          key={cId}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab("optimal");
                                          }}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                          title={
                                            isVi
                                              ? `Bấm để chuyển sang xem Case #${cId} trong bảng tối ưu`
                                              : `Click to view Case #${cId} in optimal matrix`
                                          }
                                        >
                                          Case #{cId}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Bottom row: Reason explanation & view pair breakdown */}
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="truncate" title={isVi ? excItem.reasonVi : excItem.reasonEn}>
                                  {excItem.isConstraintViolation
                                    ? isVi
                                      ? `Không cho phép kết hợp các điều kiện này theo quy tắc ràng buộc`
                                      : `Disallowed by constraint rule`
                                    : isVi
                                    ? `Trùng ${excItem.bestMatchParamCount}/${pairwiseResult.parameters.length} tham số với Case #${excItem.bestMatchCaseId}`
                                    : `Matches ${excItem.bestMatchParamCount}/${pairwiseResult.parameters.length} params with Case #${excItem.bestMatchCaseId}`}
                                </span>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedExcludedCase(excItem);
                                  }}
                                  className={`${
                                    excItem.isConstraintViolation
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-indigo-600 dark:text-indigo-400"
                                  } hover:underline shrink-0 text-[10px] font-semibold flex items-center gap-1 cursor-pointer`}
                                  title={
                                    excItem.isConstraintViolation
                                      ? isVi
                                        ? "Xem chi tiết quy tắc vi phạm"
                                        : "View violated constraint details"
                                      : isVi
                                      ? "Xem chi tiết từng cặp tương tác 2 chiều và ca kiểm thử phủ nó"
                                      : "View pair-by-pair coverage breakdown"
                                  }
                                >
                                  <span>{excItem.isConstraintViolation ? (isVi ? "Xem lý do" : "Rule details") : (isVi ? "Chi tiết cặp" : "Pair details")}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pair Coverage / Constraint Breakdown Modal */}
      {selectedExcludedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      selectedExcludedCase.isConstraintViolation
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {selectedExcludedCase.isConstraintViolation ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedExcludedCase.isConstraintViolation
                      ? isVi
                        ? `Tổ Hợp Vi Phạm Ràng Buộc #${selectedExcludedCase.id}`
                        : `Constraint Violation Case #${selectedExcludedCase.id}`
                      : isVi
                      ? `Chi Tiết Phủ Cặp: Test Case Đã Loại Trừ #${selectedExcludedCase.id}`
                      : `Pair Coverage Breakdown: Excluded Case #${selectedExcludedCase.id}`}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedExcludedCase.isConstraintViolation
                    ? isVi
                      ? `Tổ hợp này bị loại trừ do vi phạm quy tắc: "${selectedExcludedCase.violatedConstraintName}"`
                      : `Excluded because it violates constraint: "${selectedExcludedCase.violatedConstraintName}"`
                    : isVi
                    ? "Minh chứng kỹ thuật: Mọi cặp tương tác 2 chiều trong tổ hợp này đều đã được kiểm tra bởi các Case tối ưu."
                    : "Technical verification: Every 2-way interaction pair in this combination is already covered."}
                </p>
              </div>

              <button
                onClick={() => setSelectedExcludedCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Combination Parameter Values */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                {isVi ? "Cấu hình của trường hợp này:" : "Parameters in this test combination:"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {pairwiseResult.parameters.map((p, pIdx) => {
                  const val = selectedExcludedCase[p.name];
                  const badgeStyle = BADGE_COLORS[pIdx % BADGE_COLORS.length];
                  return (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border ${badgeStyle}`}
                    >
                      <span className="text-[10px] opacity-75 font-normal">{p.name}:</span>
                      <span>{val}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Coverage Summary or Violation Callout */}
            {selectedExcludedCase.isConstraintViolation ? (
              <div className="p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>
                    {isVi
                      ? `Vi phạm ràng buộc: ${selectedExcludedCase.violatedConstraintName}`
                      : `Constraint Violation: ${selectedExcludedCase.violatedConstraintName}`}
                  </span>
                </div>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                  {isVi
                    ? "Tổ hợp các điều kiện trên vi phạm quy tắc logic nghiệp vụ đã kích hoạt. Thuật toán All-Pairs tự động ngăn chặn tổ hợp này không được sinh ra trong bộ test case thực tế."
                    : "This combination is forbidden by business constraint rules. The All-Pairs engine automatically prevents it from appearing in optimal test cases."}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>
                    {isVi
                      ? `100% Cặp tương tác (${selectedExcludedCase.totalPairs}/${selectedExcludedCase.totalPairs}) đã được kiểm thử`
                      : `100% 2-Way Pairs (${selectedExcludedCase.totalPairs}/${selectedExcludedCase.totalPairs}) Tested`}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                  {isVi
                    ? `Tập hợp các ca kiểm thử tối ưu [Case #${selectedExcludedCase.coveringCaseIds.join(", Case #")}] cùng nhau bao phủ đầy đủ tất cả các cặp tương tác 2 chiều bên dưới.`
                    : `Optimal test cases [Case #${selectedExcludedCase.coveringCaseIds.join(", Case #")}] collectively cover all 2-way interactions below.`}
                </p>
              </div>
            )}

            {/* Pairs Breakdown Table */}
            <div className="overflow-y-auto max-h-[300px] border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3">{isVi ? "Cặp tương tác 2 chiều (Pair)" : "2-Way Interaction Pair"}</th>
                    <th className="py-2 px-3 text-right">{isVi ? "Được kiểm tra bởi" : "Covered In"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
                  {selectedExcludedCase.pairsDetail?.map((pair, pIdx) => (
                    <tr key={pIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 text-center font-mono text-slate-400">{pIdx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {pair.paramAName} = <span className="text-indigo-600 dark:text-indigo-400">{pair.valA}</span>
                          </span>
                          <span className="text-slate-400 font-bold">⨉</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {pair.paramBName} = <span className="text-indigo-600 dark:text-indigo-400">{pair.valB}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          Case #{pair.coveredByCaseId}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {isVi
                  ? `Trùng ${selectedExcludedCase.bestMatchParamCount}/${pairwiseResult.parameters.length} tham số với Case #${selectedExcludedCase.bestMatchCaseId}`
                  : `Matches ${selectedExcludedCase.bestMatchParamCount}/${pairwiseResult.parameters.length} params with Case #${selectedExcludedCase.bestMatchCaseId}`}
              </span>
              <button
                onClick={() => {
                  setSelectedExcludedCase(null);
                  setActiveTab("optimal");
                }}
                className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{isVi ? "Xem Bảng Tối Ưu" : "View Optimal Matrix"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Educational QA Tip Accordion / Card */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5 text-xs text-slate-700 dark:text-slate-300 space-y-2">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
          <HelpCircle className="w-4 h-4" />
          <span>
            {isVi
              ? "Tại sao Kiểm Thử Tổ Hợp Tối Ưu (Pairwise / All-Pairs) lại là 'Bảo Bối' của QA/Tester?"
              : "Why Pairwise / All-Pairs Testing is a QA Essential?"}
          </span>
        </div>
        <p className="leading-relaxed text-slate-600 dark:text-slate-300">
          {isVi
            ? "Theo các nghiên cứu thực nghiệm từ Viện Tiêu chuẩn và Kỹ thuật Quốc gia Hoa Kỳ (NIST) và chuẩn ISTQB: Đa số các lỗi phần mềm nghiêm trọng (>80%) được kích hoạt bởi sự tương tác giữa tối đa 2 tham số (2-way interactions), và >95% lỗi bởi 3 tham số. Kỹ thuật All-Pairs cho phép bạn kiểm thử 100% tất cả các cặp tương tác với số lượng test case ít hơn từ 70% đến 95% so với ma trận tổ hợp thông thường."
            : "According to empirical research by NIST and ISTQB standards: The vast majority of software defects (>80%) are triggered by interactions between at most 2 parameters (2-way interactions), and >95% by 3 parameters. Pairwise testing guarantees 100% coverage of all pairs while cutting total test cases by 70% to 95% compared to exhaustive combinations."}
        </p>
      </div>

      {/* Bulk Text Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isVi ? "Nhập nhanh từ văn bản (Bulk Text Import)" : "Bulk Text Import"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isVi
                  ? "Mỗi dòng là 1 tham số theo cú pháp: TênThamSố: GiáTrị1, GiáTrị2, GiáTrị3"
                  : "Format each line as: ParameterName: Value1, Value2, Value3"}
              </p>
            </div>

            <textarea
              rows={6}
              value={bulkInputText}
              onChange={(e) => setBulkInputText(e.target.value)}
              placeholder="Browser: Chrome, Firefox, Safari&#10;OS: Windows, macOS, Linux&#10;UserRole: Admin, Guest"
              className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="h-9 px-3.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
              >
                {isVi ? "Hủy" : "Cancel"}
              </button>
              <button
                onClick={handleApplyBulkText}
                className="h-9 px-4 text-xs rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {isVi ? "Áp Dụng" : "Apply Parameters"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Constraint Add/Edit Modal */}
      {isConstraintModalOpen && editingConstraint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {constraints.some((c) => c.id === editingConstraint.id)
                    ? isVi
                      ? "Chỉnh Sửa Ràng Buộc Điều Kiện"
                      : "Edit Condition Constraint"
                    : isVi
                    ? "Thêm Ràng Buộc Điều Kiện Mới"
                    : "Add New Condition Constraint"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsConstraintModalOpen(false);
                  setEditingConstraint(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Constraint Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isVi ? "Tên gợi nhớ quy tắc:" : "Rule Name:"}
                </label>
                <input
                  type="text"
                  value={editingConstraint.name}
                  onChange={(e) =>
                    setEditingConstraint({ ...editingConstraint, name: e.target.value })
                  }
                  placeholder={
                    isVi
                      ? "Ví dụ: Điều kiện A kết hợp B thì cấm C, hoặc Safari không hỗ trợ Windows..."
                      : "e.g. Incompatible OS and Browser..."
                  }
                  className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  {isVi ? "Loại ràng buộc:" : "Constraint Type:"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Incompatible */}
                  <div
                    onClick={() =>
                      setEditingConstraint({
                        ...editingConstraint,
                        type: "incompatible",
                      })
                    }
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1 ${
                      editingConstraint.type === "incompatible"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>{isVi ? "Cấm kết hợp đồng thời" : "Incompatible Combination"}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isVi
                        ? "Các giá trị được chọn KHÔNG ĐƯỢC cùng xuất hiện trong 1 test case (Hỗ trợ 2, 3 điều kiện trở lên)."
                        : "Specified values cannot appear together in any test case (Supports 2, 3 or more conditions)."}
                    </p>
                  </div>

                  {/* Option 2: If-Then */}
                  <div
                    onClick={() =>
                      setEditingConstraint({
                        ...editingConstraint,
                        type: "if_then",
                        thenClause:
                          editingConstraint.thenClause || {
                            paramName: parameters[1]?.name || parameters[0]?.name || "",
                            operator: "equals",
                            value:
                              parameters[1]?.values[0] || parameters[0]?.values[0] || "",
                          },
                      })
                    }
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1 ${
                      editingConstraint.type === "if_then"
                        ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{isVi ? "Điều kiện Nếu... Thì..." : "Conditional (If-Then)"}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isVi
                        ? "NẾU thỏa mãn điều kiện thì tham số đích BẮT BUỘC nhận giá trị tương ứng."
                        : "IF condition premise holds, target parameter MUST satisfy the specified value."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Conditions Builder for Incompatible */}
              {editingConstraint.type === "incompatible" && (
                <div className="space-y-2.5 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-rose-500" />
                      <span>{isVi ? "Các điều kiện KHÔNG ĐƯỢC cùng xuất hiện (AND):" : "Values that CANNOT co-exist (AND):"}</span>
                    </label>
                    <button
                      onClick={() => {
                        const unusedParam =
                          parameters.find(
                            (p) => !editingConstraint.conditions.some((cd) => cd.paramName === p.name)
                          ) || parameters[0];
                        setEditingConstraint({
                          ...editingConstraint,
                          conditions: [
                            ...editingConstraint.conditions,
                            {
                              paramName: unusedParam.name,
                              operator: "equals",
                              value: unusedParam.values[0] || "",
                            },
                          ],
                        });
                      }}
                      className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isVi ? "+ Thêm điều kiện (AND)" : "+ Add Condition"}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editingConstraint.conditions.map((cond, idx) => {
                      const paramObj = parameters.find((p) => p.name === cond.paramName);
                      const currentVals = paramObj ? paramObj.values : [];

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>

                          {/* Parameter select */}
                          <select
                            value={cond.paramName}
                            onChange={(e) => {
                              const newParamName = e.target.value;
                              const targetParam = parameters.find((p) => p.name === newParamName);
                              const newConditions = [...editingConstraint.conditions];
                              newConditions[idx] = {
                                ...cond,
                                paramName: newParamName,
                                value: targetParam?.values[0] || "",
                              };
                              setEditingConstraint({ ...editingConstraint, conditions: newConditions });
                            }}
                            className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-rose-500 font-medium cursor-pointer"
                          >
                            {parameters.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </select>

                          <span className="text-xs font-bold text-slate-400">=</span>

                          {/* Value select */}
                          <select
                            value={cond.value}
                            onChange={(e) => {
                              const newConditions = [...editingConstraint.conditions];
                              newConditions[idx] = { ...cond, value: e.target.value };
                              setEditingConstraint({ ...editingConstraint, conditions: newConditions });
                            }}
                            className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-rose-500 font-medium cursor-pointer"
                          >
                            {currentVals.map((v, vIdx) => (
                              <option key={vIdx} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>

                          {/* Remove clause button */}
                          {editingConstraint.conditions.length > 2 && (
                            <button
                              onClick={() => {
                                setEditingConstraint({
                                  ...editingConstraint,
                                  conditions: editingConstraint.conditions.filter((_, i) => i !== idx),
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md transition-colors cursor-pointer"
                              title={isVi ? "Xóa điều kiện này" : "Remove condition"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conditions Builder for If-Then */}
              {editingConstraint.type === "if_then" && (
                <div className="space-y-3.5 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
                  {/* IF part */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-[10px] font-bold">
                          {isVi ? "NẾU" : "IF"}
                        </span>
                        <span>{isVi ? "Khi các điều kiện sau xảy ra:" : "When premise conditions match:"}</span>
                      </label>
                      <button
                        onClick={() => {
                          const unusedParam =
                            parameters.find(
                              (p) => !editingConstraint.conditions.some((cd) => cd.paramName === p.name)
                            ) || parameters[0];
                          setEditingConstraint({
                            ...editingConstraint,
                            conditions: [
                              ...editingConstraint.conditions,
                              {
                                paramName: unusedParam.name,
                                operator: "equals",
                                value: unusedParam.values[0] || "",
                              },
                            ],
                          });
                        }}
                        className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isVi ? "+ Thêm điều kiện NẾU" : "+ Add IF Clause"}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {editingConstraint.conditions.map((cond, idx) => {
                        const paramObj = parameters.find((p) => p.name === cond.paramName);
                        const currentVals = paramObj ? paramObj.values : [];

                        return (
                          <div key={idx} className="flex items-center gap-2">
                            {/* Param select */}
                            <select
                              value={cond.paramName}
                              onChange={(e) => {
                                const newParamName = e.target.value;
                                const targetParam = parameters.find((p) => p.name === newParamName);
                                const newConditions = [...editingConstraint.conditions];
                                newConditions[idx] = {
                                  ...cond,
                                  paramName: newParamName,
                                  value: targetParam?.values[0] || "",
                                };
                                setEditingConstraint({ ...editingConstraint, conditions: newConditions });
                              }}
                              className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                            >
                              {parameters.map((p) => (
                                <option key={p.id} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </select>

                            {/* Operator select */}
                            <select
                              value={cond.operator}
                              onChange={(e) => {
                                const newConditions = [...editingConstraint.conditions];
                                newConditions[idx] = {
                                  ...cond,
                                  operator: e.target.value as ConstraintOperator,
                                };
                                setEditingConstraint({ ...editingConstraint, conditions: newConditions });
                              }}
                              className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 w-24 shrink-0 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                            >
                              <option value="equals">{isVi ? "Bằng (=)" : "Equals (=)"}</option>
                              <option value="not_equals">{isVi ? "Khác (!=)" : "Not Equals (!=)"}</option>
                            </select>

                            {/* Value select */}
                            <select
                              value={cond.value}
                              onChange={(e) => {
                                const newConditions = [...editingConstraint.conditions];
                                newConditions[idx] = { ...cond, value: e.target.value };
                                setEditingConstraint({ ...editingConstraint, conditions: newConditions });
                              }}
                              className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                            >
                              {currentVals.map((v, vIdx) => (
                                <option key={vIdx} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>

                            {editingConstraint.conditions.length > 1 && (
                              <button
                                onClick={() => {
                                  setEditingConstraint({
                                    ...editingConstraint,
                                    conditions: editingConstraint.conditions.filter((_, i) => i !== idx),
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* THEN part */}
                  <div className="pt-2 border-t border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
                    <label className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-[10px] font-bold">
                        {isVi ? "THÌ" : "THEN"}
                      </span>
                      <span>{isVi ? "Tham số kết quả bắt buộc:" : "Target parameter requirement:"}</span>
                    </label>

                    {editingConstraint.thenClause && (
                      <div className="flex items-center gap-2">
                        {/* Target Param select */}
                        <select
                          value={editingConstraint.thenClause.paramName}
                          onChange={(e) => {
                            const newParamName = e.target.value;
                            const targetParam = parameters.find((p) => p.name === newParamName);
                            setEditingConstraint({
                              ...editingConstraint,
                              thenClause: {
                                ...editingConstraint.thenClause!,
                                paramName: newParamName,
                                value: targetParam?.values[0] || "",
                              },
                            });
                          }}
                          className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                        >
                          {parameters.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>

                        {/* Target Operator select */}
                        <select
                          value={editingConstraint.thenClause.operator}
                          onChange={(e) => {
                            setEditingConstraint({
                              ...editingConstraint,
                              thenClause: {
                                ...editingConstraint.thenClause!,
                                operator: e.target.value as ConstraintOperator,
                              },
                            });
                          }}
                          className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 w-36 shrink-0 focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                        >
                          <option value="equals">{isVi ? "Bắt buộc bằng (=)" : "Must Equal (=)"}</option>
                          <option value="not_equals">{isVi ? "Không được là (!=)" : "Must Not Equal (!=)"}</option>
                        </select>

                        {/* Target Value select */}
                        <select
                          value={editingConstraint.thenClause.value}
                          onChange={(e) => {
                            setEditingConstraint({
                              ...editingConstraint,
                              thenClause: {
                                ...editingConstraint.thenClause!,
                                value: e.target.value,
                              },
                            });
                          }}
                          className="h-9 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1 focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                        >
                          {(
                            parameters.find((p) => p.name === editingConstraint.thenClause?.paramName)
                              ?.values || []
                          ).map((v, vIdx) => (
                            <option key={vIdx} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Human-Readable Rule Preview */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  {isVi ? "📌 Diễn giải quy tắc thực tế:" : "📌 Plain English Meaning:"}
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {editingConstraint.type === "incompatible" ? (
                    <>
                      {isVi ? "Không cho phép bất kỳ test case nào xuất hiện đồng thời: " : "Disallow any test case having simultaneously: "}
                      {editingConstraint.conditions.map((c, i) => (
                        <span key={i}>
                          {i > 0 && <span className="font-bold text-slate-400"> VÀ </span>}
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            [{c.paramName} = {c.value}]
                          </span>
                        </span>
                      ))}
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">NẾU </span>
                      {editingConstraint.conditions.map((c, i) => (
                        <span key={i}>
                          {i > 0 && <span className="font-bold text-slate-400"> VÀ </span>}
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            [{c.paramName} {c.operator === "equals" ? "=" : "!="} {c.value}]
                          </span>
                        </span>
                      ))}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400"> ➔ THÌ </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        [{editingConstraint.thenClause?.paramName}{" "}
                        {editingConstraint.thenClause?.operator === "equals"
                          ? "BẮT BUỘC BẰNG"
                          : "KHÔNG ĐƯỢC LÀ"}{" "}
                        {editingConstraint.thenClause?.value}]
                      </span>
                    </>
                  )}
                </p>
              </div>

              {/* Optional Description */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  {isVi ? "Ghi chú giải thích (Tùy chọn):" : "Description / Notes (Optional):"}
                </label>
                <input
                  type="text"
                  value={editingConstraint.description || ""}
                  onChange={(e) =>
                    setEditingConstraint({ ...editingConstraint, description: e.target.value })
                  }
                  placeholder={
                    isVi
                      ? "Giải thích lý do kỹ thuật hoặc nghiệp vụ..."
                      : "Technical or business rationale..."
                  }
                  className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => {
                  setIsConstraintModalOpen(false);
                  setEditingConstraint(null);
                }}
                className="h-9 px-4 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {isVi ? "Hủy" : "Cancel"}
              </button>
              <button
                onClick={() => handleSaveConstraint(editingConstraint)}
                className="h-9 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isVi ? "Lưu Ràng Buộc" : "Save Constraint"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      }
    />
  );
};
