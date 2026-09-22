# Project Context: Local-First Developer Tools (DevToys Clone)

## Objective
Build a desktop application that acts as a "Swiss Army knife" for developers, heavily inspired by the GitHub repository `DevToys-app/DevToys`. 
The app must be strictly local-first, blazing fast, stateless for tool data, and highly secure.

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand (state management), Lucide React (icons).
- Backend/Desktop Environment: Tauri v2 (Rust).
- Important Plugins: `@tauri-apps/plugin-store` (for settings), `@tauri-apps/plugin-http` (for update checking).

## Core Architectural Rules & Constraints (CRITICAL)
1. **Stateless Data Processing:** The tools themselves MUST NOT save any user input or output data to disk, localStorage, or IndexedDB. All data processing must happen in-memory (React State) and be garbage-collected when the tool component is unmounted.
2. **Network Security:** 
   - No external API calls are allowed for tool functionalities.
   - The ONLY allowed network request is to `https://api.github.com/repos/[YOUR_GITHUB_NAME]/[YOUR_REPO_NAME]/releases/latest` to check for app updates.
   - Must configure `tauri.conf.json` whitelist to strictly enforce this HTTP restriction.
3. **Bookmarking System:** Allow users to bookmark their favorite tools. Bookmark data (just an array of string IDs, e.g., `['json-formatter', 'base64']`) MUST be saved locally using `tauri-plugin-store` in a `config.json` file.
4. **No External Extensions:** Do not implement any plugin/extension system. All tools are built-in.

## Implementation Steps for Antigravity IDE

### Step 1: Project Setup & Tauri Configuration
- Scaffold the project with Tauri + React + TypeScript + Tailwind.
- Configure `tauri.conf.json`:
  - Setup window dimensions (default 1024x768).
  - Setup permissions for `tauri-plugin-store` to save `config.json`.
  - Setup HTTP allowlist strictly for the GitHub API URL mentioned above.

### Step 2: Global State & Bookmarks
- Create a configuration store to manage bookmarks using `tauri-plugin-store`. 
- Load bookmarked tool IDs on startup and provide a function to toggle bookmarks.

### Step 3: Layout & UI
- Build a dual-pane layout: 
  - **Sidebar:** Contains a Search bar, "Favorites" section (rendering bookmarked tools), and categorized tool list (Formatters, Encoders, Generators, etc.).
  - **Main Area:** Displays the currently selected tool.
- Ensure the UI is clean, modern, and supports Dark/Light mode based on OS preferences.

### Step 4: Tool Implementation (Translate from DevToys)
Reference the logic from `https://github.com/DevToys-app/DevToys` (which is primarily C#) and rewrite the logic natively in TypeScript. Create an extensible registry for tools (e.g., `src/tools/index.ts`).

Implement these initial tools immediately:
1. **JSON Formatter & Minifier:** Use native `JSON.parse` and `JSON.stringify`.
2. **Base64 Encoder/Decoder:** Use native `btoa` and `atob` (or a TS library for UTF-8 safety).
3. **URL Encoder/Decoder:** Use `encodeURIComponent` / `decodeURIComponent`.
4. **Hash Generator:** Generate MD5, SHA1, SHA256, SHA512 (Use Web Crypto API `crypto.subtle.digest`, avoid heavy external libs if possible).
5. **UUID Generator:** Use `crypto.randomUUID()`.
6. **JWT Decoder:** Decode header and payload without verifying signature (since offline).

Each tool should have a standard layout:
- Header (Title, Description).
- Configuration Toolbar (e.g., dropdowns for Hash type, indentation spaces for JSON).
- Input Textarea (left/top) and Output Textarea (right/bottom).
- "Copy to Clipboard" and "Clear" buttons.

### Step 5: Auto-Update Checker
- Implement an async function running on startup that uses `@tauri-apps/plugin-http` to hit the GitHub release API.
- Compare `response.data.tag_name` with the app's current version.
- If a newer version exists, show a subtle UI banner (Toast) notifying the user.

## Execution Request
Please act as the principal engineer. Start by executing Step 1 (setting up the basic files and `tauri.conf.json`), then wait for my review before moving to Step 2. When writing tool logic in Step 4, explicitly adapt the logic from the DevToys repository to TypeScript.