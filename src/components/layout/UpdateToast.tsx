import React from "react";
import { Sparkles, X, ExternalLink } from "lucide-react";
import { UpdateInfo } from "../../services/updateService";
import { useTranslation } from "../../i18n";

interface UpdateToastProps {
  updateInfo: UpdateInfo | null;
  onDismiss: () => void;
}

export const UpdateToast: React.FC<UpdateToastProps> = ({ updateInfo, onDismiss }) => {
  const { t } = useTranslation();
  if (!updateInfo || !updateInfo.hasUpdate) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-500/30 dark:border-indigo-500/30 shadow-xl shadow-indigo-500/10 flex items-start gap-3">
        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>

        <div className="flex-1 space-y-1">
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span>{t.common.toastNewVersion}</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px]">
              {updateInfo.latestVersion}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t.common.toastUpdateAvailable.replace("{version}", updateInfo.currentVersion)}
          </p>

          <div className="pt-2 flex items-center gap-2">
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <span>{t.common.toastViewRelease}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {t.common.toastDismiss}
            </button>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
