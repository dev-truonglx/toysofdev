import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  publishedAt?: string;
}

const GITHUB_REPO = "devtoys-local/devtoys-local";
const UPDATE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CURRENT_VERSION = "0.1.0";

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function cleanVersion(v: string): string {
  return v.replace(/^v/i, "").trim();
}

function isVersionNewer(latest: string, current: string): boolean {
  const lParts = cleanVersion(latest).split(".").map(Number);
  const cParts = cleanVersion(current).split(".").map(Number);

  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const fetchFn = isTauriEnvironment() ? tauriFetch : window.fetch.bind(window);

    const response = await fetchFn(UPDATE_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DevToysLocal-App",
      },
    });

    if (!response.ok) {
      // Release might not exist yet if repository is placeholder
      return null;
    }

    const data = await response.json();
    const tagName = data.tag_name || "";
    const hasUpdate = isVersionNewer(tagName, CURRENT_VERSION);

    return {
      hasUpdate,
      latestVersion: tagName,
      currentVersion: CURRENT_VERSION,
      releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      publishedAt: data.published_at,
    };
  } catch (err) {
    // Network is offline or request blocked; stay silent and offline-first
    console.debug("Update check completed (no update or offline):", err);
    return null;
  }
}
