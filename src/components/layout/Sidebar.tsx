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

export const Sidebar: React.FC = () => {
  const {
    selectedToolId,
    setSelectedToolId,
    searchQuery,
    setSearchQuery,
    bookmarkedIds,
    themeMode,
    setThemeMode,
  } = useAppStore();

  const { t, language, setLanguage } = useTranslation();

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && searchQuery) {
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, setSearchQuery]);

  const localizedCategories = getLocalizedCategories(language);
  const filteredTools = searchQuery ? searchTools(searchQuery, language) : null;
  const bookmarkedTools = bookmarkedIds
    .map((id) => getToolById(id, language))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <aside className="w-72 h-full flex flex-col bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
        <div
          onClick={() => setSelectedToolId(null)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{t.common.appName}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                v0.1
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.common.appSubtitle}</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
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

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedToolId === null
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 shrink-0" />
                <span>{t.common.allTools}</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
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
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {t.common.favorites}
                </span>
                <span className="text-[10px] text-slate-400">{bookmarkedTools.length}</span>
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
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
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <CatIcon className="w-3 h-3" />
                    <span>{cat.title}</span>
                  </div>

                  {categoryTools.map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = selectedToolId === tool.id;

                    return (
                      <button
                        key={tool.id}
                        onClick={() => setSelectedToolId(tool.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
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
      </div>

      {/* Footer: Language Selector & Theme Switcher + Offline status */}
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
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                language === "en"
                  ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("vi")}
              title={t.language.vi}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                language === "vi"
                  ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm"
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
              className={`p-1.5 rounded-md text-xs transition-all ${
                themeMode === "system"
                  ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setThemeMode("light")}
              title={t.theme.light}
              className={`p-1.5 rounded-md text-xs transition-all ${
                themeMode === "light"
                  ? "bg-white dark:bg-slate-750 text-amber-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setThemeMode("dark")}
              title={t.theme.dark}
              className={`p-1.5 rounded-md text-xs transition-all ${
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
    </aside>
  );
};
