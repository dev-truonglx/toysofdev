import { Store } from "@tauri-apps/plugin-store";

const STORE_FILENAME = "config.json";
const BOOKMARKS_KEY = "bookmarks";
const LANGUAGE_KEY = "language";
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";
const AI_CONFIG_KEY = "ai_config";

export interface AIConfig {
  provider: "gemini" | "claude" | "local-cli";
  geminiApiKey: string;
  geminiModel: string;
  claudeApiKey: string;
  claudeModel: string;
  localCliPath?: string;
  localCliModel?: string;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "local-cli",
  geminiApiKey: "",
  geminiModel: "gemini-3.8-flash",
  claudeApiKey: "",
  claudeModel: "claude-sonnet-5-5",
  localCliPath: "",
  localCliModel: "gemini-3.8-flash-high",
};

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
let memoryAIConfig: AIConfig = { ...DEFAULT_AI_CONFIG };

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

export async function loadAIConfigFromDisk(): Promise<AIConfig> {
  try {
    const store = await getStore();
    if (store) {
      const data = await store.get<AIConfig>(AI_CONFIG_KEY);
      if (data && typeof data === "object") {
        return {
          ...DEFAULT_AI_CONFIG,
          ...data,
        };
      }
    } else if (typeof window !== "undefined" && window.localStorage) {
      const data = localStorage.getItem(AI_CONFIG_KEY);
      if (data) {
        return {
          ...DEFAULT_AI_CONFIG,
          ...JSON.parse(data),
        };
      }
    } else {
      return memoryAIConfig;
    }
  } catch (err) {
    console.error("Error reading AI config from store:", err);
  }
  return { ...DEFAULT_AI_CONFIG };
}

export async function saveAIConfigToDisk(config: AIConfig): Promise<void> {
  try {
    const store = await getStore();
    if (store) {
      await store.set(AI_CONFIG_KEY, config);
      await store.save();
    } else if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
    } else {
      memoryAIConfig = { ...config };
    }
  } catch (err) {
    console.error("Error saving AI config to store:", err);
  }
}

