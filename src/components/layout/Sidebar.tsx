import React from "react";
import {
  Wrench,
  Search,
  Star,
  Layers,
  Sun,
  Moon,
  Monitor,
  X,
  ChevronRight,
  ShieldCheck,
  Languages,
  Sparkles,
  Download,
  RotateCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import {
  getLocalizedCategories,
  getToolsByCategory,
  getToolById,
  searchTools,
  TOOLS,
} from "../../tools";
import { useTranslation } from "../../i18n";
import { CURRENT_VERSION, useUpdateStore } from "../../services/updateService";

export const Sidebar: React.FC = () => {
  const {
    selectedToolId,
    setSelectedToolId,
    searchQuery,
    setSearchQuery,
    bookmarkedIds,
    themeMode,
    setThemeMode,
    isSidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
  } = useAppStore();

  const { t, language, setLanguage } = useTranslation();
  const {
    status: updateStatus,
    newVersion,
    downloadProgress,
    dismissed: updateDismissed,
    downloadAndInstall,
    restartApp,
    dismiss: dismissUpdate,
    checkForUpdates,
    errorMessage,
  } = useUpdateStore();

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar shortcut: ⌘B or Ctrl+B
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      // Focus search: ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isSidebarCollapsed) {
          setSidebarCollapsed(false);
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 150);
        } else {
          searchInputRef.current?.focus();
        }
      }
      if (e.key === "Escape" && searchQuery) {
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, setSearchQuery, isSidebarCollapsed, toggleSidebar, setSidebarCollapsed]);

  const localizedCategories = getLocalizedCategories(language);
  const filteredTools = searchQuery ? searchTools(searchQuery, language) : null;
  const bookmarkedTools = bookmarkedIds
    .map((id) => getToolById(id, language))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const activeTool = selectedToolId ? getToolById(selectedToolId, language) : null;
  const isActiveToolBookmarked = selectedToolId ? bookmarkedIds.includes(selectedToolId) : false;

  const handleCycleTheme = () => {
    if (themeMode === "system") {
      setThemeMode("light");
    } else if (themeMode === "light") {
      setThemeMode("dark");
    } else {
      setThemeMode("system");
    }
  };

  const handleToggleLanguage = () => {
    setLanguage(language === "en" ? "vi" : "en");
  };

  const handleCategoryClick = (categoryId: string) => {
    if (isSidebarCollapsed) {
      setSidebarCollapsed(false);
      setTimeout(() => {
        const el = document.getElementById(`category-${categoryId}`);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  };

  return (
    <aside
      className={`${
        isSidebarCollapsed ? "w-16" : "w-72"
      } h-full flex flex-col bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 select-none transition-all duration-300 ease-in-out shrink-0 overflow-hidden`}
    >
      {/* Brand Header */}
      {isSidebarCollapsed ? (
        <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center gap-2">
          <button
            onClick={() => setSelectedToolId(null)}
            title={`${t.common.appName} - ${t.common.allTools}`}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 hover:scale-105 transition-transform cursor-pointer"
          >
            <Wrench className="w-5 h-5" />
          </button>
          <button
            onClick={() => checkForUpdates(true)}
            title={
              updateStatus === "checking"
                ? t.common.checkingUpdate
                : updateStatus === "up-to-date"
                ? `${t.common.upToDate} (v${CURRENT_VERSION})`
                : updateStatus === "error"
                ? (errorMessage || t.common.checkUpdateError)
                : `${t.common.checkUpdateTooltip} (v${CURRENT_VERSION})`
            }
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              updateStatus === "up-to-date"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300/60 dark:border-emerald-700/60"
                : updateStatus === "error"
                ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300/60 dark:border-rose-700/60"
                : updateStatus === "checking"
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-300/60 dark:border-indigo-700/60"
                : "bg-slate-200/70 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-300/40 dark:border-slate-700/50"
            }`}
          >
            {updateStatus === "checking" ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            ) : updateStatus === "up-to-date" ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : updateStatus === "error" ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <RotateCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => toggleSidebar()}
            title={`${t.common.expandSidebar} (⌘B / Ctrl+B)`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2">
          <div
            onClick={() => setSelectedToolId(null)}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                <span className="truncate">{t.common.appName}</span>

                {/* Interactive Version Badge / Check Update Button */}
                {updateStatus === "checking" ? (
                  <span
                    title={t.common.checkingUpdate}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shrink-0"
                  >
                    <RotateCw className="w-2.5 h-2.5 animate-spin" />
                    <span>{t.common.checkingUpdate}</span>
                  </span>
                ) : updateStatus === "up-to-date" ? (
                  <span
                    title={`${t.common.upToDate} (v${CURRENT_VERSION})`}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-700/80 text-emerald-600 dark:text-emerald-400 shrink-0 animate-in fade-in zoom-in-95 duration-200"
                  >
                    <Check className="w-2.5 h-2.5" />
                    <span>{t.common.upToDate}</span>
                  </span>
                ) : updateStatus === "error" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      checkForUpdates(true);
                    }}
                    title={errorMessage || t.common.checkUpdateError}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shrink-0 cursor-pointer"
                  >
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>{t.common.checkUpdateError}</span>
                  </button>
                ) : updateStatus === "available" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAndInstall();
                    }}
                    title={t.common.updateAvailableTitle.replace("{version}", newVersion || "")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 transition-all shrink-0 cursor-pointer animate-pulse"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>v{newVersion}</span>
                  </button>
                ) : updateStatus === "downloading" ? (
                  <span
                    title={t.common.updateDownloading.replace("{percent}", String(downloadProgress))}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shrink-0"
                  >
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>{downloadProgress}%</span>
                  </span>
                ) : updateStatus === "downloaded" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      restartApp();
                    }}
                    title={t.common.updateRestartNow}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 transition-all shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>{t.common.updateRestartNow}</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      checkForUpdates(true);
                    }}
                    title={`${t.common.checkUpdateTooltip} (v${CURRENT_VERSION})`}
                    className="group/badge inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 hover:border-indigo-300/80 dark:hover:border-indigo-700/80 active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    <span>v{CURRENT_VERSION}</span>
                    <RotateCw className="w-2.5 h-2.5 opacity-50 group-hover/badge:opacity-100 group-hover/badge:rotate-180 transition-all duration-300" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {t.common.appSubtitle}
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSidebar()}
            title={`${t.common.collapseSidebar} (⌘B / Ctrl+B)`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* In-App Auto-Update Widget */}
      {!updateDismissed &&
        (updateStatus === "available" ||
          updateStatus === "downloading" ||
          updateStatus === "downloaded" ||
          updateStatus === "error") && (
          isSidebarCollapsed ? (
            <div className="flex justify-center py-2 px-1 border-b border-slate-200/60 dark:border-slate-800/60">
              <button
                onClick={() => {
                  if (updateStatus === "downloaded") {
                    restartApp();
                  } else if (updateStatus === "available" || updateStatus === "error") {
                    downloadAndInstall();
                  } else {
                    toggleSidebar();
                  }
                }}
                title={
                  updateStatus === "downloaded"
                    ? t.common.updateRestartNow
                    : updateStatus === "downloading"
                    ? t.common.updateDownloading.replace("{percent}", String(downloadProgress))
                    : updateStatus === "available"
                    ? t.common.updateAvailableTitle.replace("{version}", newVersion || "")
                    : "Update failed"
                }
                className="w-10 h-10 rounded-xl bg-indigo-500/15 dark:bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform relative cursor-pointer"
              >
                {updateStatus === "downloaded" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : updateStatus === "downloading" ? (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                ) : updateStatus === "error" ? (
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                ) : (
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                )}
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping" />
              </button>
            </div>
          ) : (
            <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-indigo-500/5 dark:from-indigo-950/70 dark:via-violet-950/60 dark:to-slate-900 border border-indigo-500/20 dark:border-indigo-500/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 min-w-0">
                  {updateStatus === "downloaded" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : updateStatus === "downloading" ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                  ) : updateStatus === "error" ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                  )}
                  <span className="truncate">
                    {updateStatus === "downloaded"
                      ? t.common.updateDownloadedTitle
                      : updateStatus === "downloading"
                      ? t.common.updateDownloading.replace("{percent}", String(downloadProgress))
                      : updateStatus === "error"
                      ? "Update failed"
                      : t.common.updateAvailableTitle.replace("{version}", newVersion || "")}
                  </span>
                </div>
                <button
                  onClick={dismissUpdate}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                  title={t.common.updateDismiss}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {updateStatus === "downloading" && (
                <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}

              {updateStatus === "available" && (
                <button
                  onClick={downloadAndInstall}
                  className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.common.updateNow}</span>
                </button>
              )}

              {updateStatus === "downloaded" && (
                <button
                  onClick={restartApp}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{t.common.updateRestartNow}</span>
                </button>
              )}

              {updateStatus === "error" && (
                <button
                  onClick={downloadAndInstall}
                  className="w-full py-1 px-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )
        )}

      {/* Search Input / Quick Search Button */}
      {isSidebarCollapsed ? (
        <div className="py-2 flex justify-center">
          <button
            onClick={() => {
              setSidebarCollapsed(false);
              setTimeout(() => searchInputRef.current?.focus(), 150);
            }}
            title={`${t.common.searchPlaceholder} (⌘K / Ctrl+K)`}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/40 shadow-sm transition-all cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.common.searchPlaceholder}
              className="w-full text-xs pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
        {isSidebarCollapsed ? (
          /* Collapsed Navigation Items */
          <div className="flex flex-col items-center gap-1.5">
            {/* All Tools Button */}
            <button
              onClick={() => setSelectedToolId(null)}
              title={`${t.common.allTools} (${TOOLS.length})`}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                selectedToolId === null
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Currently Active Tool if not null and not bookmarked */}
            {activeTool && !isActiveToolBookmarked && (
              <>
                <div className="w-6 border-t border-slate-200/80 dark:border-slate-800/80 my-0.5" />
                {(() => {
                  const Icon = activeTool.icon;
                  return (
                    <button
                      onClick={() => setSelectedToolId(activeTool.id)}
                      title={activeTool.title}
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })()}
              </>
            )}

            {/* Bookmarked / Favorite Tools */}
            {bookmarkedTools.length > 0 && (
              <>
                <div className="w-6 border-t border-slate-200/80 dark:border-slate-800/80 my-0.5" />
                {bookmarkedTools.map((tool) => {
                  const Icon = tool.icon;
                  const isSelected = selectedToolId === tool.id;
                  return (
                    <button
                      key={`collapsed-fav-${tool.id}`}
                      onClick={() => setSelectedToolId(tool.id)}
                      title={tool.title}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 absolute top-1 right-1" />
                    </button>
                  );
                })}
              </>
            )}

            {/* Categories */}
            <div className="w-6 border-t border-slate-200/80 dark:border-slate-800/80 my-0.5" />
            {localizedCategories.map((cat) => {
              const categoryTools = getToolsByCategory(cat.id, language);
              const CatIcon = cat.icon;
              const isAnyInCatSelected = categoryTools.some((t) => t.id === selectedToolId);

              return (
                <button
                  key={`collapsed-cat-${cat.id}`}
                  onClick={() => handleCategoryClick(cat.id)}
                  title={`${cat.title} (${categoryTools.length}) - ${t.common.expandSidebar}`}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                    isAnyInCatSelected
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-500/30"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <CatIcon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        ) : (
          /* Expanded Navigation Items */
          <>
            {/* If searching, display search results */}
            {filteredTools !== null ? (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5 py-1">
                  {t.common.allTools} ({filteredTools.length})
                </div>
                {filteredTools.length === 0 ? (
                  <div className="text-xs text-slate-400 px-3 py-4 text-center italic">
                    {t.common.noToolsFound}
                  </div>
                ) : (
                  filteredTools.map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = selectedToolId === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setSelectedToolId(tool.id);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate text-left flex-1">{tool.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <>
                {/* All Tools Button */}
                <button
                  onClick={() => setSelectedToolId(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    selectedToolId === null
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.common.allTools}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${
                      selectedToolId === null
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {TOOLS.length}
                  </span>
                </button>

                {/* Favorites Section */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1.5 truncate">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      <span className="truncate">{t.common.favorites}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{bookmarkedTools.length}</span>
                  </div>

                  {bookmarkedTools.length === 0 ? (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 px-3 py-2 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl">
                      {t.common.starToPin}
                    </div>
                  ) : (
                    bookmarkedTools.map((tool) => {
                      const Icon = tool.icon;
                      const isSelected = selectedToolId === tool.id;
                      return (
                        <button
                          key={`fav-${tool.id}`}
                          onClick={() => setSelectedToolId(tool.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate text-left flex-1">{tool.title}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Categories */}
                {localizedCategories.map((cat) => {
                  const categoryTools = getToolsByCategory(cat.id, language);
                  const CatIcon = cat.icon;

                  return (
                    <div key={cat.id} id={`category-${cat.id}`} className="space-y-1 scroll-mt-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <CatIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{cat.title}</span>
                      </div>

                      {categoryTools.map((tool) => {
                        const Icon = tool.icon;
                        const isSelected = selectedToolId === tool.id;

                        return (
                          <button
                            key={tool.id}
                            onClick={() => setSelectedToolId(tool.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              isSelected
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate text-left">{tool.title}</span>
                            </div>
                            {isSelected && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer: Language Selector & Theme Switcher + Offline status */}
      {isSidebarCollapsed ? (
        <div className="p-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center gap-2">
          {/* Theme Mode Toggle (Cycles) */}
          <button
            onClick={handleCycleTheme}
            title={`${t.theme[themeMode]} - Click to switch theme`}
            className="w-10 h-10 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-300/40 dark:border-slate-700/50 shadow-inner transition-all cursor-pointer"
          >
            {themeMode === "dark" ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : themeMode === "light" ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            )}
          </button>

          {/* Language Toggle (EN <-> VI) */}
          <button
            onClick={handleToggleLanguage}
            title={`${language.toUpperCase()} (${t.language.title}) - Click to switch language`}
            className="w-10 h-10 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 border border-slate-300/40 dark:border-slate-700/50 shadow-inner transition-all cursor-pointer"
          >
            {language.toUpperCase()}
          </button>

          {/* Offline Status */}
          <div
            title={t.common.statelessOffline}
            className="w-10 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 cursor-default"
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Language Selector Toggle */}
            <div
              className="flex items-center rounded-lg bg-slate-200/70 dark:bg-slate-800/80 p-0.5 border border-slate-300/40 dark:border-slate-700/50 shadow-inner"
              title={t.language.title}
            >
              <div className="pl-1.5 pr-1 text-slate-400 dark:text-slate-500">
                <Languages className="w-3.5 h-3.5" />
              </div>
              <button
                onClick={() => setLanguage("en")}
                title={t.language.en}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  language === "en"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("vi")}
                title={t.language.vi}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  language === "vi"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                VI
              </button>
            </div>

            {/* Theme Mode Selector */}
            <div className="flex items-center rounded-lg bg-slate-200/70 dark:bg-slate-800/80 p-0.5 border border-slate-300/40 dark:border-slate-700/50 shadow-inner">
              <button
                onClick={() => setThemeMode("system")}
                title={t.theme.system}
                className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  themeMode === "system"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setThemeMode("light")}
                title={t.theme.light}
                className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  themeMode === "light"
                    ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setThemeMode("dark")}
                title={t.theme.dark}
                className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-white dark:bg-slate-700 text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Offline Status - Independent Row */}
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{t.common.statelessOffline}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
