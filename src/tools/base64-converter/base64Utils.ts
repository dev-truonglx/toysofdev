/**
 * High-performance UTF-8 Safe Base64 Encoder & Decoder
 * Uses 32KB chunking with String.fromCharCode.apply to prevent call-stack overflows
 * and avoid O(N^2) string concatenation reallocations on large text.
 */

const CHUNK_SIZE = 0x8000; // 32,768 bytes per chunk
export const MAX_BASE64_INPUT_BYTES = 50 * 1024 * 1024; // 50 MB safety threshold

export interface Base64Options {
  urlSafe?: boolean;
}

/**
 * Encodes a UTF-8 string into standard or URL-safe Base64.
 */
export function encodeUtf8Base64(input: string, options?: Base64Options): string {
  if (!input) return "";

  const bytes = new TextEncoder().encode(input);
  if (bytes.length > MAX_BASE64_INPUT_BYTES) {
    throw new Error(
      `Input size (${(bytes.length / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB safety limit.`,
    );
  }

  // Chunked String.fromCharCode to avoid call stack limits (65k) while keeping peak performance
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }

  let base64 = btoa(chunks.join(""));

  if (options?.urlSafe) {
    base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  return base64;
}

/**
 * Decodes a standard or URL-safe Base64 string into a UTF-8 string.
 * Strips whitespace, line breaks (MIME/PEM format), and restores missing padding.
 */
export function decodeUtf8Base64(input: string, options?: Base64Options): string {
  // Strip whitespace, tabs, and newlines commonly found in PEM or wrapped base64
  let str = input.replace(/\s+/g, "");
  if (!str) return "";

  // Normalize URL-safe characters back to standard Base64
  if (options?.urlSafe || str.includes("-") || str.includes("_")) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
  }

  // Restore padding if missing
  const remainder = str.length % 4;
  if (remainder === 2) {
    str += "==";
  } else if (remainder === 3) {
    str += "=";
  } else if (remainder === 1) {
    throw new Error("Invalid Base64 string length: remainder of 1 cannot be padded.");
  }

  let binString: string;
  try {
    binString = atob(str);
  } catch (err) {
    throw new Error("Failed to decode Base64: Invalid character sequence.");
  }

  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}
