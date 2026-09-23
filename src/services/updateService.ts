import { create } from "zustand";
import { check, Update, DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const GITHUB_REPO = "dev-truonglx/toysofdev";

// Read dynamically injected version from build configuration
export const CURRENT_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateStoreState {
  status: UpdateStatus;
  update: Update | null;
  newVersion: string | null;
  currentVersion: string;
  releaseNotes: string | null;
  downloadProgress: number; // 0 - 100
  errorMessage: string | null;
  dismissed: boolean;

  checkForUpdates: (manual?: boolean) => Promise<boolean>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
  dismiss: () => void;
  reset: () => void;
}

let resetTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutoReset() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
}

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  status: "idle",
  update: null,
  newVersion: null,
  currentVersion: CURRENT_VERSION,
  releaseNotes: null,
  downloadProgress: 0,
  errorMessage: null,
  dismissed: false,

  checkForUpdates: async (manual = false) => {
    clearAutoReset();

    if (!isTauriEnvironment()) {
      console.debug("Not in Tauri environment, skipping auto-updater");
      if (manual) {
        set({ status: "checking", errorMessage: null });
        await new Promise((r) => setTimeout(r, 600));
        set({ status: "up-to-date", errorMessage: null });
        resetTimer = setTimeout(() => {
          if (get().status === "up-to-date") {
            set({ status: "idle" });
          }
        }, 3500);
      }
      return false;
    }

    set({ status: "checking", errorMessage: null });
    try {
      const update = await check();
      if (update && update.available) {
        set({
          status: "available",
          update,
          newVersion: update.version,
          currentVersion: update.currentVersion || CURRENT_VERSION,
          releaseNotes: update.body || null,
          dismissed: false,
        });
        return true;
      } else {
        if (manual) {
          set({ status: "up-to-date", update: null, newVersion: null, errorMessage: null });
          resetTimer = setTimeout(() => {
            if (get().status === "up-to-date") {
              set({ status: "idle" });
            }
          }, 3500);
        } else {
          set({ status: "idle", update: null, newVersion: null });
        }
        return false;
      }
    } catch (err: any) {
      console.error("Update check failed:", err);
      if (manual) {
        set({ status: "error", errorMessage: err?.message || String(err) });
        resetTimer = setTimeout(() => {
          if (get().status === "error") {
            set({ status: "idle" });
          }
        }, 4000);
      } else {
        set({ status: "idle" });
      }
      return false;
    }
  },

  downloadAndInstall: async () => {
    const { update } = get();
    if (!update) return;

    set({ status: "downloading", downloadProgress: 0, errorMessage: null });
    try {
      let contentLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const percent = Math.min(100, Math.round((downloaded / contentLength) * 100));
              set({ downloadProgress: percent });
            }
            break;
          case "Finished":
            set({ downloadProgress: 100 });
            break;
        }
      });

      set({ status: "downloaded", downloadProgress: 100 });
    } catch (err: any) {
      console.error("Failed to download and install update:", err);
      set({ status: "error", errorMessage: err?.message || String(err) });
    }
  },

  restartApp: async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error("Failed to relaunch application:", err);
    }
  },

  dismiss: () => set({ dismissed: true }),

  reset: () =>
    set({
      status: "idle",
      update: null,
      newVersion: null,
      downloadProgress: 0,
      errorMessage: null,
      dismissed: false,
    }),
}));
