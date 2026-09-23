import { Store } from "@tauri-apps/plugin-store";

const STORE_FILENAME = "config.json";
const BOOKMARKS_KEY = "bookmarks";
const LANGUAGE_KEY = "language";
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

let tauriStore: Store | null = null;

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getStore(): Promise<Store | null> {
  if (!isTauriEnvironment()) {
    return null;
  }
  if (!tauriStore) {
    try {
      tauriStore = await Store.load(STORE_FILENAME);
    } catch (err) {
      console.warn("Failed to load Tauri store, using in-memory fallback:", err);
      return null;
    }
  }
  return tauriStore;
}

let memoryBookmarks: string[] = [];
let memoryLanguage: "en" | "vi" = "en";
let memorySidebarCollapsed = false;

export async function loadBookmarksFromDisk(): Promise<string[]> {
  try {
    const store = await getStore();
    if (store) {
      const data = await store.get<string[]>(BOOKMARKS_KEY);
      if (Array.isArray(data)) {
        return data;
      }
    } else if (typeof window !== "undefined" && window.localStorage) {
      const data = localStorage.getItem(BOOKMARKS_KEY);
      if (data) return JSON.parse(data);
    } else {
      return memoryBookmarks;
    }
  } catch (err) {
    console.error("Error reading bookmarks from store:", err);
  }
  return [];
}

export async function saveBookmarksToDisk(bookmarks: string[]): Promise<void> {
  try {
    const store = await getStore();
    if (store) {
      await store.set(BOOKMARKS_KEY, bookmarks);
      await store.save();
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } else {
      memoryBookmarks = [...bookmarks];
    }
  } catch (err) {
    console.error("Error saving bookmarks to store:", err);
  }
}

export async function loadLanguageFromDisk(): Promise<"en" | "vi"> {
  try {
    const store = await getStore();
    if (store) {
      const data = await store.get<string>(LANGUAGE_KEY);
      if (data === "en" || data === "vi") {
        return data;
      }
    } else if (typeof window !== "undefined" && window.localStorage) {
      const data = localStorage.getItem(LANGUAGE_KEY);
      if (data === "en" || data === "vi") return data;
    } else {
      return memoryLanguage;
    }
  } catch (err) {
    console.error("Error reading language from store:", err);
  }
  return "en"; // Default language is English
}

export async function saveLanguageToDisk(language: "en" | "vi"): Promise<void> {
  try {
    const store = await getStore();
    if (store) {
      await store.set(LANGUAGE_KEY, language);
      await store.save();
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LANGUAGE_KEY, language);
    } else {
      memoryLanguage = language;
    }
  } catch (err) {
    console.error("Error saving language to store:", err);
  }
}

export async function loadSidebarCollapsedFromDisk(): Promise<boolean> {
  try {
    const store = await getStore();
    if (store) {
      const data = await store.get<boolean>(SIDEBAR_COLLAPSED_KEY);
      if (typeof data === "boolean") {
        return data;
      }
    } else if (typeof window !== "undefined" && window.localStorage) {
      const data = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (data !== null) return data === "true";
    } else {
      return memorySidebarCollapsed;
    }
  } catch (err) {
    console.error("Error reading sidebar collapsed state from store:", err);
  }
  return false;
}

export async function saveSidebarCollapsedToDisk(collapsed: boolean): Promise<void> {
  try {
    const store = await getStore();
    if (store) {
      await store.set(SIDEBAR_COLLAPSED_KEY, collapsed);
      await store.save();
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } else {
      memorySidebarCollapsed = collapsed;
    }
  } catch (err) {
    console.error("Error saving sidebar collapsed state to store:", err);
  }
}

