import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  RefreshCw,
  Copy,
  Check,
  Download,
  Table as TableIcon,
  FileCode,
  FileSpreadsheet,
  Database,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Globe2,
  Hash,
  UserCheck,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  X,
  Sparkles,
  RotateCcw,
  Tag,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import { ToolLayout } from "../../components/common/ToolLayout";
import {
  DEFAULT_MOCK_FIELDS,
  CustomFieldDef,
  FieldDataType,
  SupportedLocale,
  MockRecord,
  generateMockDataset,
  exportMockToJson,
  exportMockToCsv,
  exportMockToSql,
} from "./fakeDataEngine";
import { generateMatchingString } from "../regex-reverse-generator/regexReverseEngine";

interface CustomFieldPreset {
  labelVi: string;
  labelEn: string;
  field: CustomFieldDef;
}

const PRESET_CUSTOM_FIELDS: CustomFieldPreset[] = [
  {
    labelVi: "Trạng thái đơn (Order Status)",
    labelEn: "Order Status",
    field: {
      id: "order_status",
      name: "status",
      nameVi: "Trạng Thái Đơn Hàng",
      dataType: "options-list",
      optionsList: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Vai trò người dùng (User Role)",
    labelEn: "User Role",
    field: {
      id: "user_role",
      name: "role",
      nameVi: "Vai Trò Phân Quyền",
      dataType: "options-list",
      optionsList: ["ADMIN", "MANAGER", "EDITOR", "STAFF", "CUSTOMER"],
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Mã SKU (SKU-####-??)",
    labelEn: "SKU Code (SKU-####-??)",
    field: {
      id: "item_sku",
      name: "sku",
      nameVi: "Mã Sản Phẩm (SKU)",
      dataType: "text-pattern",
      textPattern: "SKU-####-??",
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Mã đơn hàng (ORD-####)",
    labelEn: "Order Code (ORD-####)",
    field: {
      id: "order_code",
      name: "orderCode",
      nameVi: "Mã Số Đơn Hàng",
      dataType: "text-pattern",
      textPattern: "ORD-####-????",
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Mức lương (Salary)",
    labelEn: "Salary / Income",
    field: {
      id: "salary_amt",
      name: "salary",
      nameVi: "Mức Lương Ước Tính",
      dataType: "number-range",
      numberMin: 10000000,
      numberMax: 50000000,
      numberDecimals: 0,
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Điểm tín nhiệm (Score)",
    labelEn: "Credit Score",
    field: {
      id: "credit_score",
      name: "creditScore",
      nameVi: "Điểm Tín Nhiệm",
      dataType: "number-range",
      numberMin: 300,
      numberMax: 850,
      numberDecimals: 0,
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Kích hoạt (isActive)",
    labelEn: "Is Active (Boolean)",
    field: {
      id: "is_active",
      name: "isActive",
      nameVi: "Kích Hoạt (isActive)",
      dataType: "boolean",
      booleanFormat: "true/false",
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Mã bưu vận (Tracking Code)",
    labelEn: "Tracking Number (Regex)",
    field: {
      id: "tracking_no",
      name: "trackingCode",
      nameVi: "Mã Vận Đơn (Regex)",
      dataType: "custom-regex",
      customRegex: "^VN\\d{8}[A-Z]{2}$",
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Mã băm giao dịch (Tx Hash)",
    labelEn: "Tx Hash (0x...)",
    field: {
      id: "tx_hash",
      name: "txHash",
      nameVi: "Mã Giao Dịch Băm",
      dataType: "custom-regex",
      customRegex: "^0x[a-f0-9]{16}$",
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Ngày đặt hàng (Order Date)",
    labelEn: "Order Date Range",
    field: {
      id: "order_date",
      name: "orderDate",
      nameVi: "Ngày Đặt Hàng",
      dataType: "date-range",
      dateFrom: "2024-01-01",
      dateTo: "2026-12-31",
      enabled: true,
      isCustom: true,
    },
  },
  {
    labelVi: "Ghi chú đơn (Notes)",
    labelEn: "Order Notes",
    field: {
      id: "order_notes",
      name: "notes",
      nameVi: "Ghi Chú Đơn Hàng",
      dataType: "lorem-sentence",
      enabled: true,
      isCustom: true,
    },
  },
];

export const FakeDataGenerator: React.FC = () => {
  const { language } = useTranslation();
  const isVi = language === "vi";

  // Configuration state
  const [count, setCount] = useState<number>(10);
  const [locale, setLocale] = useState<SupportedLocale>(isVi ? "vi" : "en");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(60);

  // Field definitions state (persisted to localStorage)
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>(() => {
    try {
      const saved = localStorage.getItem("devtool_fake_data_custom_fields");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_MOCK_FIELDS;
  });

  // Save fields changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("devtool_fake_data_custom_fields", JSON.stringify(customFields));
    } catch {
      // ignore
    }
  }, [customFields]);

  // Tab & Format states
  const [activeTab, setActiveTab] = useState<"table" | "json" | "csv" | "sql">("table");
  const [sqlTableName, setSqlTableName] = useState("users");
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showFieldConfig, setShowFieldConfig] = useState(false);

  // Modal State for Adding/Editing Custom Fields
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formNameVi, setFormNameVi] = useState("");
  const [formDataType, setFormDataType] = useState<FieldDataType>("options-list");
  const [formOptionsList, setFormOptionsList] = useState("PENDING, PROCESSING, COMPLETED, CANCELLED");
  const [formNumberMin, setFormNumberMin] = useState(0);
  const [formNumberMax, setFormNumberMax] = useState(100);
  const [formNumberDecimals, setFormNumberDecimals] = useState(0);
  const [formTextPattern, setFormTextPattern] = useState("ORD-####-??");
  const [formBooleanFormat, setFormBooleanFormat] = useState<"true/false" | "1/0" | "Yes/No">("true/false");
  const [formDateFrom, setFormDateFrom] = useState("2024-01-01");
  const [formDateTo, setFormDateTo] = useState("2026-12-31");
  const [formCustomRegex, setFormCustomRegex] = useState("^[A-Z]{3}-\\d{4}$");
  const [formError, setFormError] = useState<string | null>(null);

  // Live preview for regex
  const regexPreview = useMemo(() => {
    if (formDataType !== "custom-regex") return "";
    try {
      return generateMatchingString(formCustomRegex || "^[A-Z]{3}-\\d{4}$");
    } catch {
      return "Regex không hợp lệ";
    }
  }, [formDataType, formCustomRegex]);

  // Dataset generation trigger
  const [seed, setSeed] = useState(0);

  const dataset: MockRecord[] = useMemo(() => {
    return generateMockDataset({
      count,
      locale,
      gender,
      minAge,
      maxAge,
      customFields,
    });
  }, [count, locale, gender, minAge, maxAge, customFields, seed]);

  const activeFields = useMemo(() => customFields.filter((f) => f.enabled), [customFields]);

  const handleRegenerate = () => {
    setSeed((s) => s + 1);
  };

  const handleToggleField = (fieldId: string) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleOpenAddModal = () => {
    setEditingFieldId(null);
    setFormName("");
    setFormNameVi("");
    setFormDataType("options-list");
    setFormOptionsList("PENDING, PROCESSING, COMPLETED, CANCELLED");
    setFormNumberMin(0);
    setFormNumberMax(1000);
    setFormNumberDecimals(0);
    setFormTextPattern("ORD-####-??");
    setFormBooleanFormat("true/false");
    setFormDateFrom("2024-01-01");
    setFormDateTo("2026-12-31");
    setFormCustomRegex("^[A-Z]{3}-\\d{4}$");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (field: CustomFieldDef) => {
    setEditingFieldId(field.id);
    setFormName(field.name);
    setFormNameVi(field.nameVi || field.name);
    setFormDataType(field.dataType);
    setFormOptionsList(field.optionsList ? field.optionsList.join(", ") : "");
    setFormNumberMin(field.numberMin ?? 0);
    setFormNumberMax(field.numberMax ?? 100);
    setFormNumberDecimals(field.numberDecimals ?? 0);
    setFormTextPattern(field.textPattern ?? "ORD-####-??");
    setFormBooleanFormat(field.booleanFormat ?? "true/false");
    setFormDateFrom(field.dateFrom ?? "2024-01-01");
    setFormDateTo(field.dateTo ?? "2026-12-31");
    setFormCustomRegex(field.customRegex ?? "^[A-Z]{3}-\\d{4}$");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveField = () => {
    const cleanName = formName.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!cleanName) {
      setFormError(isVi ? "Vui lòng nhập mã định danh trường (Field Key / Name)" : "Field Name is required");
      return;
    }

    // Ensure uniqueness excluding the edited field
    const duplicate = customFields.find(
      (f) => f.id !== editingFieldId && (f.id === cleanName || f.name === cleanName)
    );
    if (duplicate) {
      setFormError(
        isVi
          ? "Tên trường này đã tồn tại trong danh sách, vui lòng đặt tên khác"
          : "Field name already exists, please choose another name"
      );
      return;
    }

    const parsedOptions = formOptionsList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updatedField: CustomFieldDef = {
      id: editingFieldId || cleanName,
      name: cleanName,
      nameVi: formNameVi.trim() || cleanName,
      dataType: formDataType,
      enabled: true,
      isCustom: true,
      optionsList: parsedOptions.length > 0 ? parsedOptions : ["Value 1", "Value 2"],
      numberMin: Number(formNumberMin),
      numberMax: Number(formNumberMax),
      numberDecimals: Number(formNumberDecimals),
      textPattern: formTextPattern.trim() || "ORD-####",
      booleanFormat: formBooleanFormat,
      dateFrom: formDateFrom,
      dateTo: formDateTo,
      customRegex: formCustomRegex.trim() || "^[A-Z]{3}-\\d{4}$",
    };

    if (editingFieldId) {
      setCustomFields((prev) => prev.map((f) => (f.id === editingFieldId ? updatedField : f)));
    } else {
      setCustomFields((prev) => [...prev, updatedField]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteCustomField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddPreset = (preset: CustomFieldPreset) => {
    const existing = customFields.find((f) => f.id === preset.field.id || f.name === preset.field.name);
    if (existing) {
      if (!existing.enabled) {
        setCustomFields((prev) =>
          prev.map((f) => (f.id === existing.id ? { ...f, enabled: true } : f))
        );
      }
      return;
    }
    setCustomFields((prev) => [...prev, { ...preset.field }]);
  };

  const handleResetFields = () => {
    setCustomFields(DEFAULT_MOCK_FIELDS);
    localStorage.removeItem("devtool_fake_data_custom_fields");
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolLayout
      id="fake-data-generator"
      title={isVi ? "Bộ Sinh Dữ Liệu Giả Lập Thực Tế (Mock Data Generator)" : "Realistic Mock & Fake Data Generator"}
      description={isVi
        ? "Tự do thêm trường tùy chỉnh (Danh sách, Khoảng số, Mask Pattern, Regex, Boolean) & Sinh dữ liệu chuẩn Việt Nam, Nhật Bản, Quốc tế."
        : "Add custom flexible fields (Options, Number range, Text patterns, Regex, Boolean) with authentic VN, JP & International profiles."}
      icon={Users}
      categoryName="generators"
      titleBadge={
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          {isVi ? "Tùy Biến Trường Linh Hoạt" : "Dynamic Custom Fields"}
        </span>
      }
      actionsRight={
        <button
          onClick={handleRegenerate}
          className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isVi ? "Tạo Dữ Liệu Mới" : "Generate New Data"}</span>
        </button>
      }
      customPanes={
        <div className="space-y-5">

      {/* Configuration Card */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Record Count */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isVi ? "Số lượng bản ghi:" : "Record Count:"}</span>
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-medium cursor-pointer"
            >
              {[5, 10, 25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} {isVi ? "bản ghi" : "records"}
                </option>
              ))}
            </select>
          </div>

          {/* Locale / Country */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isVi ? "Quốc gia / Định dạng:" : "Country / Locale:"}</span>
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as SupportedLocale)}
              className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-medium cursor-pointer"
            >
              <option value="vi">🇻🇳 Việt Nam (CCCD, SĐT, Tên VN)</option>
              <option value="ja">🇯🇵 日本 (Japan - マイナンバー, 漢字, 〒)</option>
              <option value="en">🇺🇸 International (US Format)</option>
            </select>
          </div>

          {/* Gender */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isVi ? "Giới tính:" : "Gender:"}</span>
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "all" | "male" | "female")}
              className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-medium cursor-pointer"
            >
              <option value="all">{isVi ? "Ngẫu nhiên (Nam & Nữ)" : "Random (Male & Female)"}</option>
              <option value="male">{isVi ? "Chỉ Nam" : "Male Only"}</option>
              <option value="female">{isVi ? "Chỉ Nữ" : "Female Only"}</option>
            </select>
          </div>

          {/* Age range */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isVi ? "Độ tuổi (Min - Max):" : "Age Range:"}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={maxAge}
                value={minAge}
                onChange={(e) => setMinAge(Number(e.target.value))}
                className="w-1/2 h-9 px-2 text-center text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-medium"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="number"
                min={minAge}
                max={100}
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                className="w-1/2 h-9 px-2 text-center text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition-all font-medium"
              />
            </div>
          </div>

          {/* Field Toggle Drawer Button */}
          <div className="flex flex-col justify-end">
            <button
              onClick={() => setShowFieldConfig(!showFieldConfig)}
              className="h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-2 font-medium cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isVi ? "Chọn & Tùy Biến Trường" : "Configure Fields"}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold">
                {activeFields.length}
              </span>
            </button>
          </div>
        </div>

        {/* Field Toggle Checkboxes & Custom Field Management Drawer */}
        {showFieldConfig && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
            {/* Top row with actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? "Danh sách trường dữ liệu:" : "Active Fields:"}
                </span>
                <span className="text-[11px] text-slate-400">
                  ({activeFields.length} / {customFields.length} {isVi ? "đang bật" : "enabled"})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddModal}
                  className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isVi ? "+ Thêm Trường Mới" : "+ Add Custom Field"}</span>
                </button>

                <button
                  onClick={handleResetFields}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  title={isVi ? "Khôi phục lại các trường mặc định" : "Reset to default fields"}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isVi ? "Mặc định" : "Reset"}</span>
                </button>
              </div>
            </div>

            {/* Quick Presets Section */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{isVi ? "Thêm nhanh mẫu trường thường dùng (Presets):" : "Quick Presets:"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CUSTOM_FIELDS.map((preset) => {
                  const isAlreadyAdded = customFields.some((f) => f.id === preset.field.id || f.name === preset.field.name);
                  return (
                    <button
                      key={preset.field.id}
                      onClick={() => handleAddPreset(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1 cursor-pointer ${
                        isAlreadyAdded
                          ? "bg-slate-200/60 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500"
                          : "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      }`}
                      title={isAlreadyAdded ? (isVi ? "Trường đã có trong danh sách" : "Field already exists") : (isVi ? "Bấm để thêm trường này" : "Click to add")}
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isVi ? preset.labelVi : preset.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {customFields.map((f) => {
                const isChecked = f.enabled;
                const isCustom = f.isCustom;

                return (
                  <div
                    key={f.id}
                    onClick={() => handleToggleField(f.id)}
                    className={`group min-h-[38px] px-3 py-1.5 rounded-lg border transition-all text-left flex items-center justify-between gap-2 text-xs cursor-pointer select-none ${
                      isChecked
                        ? isCustom
                          ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100 font-medium"
                          : "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/80 text-slate-800 dark:text-slate-200 font-medium"
                        : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="truncate flex flex-col">
                        <span className="truncate">{isVi ? (f.nameVi || f.name) : f.name}</span>
                        {isCustom && (
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono">
                            {f.name} ({f.dataType})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Custom Field Actions (Edit & Delete) */}
                    {isCustom && (
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(f);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/50 transition-colors"
                          title={isVi ? "Chỉnh sửa trường này" : "Edit field"}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteCustomField(f.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-900/50 transition-colors"
                          title={isVi ? "Xóa trường này" : "Delete field"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Output View Tabs & Actions */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
          {/* Format Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <button
              onClick={() => setActiveTab("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "table"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-500" />
              {isVi ? "Xem Bảng" : "Table View"}
            </button>

            <button
              onClick={() => setActiveTab("json")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "json"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-500" />
              JSON
            </button>

            <button
              onClick={() => setActiveTab("csv")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "csv"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
              CSV
            </button>

            <button
              onClick={() => setActiveTab("sql")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "sql"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              SQL Insert
            </button>
          </div>

          {/* Action buttons (Copy / Download for active tab) */}
          <div className="flex items-center gap-2">
            {activeTab === "sql" && (
              <div className="flex items-center gap-1.5 text-xs mr-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Table:</span>
                <input
                  type="text"
                  value={sqlTableName}
                  onChange={(e) => setSqlTableName(e.target.value)}
                  className="h-8 w-28 px-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {activeTab === "csv" && (
              <div className="flex items-center gap-1.5 text-xs mr-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Delimiter:</span>
                <select
                  value={csvDelimiter}
                  onChange={(e) => setCsvDelimiter(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="&#9;">Tab (\t)</option>
                </select>
              </div>
            )}

            <button
              onClick={() => {
                let content = "";
                if (activeTab === "table" || activeTab === "json") content = exportMockToJson(dataset);
                else if (activeTab === "csv") content = exportMockToCsv(dataset, csvDelimiter);
                else if (activeTab === "sql") content = exportMockToSql(dataset, sqlTableName);
                handleCopy(content, activeTab);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === activeTab ? (isVi ? "Đã chép" : "Copied") : isVi ? "Sao Chép" : "Copy"}
            </button>

            <button
              onClick={() => {
                if (activeTab === "table" || activeTab === "json") {
                  handleDownload(exportMockToJson(dataset), `mock_data_${Date.now()}.json`, "application/json");
                } else if (activeTab === "csv") {
                  handleDownload(exportMockToCsv(dataset, csvDelimiter), `mock_data_${Date.now()}.csv`, "text/csv");
                } else if (activeTab === "sql") {
                  handleDownload(exportMockToSql(dataset, sqlTableName), `mock_insert_${Date.now()}.sql`, "text/sql");
                }
              }}
              className="h-9 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {isVi ? "Tải File" : "Download"}
            </button>
          </div>
        </div>

        {/* Tab 1: Interactive Table View (Dynamic for all fields) */}
        {activeTab === "table" && (
          <div className="overflow-x-auto max-h-[540px] border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  {activeFields.map((f) => {
                    let headerLabel = isVi ? (f.nameVi || f.name) : f.name;
                    if (f.id === "fullName" && locale === "ja") headerLabel += " (氏名)";
                    if (f.id === "citizenId") {
                      headerLabel =
                        locale === "vi"
                          ? "CCCD (12 số)"
                          : locale === "ja"
                          ? "My Number (マイナンバー)"
                          : "National ID";
                    }
                    if (f.id === "taxCode") {
                      headerLabel =
                        locale === "ja"
                          ? "Corporate No. (法人番号)"
                          : isVi
                          ? "Mã số thuế"
                          : "Tax ID";
                    }

                    return (
                      <th key={f.id} className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{headerLabel}</span>
                          {f.isCustom && (
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                              {f.dataType.replace("-", " ")}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
                {dataset.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 font-medium">
                      {row.id}
                    </td>

                    {activeFields.map((f) => {
                      const key = f.name || f.id;
                      const val = row[key];

                      // 1. Built-in Special Renderers
                      if (f.dataType === "built-in") {
                        const bType = f.builtinType || f.id;

                        if (bType === "fullName") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                              <span
                                onClick={() => handleCopy(String(val || ""), `cell_${row.id}_${f.id}`)}
                                className="cursor-pointer hover:underline"
                                title="Click to copy"
                              >
                                {String(val || "")}
                              </span>
                            </td>
                          );
                        }

                        if (bType === "gender") {
                          const gStr = String(val || "");
                          const isMale = gStr === "Nam" || gStr === "Male" || gStr === "男性";
                          return (
                            <td key={f.id} className="py-2 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isMale
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                    : "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300"
                                }`}
                              >
                                {gStr}
                              </span>
                            </td>
                          );
                        }

                        if (bType === "phone") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                              <span
                                onClick={() => handleCopy(String(val || ""), `cell_${row.id}_${f.id}`)}
                                className="cursor-pointer hover:underline"
                                title="Click to copy"
                              >
                                {String(val || "")}
                              </span>
                            </td>
                          );
                        }

                        if (bType === "email") {
                          return (
                            <td key={f.id} className="py-2 px-3 text-slate-600 dark:text-slate-400">
                              <span
                                onClick={() => handleCopy(String(val || ""), `cell_${row.id}_${f.id}`)}
                                className="cursor-pointer hover:underline"
                                title="Click to copy"
                              >
                                {String(val || "")}
                              </span>
                            </td>
                          );
                        }

                        if (bType === "citizenId") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                              <span
                                onClick={() => handleCopy(String(val || ""), `cell_${row.id}_${f.id}`)}
                                className="cursor-pointer hover:underline font-semibold"
                                title="Click to copy ID"
                              >
                                {String(val || "")}
                              </span>
                            </td>
                          );
                        }

                        if (bType === "taxCode") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                              <span
                                onClick={() => handleCopy(String(val || ""), `cell_${row.id}_${f.id}`)}
                                className="cursor-pointer hover:underline"
                                title="Click to copy"
                              >
                                {String(val || "")}
                              </span>
                            </td>
                          );
                        }

                        if (bType === "creditCard") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                              {typeof val === "object" && val !== null ? (
                                <div
                                  onClick={() =>
                                    handleCopy(
                                      (val as { number: string }).number,
                                      `cell_${row.id}_${f.id}`
                                    )
                                  }
                                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded inline-block"
                                  title="Click to copy Card Number"
                                >
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {(val as { number: string }).number}
                                  </span>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-sans">
                                      {(val as { type: string }).type}
                                    </span>
                                    <span>Exp: {(val as { expiry: string }).expiry}</span>
                                    <span>CVV: {(val as { cvv: string }).cvv}</span>
                                  </div>
                                </div>
                              ) : (
                                <span>{String(val || "")}</span>
                              )}
                            </td>
                          );
                        }

                        if (bType === "dateOfBirth") {
                          return (
                            <td key={f.id} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              <span>{String(val || "")}</span>
                              {row.age !== undefined && (
                                <span className="text-slate-400 ml-1.5 font-mono text-[11px]">
                                  ({String(row.age)} yo)
                                </span>
                              )}
                            </td>
                          );
                        }

                        if (bType === "address") {
                          return (
                            <td
                              key={f.id}
                              className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate"
                              title={String(val || "")}
                            >
                              {String(val || "")}
                            </td>
                          );
                        }

                        if (bType === "company") {
                          return (
                            <td key={f.id} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {String(val || "")}
                              </div>
                              {row.jobTitle !== undefined && (
                                <div className="text-[10px] text-slate-400">
                                  {String(row.jobTitle)}
                                </div>
                              )}
                            </td>
                          );
                        }

                        if (bType === "bankAccount") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                              {typeof val === "object" && val !== null ? (
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {(val as { accountNumber: string }).accountNumber}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <span className="font-sans">
                                      {(val as { bank: string }).bank}
                                    </span>
                                    <span className="text-emerald-500 font-semibold">
                                      {(val as { balance: string }).balance}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span>{String(val || "")}</span>
                              )}
                            </td>
                          );
                        }

                        if (bType === "ipv4") {
                          return (
                            <td key={f.id} className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                              {String(val || "")}
                            </td>
                          );
                        }

                        if (bType === "uuid") {
                          return (
                            <td
                              key={f.id}
                              className="py-2 px-3 font-mono text-slate-400 text-[10px] truncate max-w-[120px]"
                              title={String(val || "")}
                            >
                              {String(val || "")}
                            </td>
                          );
                        }
                      }

                      // 2. Custom Field Renderers
                      if (f.dataType === "boolean") {
                        const isTrue = val === true || val === 1 || val === "Có" || val === "Yes";
                        return (
                          <td key={f.id} className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                                isTrue
                                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {String(val)}
                            </span>
                          </td>
                        );
                      }

                      if (f.dataType === "options-list") {
                        return (
                          <td key={f.id} className="py-2 px-3">
                            <span
                              onClick={() => handleCopy(String(val || ""), `cell_${row.id}_${f.id}`)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40 dark:border-indigo-700/40 cursor-pointer hover:border-indigo-400"
                              title="Click to copy"
                            >
                              {String(val || "")}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={f.id} className="py-2 px-3 text-slate-700 dark:text-slate-300 font-mono">
                          <span
                            onClick={() =>
                              handleCopy(
                                String(val !== undefined && val !== null ? val : ""),
                                `cell_${row.id}_${f.id}`
                              )
                            }
                            className="cursor-pointer hover:underline"
                            title="Click to copy"
                          >
                            {String(val !== undefined && val !== null ? val : "")}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: JSON Code View */}
        {activeTab === "json" && (
          <div className="relative">
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-[540px]">
              {exportMockToJson(dataset)}
            </pre>
          </div>
        )}

        {/* Tab 3: CSV View */}
        {activeTab === "csv" && (
          <div className="relative">
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-[540px]">
              {exportMockToCsv(dataset, csvDelimiter)}
            </pre>
          </div>
        )}

        {/* Tab 4: SQL Insert View */}
        {activeTab === "sql" && (
          <div className="relative">
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-[540px]">
              {exportMockToSql(dataset, sqlTableName)}
            </pre>
          </div>
        )}
      </div>

      {/* Add / Edit Custom Field Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {editingFieldId
                      ? isVi
                        ? "Chỉnh Sửa Trường Dữ Liệu"
                        : "Edit Custom Field"
                      : isVi
                      ? "Thêm Trường Dữ Liệu Tùy Biến"
                      : "Add Custom Field"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isVi
                      ? "Thiết lập kiểu dữ liệu và quy tắc sinh ngẫu nhiên cho trường này"
                      : "Configure data type and generation rules for this field"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium">
                  {formError}
                </div>
              )}

              {/* Row 1: Field Key Name & Display Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <span>{isVi ? "Tên biến / Cột (Key Name):" : "Field Key (Column Name):"}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="vd: order_status, sku, score"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-slate-400 mt-1">
                    {isVi ? "Dùng làm JSON key, CSV header, cột SQL" : "Used for JSON keys, CSV header, SQL column"}
                  </span>
                </div>

                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{isVi ? "Tên hiển thị (Display Label):" : "Display Label:"}</span>
                  </label>
                  <input
                    type="text"
                    placeholder="vd: Trạng thái đơn hàng"
                    value={formNameVi}
                    onChange={(e) => setFormNameVi(e.target.value)}
                    className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-slate-400 mt-1">
                    {isVi ? "Tiêu đề cột hiển thị trên bảng" : "Header text displayed in the table"}
                  </span>
                </div>
              </div>

              {/* Row 2: Data Type Selection */}
              <div className="flex flex-col">
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>{isVi ? "Kiểu dữ liệu sinh (Data Type):" : "Data Type:"}</span>
                </label>
                <select
                  value={formDataType}
                  onChange={(e) => setFormDataType(e.target.value as FieldDataType)}
                  className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                >
                  <option value="options-list">{isVi ? "📋 Danh sách lựa chọn (Options List)" : "📋 Options List (Pick from options)"}</option>
                  <option value="number-range">{isVi ? "🔢 Khoảng số (Number Range - Min/Max)" : "🔢 Number Range (Min/Max/Decimals)"}</option>
                  <option value="text-pattern">{isVi ? "🔤 Mẫu ký tự / Pattern Mask (# = số, ? = chữ)" : "🔤 Pattern Mask (# = digit, ? = letter)"}</option>
                  <option value="boolean">{isVi ? "🔘 Đúng / Sai (Boolean: true/false, 1/0)" : "🔘 Boolean (true/false, 1/0, Yes/No)"}</option>
                  <option value="date-range">{isVi ? "📅 Khoảng ngày tháng (Date Range)" : "📅 Date Range (From/To dates)"}</option>
                  <option value="custom-regex">{isVi ? "⚡ Sinh từ Regular Expression (Regex)" : "⚡ Generate from Regular Expression"}</option>
                  <option value="timestamp">{isVi ? "⏱️ Timestamp Epoch Milliseconds" : "⏱️ Timestamp Epoch Milliseconds"}</option>
                  <option value="lorem-sentence">{isVi ? "📝 Câu mô tả mẫu thực tế (Realistic Sentence)" : "📝 Sample Realistic Sentence"}</option>
                </select>
              </div>

              {/* Dynamic Type Config Sub-form */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                {/* 1. Options List Config */}
                {formDataType === "options-list" && (
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>{isVi ? "Danh sách giá trị (cách nhau bởi dấu phẩy):" : "Comma-separated options:"}</span>
                    </label>
                    <textarea
                      rows={2}
                      value={formOptionsList}
                      onChange={(e) => setFormOptionsList(e.target.value)}
                      placeholder="ACTIVE, INACTIVE, PENDING, BLOCKED"
                      className="w-full p-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] text-slate-400 mr-1 self-center">
                        {isVi ? "Xem trước:" : "Preview:"}
                      </span>
                      {formOptionsList
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 6)
                        .map((opt, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono"
                          >
                            {opt}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* 2. Number Range Config */}
                {formDataType === "number-range" && (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="flex flex-col">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Min:</label>
                      <input
                        type="number"
                        value={formNumberMin}
                        onChange={(e) => setFormNumberMin(Number(e.target.value))}
                        className="h-9 px-2 text-center text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Max:</label>
                      <input
                        type="number"
                        value={formNumberMax}
                        onChange={(e) => setFormNumberMax(Number(e.target.value))}
                        className="h-9 px-2 text-center text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isVi ? "Số thập phân:" : "Decimals:"}
                      </label>
                      <select
                        value={formNumberDecimals}
                        onChange={(e) => setFormNumberDecimals(Number(e.target.value))}
                        className="h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={0}>{isVi ? "0 (Số nguyên)" : "0 (Integer)"}</option>
                        <option value={1}>1 (0.0)</option>
                        <option value={2}>2 (0.00)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. Text Pattern Config */}
                {formDataType === "text-pattern" && (
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      {isVi ? "Mẫu định dạng (Mask):" : "Pattern Mask:"}
                    </label>
                    <input
                      type="text"
                      value={formTextPattern}
                      onChange={(e) => setFormTextPattern(e.target.value)}
                      placeholder="ORD-####-??"
                      className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 space-y-0.5">
                      <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {isVi ? "Quy ước ký tự:" : "Pattern Rules:"}
                      </p>
                      <p>
                        <code className="text-indigo-600 font-bold">#</code> : {isVi ? "Chữ số ngẫu nhiên (0-9)" : "Random digit (0-9)"}
                      </p>
                      <p>
                        <code className="text-indigo-600 font-bold">?</code> : {isVi ? "Chữ cái in hoa ngẫu nhiên (A-Z)" : "Random uppercase letter (A-Z)"}
                      </p>
                      <p>
                        <code className="text-indigo-600 font-bold">*</code> : {isVi ? "Chữ hoặc số ngẫu nhiên (0-9, A-Z)" : "Random alphanumeric (0-9, A-Z)"}
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. Boolean Config */}
                {formDataType === "boolean" && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      {isVi ? "Định dạng hiển thị:" : "Boolean Format:"}
                    </label>
                    <select
                      value={formBooleanFormat}
                      onChange={(e) =>
                        setFormBooleanFormat(e.target.value as "true/false" | "1/0" | "Yes/No")
                      }
                      className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-mono"
                    >
                      <option value="true/false">true / false</option>
                      <option value="1/0">1 / 0 (Bit)</option>
                      <option value="Yes/No">{isVi ? "Có / Không (Yes / No)" : "Yes / No"}</option>
                    </select>
                  </div>
                )}

                {/* 5. Date Range Config */}
                {formDataType === "date-range" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isVi ? "Từ ngày:" : "From Date:"}
                      </label>
                      <input
                        type="date"
                        value={formDateFrom}
                        onChange={(e) => setFormDateFrom(e.target.value)}
                        className="h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isVi ? "Đến ngày:" : "To Date:"}
                      </label>
                      <input
                        type="date"
                        value={formDateTo}
                        onChange={(e) => setFormDateTo(e.target.value)}
                        className="h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* 6. Custom Regex Config */}
                {formDataType === "custom-regex" && (
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      {isVi ? "Biểu thức chính quy (Regex Pattern):" : "Regular Expression Pattern:"}
                    </label>
                    <input
                      type="text"
                      value={formCustomRegex}
                      onChange={(e) => setFormCustomRegex(e.target.value)}
                      placeholder="^[A-Z]{3}-\d{4}$"
                      className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <div className="flex items-center justify-between text-[11px] bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">
                        {isVi ? "Ví dụ mẫu sinh thử:" : "Live sample:"}
                      </span>
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {regexPreview}
                      </span>
                    </div>
                  </div>
                )}

                {/* 7. Timestamp Config */}
                {formDataType === "timestamp" && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      {isVi
                        ? "Hệ thống sẽ tự động sinh timestamp Unix Epoch (milliseconds) trong vòng 365 ngày qua."
                        : "Generates Unix Epoch millisecond timestamps within the last 365 days."}
                    </span>
                  </p>
                )}

                {/* 8. Lorem Sentence Config */}
                {formDataType === "lorem-sentence" && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      {isVi
                        ? "Hệ thống sinh các câu trạng thái giao dịch / hồ sơ tự nhiên theo ngôn ngữ đang chọn (VN, Nhật, Quốc tế)."
                        : "Generates realistic context sentences based on active locale (VN, JP, US)."}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                {isVi ? "Hủy" : "Cancel"}
              </button>
              <button
                onClick={handleSaveField}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingFieldId ? (isVi ? "Cập Nhật" : "Update Field") : isVi ? "Lưu Trường" : "Save Field"}</span>
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
