import React, { useState } from "react";
import { Star, Copy, Check, Trash2, Clipboard, AlertCircle, LucideIcon, Code2 } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useTranslation } from "../../i18n";

interface ToolLayoutProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  categoryName: string;
  configuration?: React.ReactNode;
  inputLabel?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputPlaceholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  inputNode?: React.ReactNode;
  outputLabel?: string;
  outputValue?: string;
  outputPlaceholder?: string;
  outputNode?: React.ReactNode;
  outputExtraActions?: React.ReactNode;
  error?: string | null;
  customPanes?: React.ReactNode;
  actionsRight?: React.ReactNode;
  hideInput?: boolean;
  onFormatInput?: () => boolean | void;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({
  id,
  title,
  description,
  icon: Icon,
  categoryName,
  configuration,
  inputLabel,
  inputValue = "",
  onInputChange,
  inputPlaceholder,
  inputRef,
  inputNode,
  outputLabel,
  outputValue = "",
  outputPlaceholder,
  outputNode,
  outputExtraActions,
  error,
  customPanes,
  actionsRight,
  hideInput,
  onFormatInput,
}) => {
  const { isBookmarked, toggleBookmark } = useAppStore();
  const { t } = useTranslation();

  const finalTitle = t.tools[id]?.title || title;
  const finalDescription = t.tools[id]?.description || description;
  const finalCategoryName = t.categories[categoryName.toLowerCase()]?.title || categoryName;
  const finalInputLabel = inputLabel || t.toolLayout.input;
  const finalOutputLabel = outputLabel || t.toolLayout.output;
  const finalInputPlaceholder = inputPlaceholder || t.toolLayout.inputPlaceholder;
  const finalOutputPlaceholder = outputPlaceholder || t.toolLayout.outputPlaceholder;

  const isInputHidden = hideInput ?? (!onInputChange && !inputValue);

  const bookmarked = isBookmarked(id);
  const [copied, setCopied] = useState(false);
  const [inputFormatted, setInputFormatted] = useState(false);

  const handleFormatInput = () => {
    if (onFormatInput) {
      const res = onFormatInput();
      if (res !== false) {
        setInputFormatted(true);
        setTimeout(() => setInputFormatted(false), 1500);
      }
    }
  };

  const handleCopy = async () => {
    if (!outputValue) return;
    try {
      await navigator.clipboard.writeText(outputValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (onInputChange) {
        onInputChange(text);
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  const handleClear = () => {
    if (onInputChange) {
      onInputChange("");
    }
  };

  const inputLineCount = inputValue ? inputValue.split("\n").length : 0;
  const outputLineCount = outputValue ? outputValue.split("\n").length : 0;

  const outputPane = (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex-1 min-h-[400px]">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{finalOutputLabel}</span>
          {outputValue && (
            <span className="text-[11px] text-slate-400 font-mono">
              ({outputValue.length} {t.common.characters}, {outputLineCount} {t.common.lines})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {outputExtraActions}
          <button
            onClick={handleCopy}
            disabled={!outputValue}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
              copied
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            }`}
            title={t.common.copy}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium text-[11px]">{t.common.copied}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">{t.common.copy}</span>
              </>
            )}
          </button>
        </div>
      </div>
      {outputNode ? (
        <div className="flex-1 w-full p-4 overflow-auto bg-slate-50/40 dark:bg-slate-950/40 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all select-text">
          {outputNode}
        </div>
      ) : (
        <textarea
          value={outputValue}
          readOnly
          placeholder={finalOutputPlaceholder}
          spellCheck={false}
          className="flex-1 w-full p-4 resize-none bg-slate-50/40 dark:bg-slate-950/40 font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            <span>{finalCategoryName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {finalTitle}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{finalDescription}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actionsRight}
          <button
            onClick={() => toggleBookmark(id)}
            title={bookmarked ? t.common.removeFromFavorites : t.common.addToFavorites}
            className={`p-2.5 rounded-xl border transition-all ${
              bookmarked
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Star className={`w-5 h-5 ${bookmarked ? "fill-amber-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Configuration Toolbar */}
      {configuration && (
        <div className="rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            {t.toolLayout.configuration || "Configuration"}
          </div>
          <div className="flex flex-wrap gap-4 items-center">{configuration}</div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content / Editors */}
      {customPanes ? (
        customPanes
      ) : isInputHidden ? (
        outputPane
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[400px]">
          {/* Input Box */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{finalInputLabel}</span>
                {inputValue && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({inputValue.length} {t.common.characters}, {inputLineCount} {t.common.lines})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {onFormatInput && (
                  <button
                    type="button"
                    onClick={handleFormatInput}
                    disabled={!inputValue.trim()}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      inputFormatted
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                    title={t.ui.format}
                  >
                    {inputFormatted ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t.ui.formatted}</span>
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5" />
                        <span>{t.ui.format}</span>
                      </>
                    )}
                  </button>
                )}
                {onInputChange && (
                  <>
                    <button
                      onClick={handlePaste}
                      className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      title={t.common.paste}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleClear}
                      disabled={!inputValue}
                      className="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
                      title={t.common.clear}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {inputNode ? (
              <div className="flex-1 w-full p-4 overflow-auto bg-transparent font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all select-text">
                {inputNode}
              </div>
            ) : (
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => onInputChange && onInputChange(e.target.value)}
                placeholder={finalInputPlaceholder}
                spellCheck={false}
                className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            )}
          </div>

          {/* Output Box */}
          {outputPane}
        </div>
      )}
    </div>
  );
};
