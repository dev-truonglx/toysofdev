import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { AIConfig } from "./storeService";

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function unifiedFetch(url: string, options: RequestInit): Promise<Response> {
  if (isTauriEnvironment()) {
    try {
      // Use Tauri HTTP plugin to bypass browser CORS on desktop
      return await tauriFetch(url, options as any);
    } catch (err) {
      console.warn("Tauri fetch failed, falling back to window.fetch:", err);
    }
  }
  return await window.fetch(url, options);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequestOptions {
  systemPrompt?: string;
  userPrompt: string;
  responseFormat?: "text" | "json";
  temperature?: number;
}

/**
 * Cleans markdown code blocks (```json ... ```) and extracts raw JSON string
 */
export function extractJsonFromText(rawText: string): string {
  let cleaned = rawText.trim();
  // Strip ```json or ``` at beginning and ``` at end
  const jsonBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const match = cleaned.match(jsonBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  } else {
    // If text contains ```json ... ``` somewhere inside
    const insideMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (insideMatch) {
      cleaned = insideMatch[1].trim();
    }
  }

  // Find the outermost '{' ... '}' or '[' ... ']'
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned;
}

/**
 * Executes a call to Google Gemini REST API
 */
async function callGemini(
  apiKey: string,
  model: string,
  options: AIRequestOptions,
  retryCount = 0
): Promise<string> {
  const cleanModel = model.replace(/^models\//, "").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const promptParts: string[] = [];
  if (options.systemPrompt) {
    promptParts.push(`SYSTEM INSTRUCTIONS:\n${options.systemPrompt}`);
  }
  promptParts.push(options.userPrompt);

  const fullPrompt = promptParts.join("\n\n---\n\n");

  const requestBody: any = {
    contents: [
      {
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
    },
  };

  if (options.responseFormat === "json") {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await unifiedFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey.trim(),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `Gemini API error (${response.status}): ${response.statusText}`;
    try {
      const errJson = JSON.parse(errorBody);
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      if (errorBody) errorMsg = errorBody;
    }

    // Auto-retry on 503 / High demand / Temporary spikes up to 1 time with backoff
    const isTemporaryDemand =
      (response.status === 503 || response.status === 429) &&
      (errorMsg.toLowerCase().includes("high demand") ||
        errorMsg.toLowerCase().includes("overloaded") ||
        errorMsg.toLowerCase().includes("unavailable"));

    if (isTemporaryDemand && retryCount < 1) {
      console.warn(`[Gemini API] High demand on ${model}, retrying in 1.5s (attempt ${retryCount + 1})...`);
      await new Promise((r) => setTimeout(r, 1500));
      return callGemini(apiKey, model, options, retryCount + 1);
    }

    throw new Error(errorMsg);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("No response candidates returned from Gemini API");
  }

  const text = candidate.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return text;
}

function normalizeClaudeModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed === "claude-sonnet-5.5") return "claude-sonnet-5-5";
  if (trimmed === "claude-opus-5.5") return "claude-opus-5-5";
  if (trimmed === "claude-haiku-4.5") return "claude-haiku-4-5";
  if (trimmed === "claude-fable-5.1") return "claude-fable-5-1";
  if (trimmed === "claude-3-7-sonnet") return "claude-3-7-sonnet-20250219";
  if (trimmed === "claude-3-5-sonnet") return "claude-3-5-sonnet-20241022";
  if (trimmed === "claude-3-5-haiku") return "claude-3-5-haiku-20241022";
  if (trimmed === "claude-3-opus") return "claude-3-opus-20240229";
  return trimmed;
}

/**
 * Executes a call to Anthropic Claude REST API
 */
async function callClaude(
  apiKey: string,
  model: string,
  options: AIRequestOptions
): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";
  const resolvedModel = normalizeClaudeModel(model);

  const requestBody: any = {
    model: resolvedModel,
    max_tokens: 4096,
    temperature: options.temperature ?? 0.2,
    messages: [
      {
        role: "user",
        content: options.userPrompt,
      },
    ],
  };

  if (options.systemPrompt) {
    requestBody.system = options.systemPrompt;
  }

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    "anthropic-dangerous-direct-browser-access": "true",
  };

  const response = await unifiedFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `Claude API error (${response.status}): ${response.statusText}`;
    try {
      const errJson = JSON.parse(errorBody);
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      if (errorBody) errorMsg = errorBody;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const textContent =
    data.content?.find((c: any) => c.type === "text")?.text ||
    data.content?.[0]?.text ||
    "";
  return textContent;
}

