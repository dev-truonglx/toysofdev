import { create } from "zustand";
import {
  loadBookmarksFromDisk,
  saveBookmarksToDisk,
  loadLanguageFromDisk,
  saveLanguageToDisk,
} from "../services/storeService";
import { Language } from "../i18n/types";

export type ThemeMode = "system" | "light" | "dark";

interface AppState {
  selectedToolId: string | null;
  searchQuery: string;
  bookmarkedIds: string[];
  themeMode: ThemeMode;
  language: Language;
  isSidebarCollapsed: boolean;
  isInitialized: boolean;

  // Actions
  setSelectedToolId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => Promise<void>;
  toggleSidebar: () => void;
  initStore: () => Promise<void>;
  toggleBookmark: (toolId: string) => Promise<void>;
  isBookmarked: (toolId: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedToolId: null, // null represents "All Tools" home screen
  searchQuery: "",
  bookmarkedIds: [],
  themeMode: "system",
  language: "en", // Default language is English
  isSidebarCollapsed: false,
  isInitialized: false,

  setSelectedToolId: (id) => set({ selectedToolId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    applyTheme(mode);
  },
  setLanguage: async (lang: Language) => {
    set({ language: lang });
    await saveLanguageToDisk(lang);
  },
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  initStore: async () => {
    const [loadedBookmarks, loadedLanguage] = await Promise.all([
      loadBookmarksFromDisk(),
      loadLanguageFromDisk(),
    ]);
    set({
      bookmarkedIds: loadedBookmarks,
      language: loadedLanguage,
      isInitialized: true,
    });
    // Apply initial system theme
    applyTheme(get().themeMode);
  },

  toggleBookmark: async (toolId: string) => {
    const current = get().bookmarkedIds;
    const exists = current.includes(toolId);
    const updated = exists ? current.filter((id) => id !== toolId) : [...current, toolId];

    set({ bookmarkedIds: updated });
    await saveBookmarksToDisk(updated);
  },

  isBookmarked: (toolId: string) => {
    return get().bookmarkedIds.includes(toolId);
  },
}));

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "light") {
    root.classList.remove("dark");
  } else {
    // system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}
