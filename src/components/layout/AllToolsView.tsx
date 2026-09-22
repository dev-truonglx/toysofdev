import React from "react";
import { Star, ArrowRight } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { getLocalizedCategories, getToolsByCategory } from "../../tools";
import { useTranslation } from "../../i18n";

export const AllToolsView: React.FC = () => {
  const { setSelectedToolId, isBookmarked, toggleBookmark } = useAppStore();
  const { t, language } = useTranslation();

  const localizedCategories = getLocalizedCategories(language);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      {/* Hero Welcome */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.home.heroTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            {t.home.heroSubtitle}
          </p>
        </div>
      </div>

      {/* Categories & Tool Cards */}
      <div className="space-y-8">
        {localizedCategories.map((category) => {
          const tools = getToolsByCategory(category.id, language);
          const CatIcon = category.icon;

          return (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                <CatIcon className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {category.title}
                </h2>
                <span className="text-xs text-slate-400">({tools.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map((tool) => {
                  const ToolIcon = tool.icon;
                  const bookmarked = isBookmarked(tool.id);

                  return (
                    <div
                      key={tool.id}
                      onClick={() => setSelectedToolId(tool.id)}
                      className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <ToolIcon className="w-5 h-5" />
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(tool.id);
                            }}
                            title={bookmarked ? t.common.removeFromFavorites : t.common.addToFavorites}
                            className={`p-2 rounded-lg transition-colors ${
                              bookmarked
                                ? "text-amber-500 hover:text-amber-600"
                                : "text-slate-300 dark:text-slate-600 hover:text-amber-500"
                            }`}
                          >
                            <Star className={`w-4 h-4 ${bookmarked ? "fill-amber-500" : ""}`} />
                          </button>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {tool.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        <span>{t.common.openTool}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