export interface LocalCliStatus {
  available: boolean;
  path: string;
  version: string;
  default_model: string;
  available_models: string[];
}

export async function checkLocalCliStatus(cliPath?: string): Promise<LocalCliStatus> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<LocalCliStatus>("check_local_cli", { cliPath: cliPath || null });
    } catch (err: any) {
      console.warn("Failed to check local CLI via Tauri invoke:", err);
      return {
        available: false,
        path: "",
        version: "",
        default_model: "gemini-3.8-flash-high",
        available_models: [],
      };
    }
  }
  return {
    available: false,
    path: "",
    version: "mock",
    default_model: "gemini-3.8-flash-high",
    available_models: ["gemini-3.8-flash-high"],
  };
}

export async function callLocalCli(
  cliPath: string | undefined,
  model: string | undefined,
  options: AIRequestOptions
): Promise<string> {
  if (!isTauriEnvironment()) {
    throw new Error("Local CLI provider requires running in the desktop Tauri application.");
  }

  const promptParts: string[] = [];
  if (options.systemPrompt) {
    promptParts.push(`SYSTEM INSTRUCTIONS:\n${options.systemPrompt}`);
  }
  promptParts.push(options.userPrompt);
  if (options.responseFormat === "json") {
    promptParts.push(
      "CRITICAL: Output ONLY valid raw JSON conforming strictly to the requested schema. No conversational replies, no markdown code fence wrappers."
    );
  }
  const fullPrompt = promptParts.join("\n\n---\n\n");

  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<string>("execute_local_cli", {
    prompt: fullPrompt,
    model: model || "gemini-3.8-flash-high",
    cliPath: cliPath || null,
  });

  return result;
}

/**
 * Unified AI call router with automatic model failover on temporary high-demand spikes
 */
export async function generateAIContent(
  config: AIConfig,
  options: AIRequestOptions
): Promise<string> {
  const { provider } = config;

  if (provider === "local-cli") {
    return await callLocalCli(config.localCliPath, config.localCliModel, options);
  }

  const apiKey = provider === "gemini" ? config.geminiApiKey : config.claudeApiKey;
  const primaryModel = provider === "gemini" ? config.geminiModel : config.claudeModel;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      `API Key for ${provider.toUpperCase()} is not configured. Please configure it in the AI Settings.`
    );
  }

  // Backup models with high capacity in case the primary is temporarily overloaded
  const geminiBackups = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];
  const claudeBackups = ["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022"];

  const candidateModels = [primaryModel];
  const backups = provider === "gemini" ? geminiBackups : claudeBackups;
  for (const b of backups) {
    if (!candidateModels.includes(b)) {
      candidateModels.push(b);
    }
  }

  let lastError: any = null;
  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i];
    try {
      if (provider === "gemini") {
        return await callGemini(apiKey.trim(), currentModel, options);
      } else {
        return await callClaude(apiKey.trim(), currentModel, options);
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = (err.message || "").toLowerCase();
      const isHighDemandOrOverload =
        errMsg.includes("high demand") ||
        errMsg.includes("overloaded") ||
        errMsg.includes("unavailable") ||
        errMsg.includes("503") ||
        errMsg.includes("429") ||
        errMsg.includes("spikes in demand") ||
        errMsg.includes("quota") ||
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("rate-limit") ||
        errMsg.includes("exceeded your current quota");

      // If it's a server-side high-demand or model quota issue and we have a fallback model, failover gracefully
      if (isHighDemandOrOverload && i < candidateModels.length - 1) {
        const nextModel = candidateModels[i + 1];
        console.warn(
          `[AI Service] Model "${currentModel}" reached capacity/quota limit. Automatically failing over to resilient model "${nextModel}"...`
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }

      // If it's a fatal client error (bad key, 401, etc.), throw immediately
      throw err;
    }
  }

  throw lastError || new Error("Failed to generate AI content after all attempts");
}

/**
 * Calls AI and guarantees parsed JSON object. If malformed, executes a self-healing retry.
 */
