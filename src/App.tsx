import { useEffect, useState } from "react";
import { useAppStore, applyTheme } from "./store/useAppStore";
import { Sidebar } from "./components/layout/Sidebar";
import { AllToolsView } from "./components/layout/AllToolsView";
import { UpdateToast } from "./components/layout/UpdateToast";
import { getToolById } from "./tools";
import { checkForUpdates, UpdateInfo } from "./services/updateService";

export default function App() {
  const { selectedToolId, themeMode, initStore } = useAppStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Initialize store (load bookmarks from config.json)
  useEffect(() => {
    initStore();
  }, [initStore]);

  // Check for updates via GitHub release API on startup
  useEffect(() => {
    checkForUpdates().then((info) => {
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
      }
    });
  }, []);

  // System theme synchronization
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeMode]);

  const activeTool = selectedToolId ? getToolById(selectedToolId) : null;
  const ToolComponent = activeTool ? activeTool.component : null;

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900">
        {ToolComponent ? <ToolComponent /> : <AllToolsView />}
      </main>

      {/* Auto-Update Banner */}
      <UpdateToast updateInfo={updateInfo} onDismiss={() => setUpdateInfo(null)} />
    </div>
  );
}