export async function generateAIJson<T = any>(
  config: AIConfig,
  options: AIRequestOptions,
  maxRetries: number = 2
): Promise<T> {
  let attempts = 0;
  let currentOptions: AIRequestOptions = {
    ...options,
    responseFormat: "json",
  };

  while (attempts <= maxRetries) {
    let rawText = "";
    try {
      // Step 1: Call API (this handles network errors and automatic model failover internally)
      rawText = await generateAIContent(config, currentOptions);
    } catch (apiErr: any) {
      // Direct API failure (network, auth, or total provider outage)
      throw apiErr;
    }

    // Step 2: Parse JSON
    try {
      const jsonStr = extractJsonFromText(rawText);
      const parsed = JSON.parse(jsonStr) as T;
      return parsed;
    } catch (jsonErr: any) {
      attempts++;
      if (attempts > maxRetries) {
        throw new Error(
          `AI returned malformed JSON after ${attempts} attempts: ${jsonErr.message}. Output was: ${rawText.slice(0, 200)}...`
        );
      }
      console.warn(`[AI Service] JSON parse failed, triggering self-healing prompt retry #${attempts}...`);
      // Update prompt for self-healing JSON retry
      currentOptions = {
        ...options,
        userPrompt: `${options.userPrompt}\n\nIMPORTANT: Your previous output was not valid JSON: "${jsonErr.message}". Return ONLY pure valid JSON conforming strictly to the requested schema with no markdown wrapping, no introductory text, and properly escaped characters.`,
        responseFormat: "json",
      };
    }
  }

  throw new Error("Unexpected error in generateAIJson");
}

/**
 * Tests connection to the selected AI provider and measures round-trip latency
 */
export async function testAIConnection(
  provider: "gemini" | "claude" | "local-cli",
  apiKey: string,
  model: string,
  cliPath?: string
): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
  availableModels?: AvailableModelInfo[];
}> {
  const startTime = Date.now();

  if (provider === "local-cli") {
    try {
      const status = await checkLocalCliStatus(cliPath);
      if (!status.available) {
        return {
          success: false,
          latencyMs: 0,
          error:
            "Không tìm thấy CLI `agy` trên máy. Vui lòng kiểm tra file ~/.local/bin/agy hoặc nhập đường dẫn chính xác.",
        };
      }
      await callLocalCli(cliPath, model || "gemini-3.8-flash-high", {
        userPrompt: "Respond with the word: OK",
        temperature: 0.1,
      });
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        availableModels: status.available_models.map((m) => ({
          id: m,
          displayName: m,
        })),
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.message || "Lỗi kết nối Local CLI.",
      };
    }
  }

  if (!apiKey || !apiKey.trim()) {
    return { success: false, latencyMs: 0, error: "API Key cannot be empty." };
  }

  try {
    const testOptions: AIRequestOptions = {
      userPrompt: "Respond with the word: OK",
      temperature: 0.1,
    };

    if (provider === "gemini") {
      await callGemini(apiKey.trim(), model, testOptions);
    } else {
      await callClaude(apiKey.trim(), model, testOptions);
    }

    const latencyMs = Date.now() - startTime;
    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    let detailedError = err.message || "Connection failed. Please check key and network.";
    let availableModels: AvailableModelInfo[] | undefined;

    if (provider === "gemini") {
      try {
        const liveModels = await fetchAvailableGeminiModels(apiKey.trim());
        if (liveModels && liveModels.length > 0) {
          availableModels = liveModels;
          const cleanModel = model.replace(/^models\//, "").trim();
          const isModelSupported = liveModels.some((m) => m.id === cleanModel);
          if (!isModelSupported) {
            detailedError = `API Key của bạn hoàn toàn hợp lệ! Tuy nhiên model "${cleanModel}" chưa được kích hoạt cho endpoint này. Các model trực tiếp khả dụng: ${liveModels.slice(0, 3).map((m) => m.id).join(", ")}.`;
          }
        }
      } catch {
        // Key validation error
      }
    }

    return {
      success: false,
      latencyMs,
      error: detailedError,
      availableModels,
    };
  }
}

export interface AvailableModelInfo {
  id: string;
  displayName: string;
  description?: string;
}

/**
 * Directly queries Google Gemini API to retrieve all models available for the user's specific key
 */
export async function fetchAvailableGeminiModels(
  apiKey: string
): Promise<AvailableModelInfo[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Vui lòng nhập API Key trước khi quét danh sách model.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
    apiKey.trim()
  )}&pageSize=50`;

  const response = await unifiedFetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey.trim(),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `Lỗi tải danh sách model (${response.status}): ${response.statusText}`;
    try {
      const errJson = JSON.parse(errorBody);
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      if (errorBody) errorMsg = errorBody;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const models: any[] = data.models || [];

  return models
    .filter((m) => {
      const methods: string[] = m.supportedGenerationMethods || [];
      return methods.includes("generateContent");
    })
    .map((m) => {
      const cleanId = (m.name || "").replace(/^models\//, "");
      return {
        id: cleanId,
        displayName: m.displayName || cleanId,
        description: m.description || "",
      };
    });
}

