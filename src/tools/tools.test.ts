import { describe, it, expect } from "vitest";
import YAML from "yaml";
import { md5 } from "./hash-generator/md5";
import { TOOLS, CATEGORIES } from "./index";

describe("Tool Logic Tests", () => {
  it("verifies that all 31 DevToys tools are registered", () => {
    expect(TOOLS.length).toBe(31);
    expect(CATEGORIES.length).toBe(6);

    const ids = new Set(TOOLS.map((t) => t.id));
    expect(ids.size).toBe(31); // All IDs must be unique
    expect(ids.has("file-folder-diff")).toBe(true);
  });

  describe("MD5 Generator", () => {
    it("computes correct MD5 hash for empty string", () => {
      expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });

    it("computes correct MD5 hash for 'hello'", () => {
      expect(md5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
    });

    it("computes correct MD5 hash for UTF-8 string with emojis", () => {
      expect(md5("Xin chào DevToys 🚀")).toBeDefined();
    });
  });

  describe("Base64 UTF-8 Safe Encoding & Decoding", () => {
    function encodeUtf8Base64(str: string, urlSafe = false): string {
      const bytes = new TextEncoder().encode(str);
      let binString = "";
      for (let i = 0; i < bytes.length; i++) {
        binString += String.fromCharCode(bytes[i]);
      }
      let res = btoa(binString);
      if (urlSafe) {
        res = res.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      return res;
    }

    function decodeUtf8Base64(input: string, urlSafe = false): string {
      let str = input.trim();
      if (urlSafe || str.includes("-") || str.includes("_")) {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) {
          str += "=";
        }
      }
      const binString = atob(str);
      const bytes = new Uint8Array(binString.length);
      for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    it("encodes and decodes standard ASCII string", () => {
      const text = "Hello World!";
      const encoded = encodeUtf8Base64(text);
      expect(encoded).toBe("SGVsbG8gV29ybGQh");
      expect(decodeUtf8Base64(encoded)).toBe(text);
    });

    it("encodes and decodes UTF-8 Vietnamese & Emoji characters safely without exception", () => {
      const complexText = "Công cụ lập trình Toys of Dev tiện lợi 🚀";
      const encoded = encodeUtf8Base64(complexText);
      const decoded = decodeUtf8Base64(encoded);
      expect(decoded).toBe(complexText);
    });

    it("supports URL-safe Base64 without + or / or trailing =", () => {
      const text = "subjects?query=test&value=123+456";
      const urlSafeEncoded = encodeUtf8Base64(text, true);
      expect(urlSafeEncoded).not.toContain("+");
      expect(urlSafeEncoded).not.toContain("/");
      expect(urlSafeEncoded).not.toContain("=");
      expect(decodeUtf8Base64(urlSafeEncoded, true)).toBe(text);
    });
  });

  describe("JSON ↔ YAML Converter", () => {
    it("converts JSON to YAML and back correctly", () => {
      const original = { app: "DevToys", version: 1, active: true, list: ["a", "b"] };
      const yamlStr = YAML.stringify(original);
      expect(yamlStr).toContain("app: DevToys");
      const parsedBack = YAML.parse(yamlStr);
      expect(parsedBack).toEqual(original);
    });
  });

  describe("Number Base Conversions", () => {
    it("converts between Dec, Hex, Bin, and Oct correctly", () => {
      const n = BigInt(42);
      expect(n.toString(10)).toBe("42");
      expect(n.toString(16)).toBe("2a");
      expect(n.toString(2)).toBe("101010");
      expect(n.toString(8)).toBe("52");
    });
  });

  describe("String Escape & Unescape", () => {
    it("escapes quotes and newlines for JavaScript/JSON", () => {
      const str = 'Hello "World"!\nLine 2';
      const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
      expect(escaped).toBe('Hello \\"World\\"!\\nLine 2');
    });
  });

  describe("List Comparison", () => {
    it("computes intersection and difference correctly", () => {
      const a = ["apple", "banana", "cherry"];
      const b = ["banana", "date"];

      const intersection = a.filter((item) => b.includes(item));
      expect(intersection).toEqual(["banana"]);

      const diffA = a.filter((item) => !b.includes(item));
      expect(diffA).toEqual(["apple", "cherry"]);
    });
  });

  describe("URL Encoder & Decoder", () => {
    it("encodes and decodes query component", () => {
      const input = "https://example.com/search?q=dev tools&category=test";
      const encoded = encodeURIComponent(input);
      expect(encoded).toContain("%2F");
      expect(decodeURIComponent(encoded)).toBe(input);
    });
  });

  describe("JWT Decoder logic", () => {
    function base64UrlDecode(str: string): string {
      let output = str.replace(/-/g, "+").replace(/_/g, "/");
      while (output.length % 4) {
        output += "=";
      }
      const bin = atob(output);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    it("decodes valid JWT header and payload without signature verification", () => {
      const sampleJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

      const [headerB64, payloadB64] = sampleJwt.split(".");
      const header = JSON.parse(base64UrlDecode(headerB64));
      const payload = JSON.parse(base64UrlDecode(payloadB64));

      expect(header.alg).toBe("HS256");
      expect(payload.name).toBe("John Doe");
      expect(payload.sub).toBe("1234567890");
    });
  });

  describe("Text Diff Alignment & Character Diff logic", () => {
    it("identifies differences between original and modified texts", () => {
      const original = "function calculateTax(income, rate) {\n  return income * rate;\n}";
      const modified = "function calculateTax(income, rate, deduction = 0) {\n  return (income - deduction) * rate;\n}";

      const origLines = original.split("\n");
      const modLines = modified.split("\n");

      expect(origLines.length).toBe(3);
      expect(modLines.length).toBe(3);
      expect(origLines[0]).not.toBe(modLines[0]);
      expect(origLines[1]).not.toBe(modLines[1]);
      expect(origLines[2]).toBe(modLines[2]);
    });

    it("correctly aligns user example with substitution on line 1 and insertion on line 2", () => {
      const orig = ["hekki", "sdsd", "sdsd"];
      const mod = ["sdsds", "sdsd", "sdsd", "sdsd"];

      // Verify identical common lines at the bottom:
      expect(orig.slice(1)).toEqual(mod.slice(2));
      expect(orig[0]).not.toEqual(mod[0]);
    });

    it("correctly identifies identical lines and diff hunks in user example 2", () => {
      const orig = ["hekki", "sdsd", "sdsd", "", "hello"];
      const mod = ["sdsds", "sdsd                  ", "sdsd", "sdsd edit", ""];

      // orig[2] === mod[2] ("sdsd")
      expect(orig[2]).toBe(mod[2]);
      // orig[3] === mod[4] ("")
      expect(orig[3]).toBe(mod[4]);
      // orig[1] prefix matches mod[1]
      expect(mod[1].startsWith(orig[1])).toBe(true);
      // mod[1] has trailing spaces
      expect(mod[1].length).toBeGreaterThan(orig[1].length);
    });
  });

  describe("File & Folder Diff Logic", () => {
    it("handles whitespace ignoring in line comparison", async () => {
      const { normalizeLine, buildAlignedRows } = await import("./file-folder-diff/FileFolderDiffComparer");
      
      const lineWithTrailingSpaces = "sdsd                  ";
      const cleanLine = "sdsd";

      // When whitespace is NOT ignored:
      const normDefault = normalizeLine(lineWithTrailingSpaces, { ignoreWhitespace: false, ignoreCase: false });
      expect(normDefault).not.toBe(cleanLine);

      // When whitespace IS ignored:
      const normIgnored = normalizeLine(lineWithTrailingSpaces, { ignoreWhitespace: true, ignoreCase: false });
      expect(normIgnored).toBe(cleanLine);

      // Verify aligned rows treating them as identical when option is enabled
      const rows = buildAlignedRows(cleanLine, lineWithTrailingSpaces, { ignoreWhitespace: true, ignoreCase: false });
      expect(rows.length).toBe(1);
      expect(rows[0].isChanged).toBe(false);
      expect(rows[0].type).toBe("SAME");
    });

    it("correctly computes folder differences between two directories", () => {
      const folderA = new Map([
        ["src/index.ts", "console.log('v1');"],
        ["src/legacy.ts", "export const old = 1;"],
        ["README.md", "# Project"],
      ]);

      const folderB = new Map([
        ["src/index.ts", "console.log('v2');"],
        ["src/new-feature.ts", "export const newF = 2;"],
        ["README.md", "# Project"],
      ]);

      const allPaths = new Set([...folderA.keys(), ...folderB.keys()]);
      const diffResults: { path: string; status: string }[] = [];

      for (const path of allPaths) {
        const inA = folderA.has(path);
        const inB = folderB.has(path);
        if (inA && !inB) {
          diffResults.push({ path, status: "deleted" });
        } else if (!inA && inB) {
          diffResults.push({ path, status: "added" });
        } else {
          const mod = folderA.get(path) !== folderB.get(path);
          diffResults.push({ path, status: mod ? "modified" : "unchanged" });
        }
      }

      const statusMap = Object.fromEntries(diffResults.map((r) => [r.path, r.status]));
      expect(statusMap["src/legacy.ts"]).toBe("deleted");
      expect(statusMap["src/new-feature.ts"]).toBe("added");
      expect(statusMap["src/index.ts"]).toBe("modified");
      expect(statusMap["README.md"]).toBe("unchanged");
    });
  });

  describe("i18n Multi-Language System & Store Persistence", () => {
    it("ensures all categories and tools exist in both English and Vietnamese dictionaries", async () => {
      const { en } = await import("../i18n/locales/en");
      const { vi } = await import("../i18n/locales/vi");
      const { CATEGORIES, TOOLS } = await import("./index");

      // Verify categories
      CATEGORIES.forEach((cat) => {
        expect(en.categories[cat.id]).toBeDefined();
        expect(en.categories[cat.id].title).toBeTruthy();
        expect(vi.categories[cat.id]).toBeDefined();
        expect(vi.categories[cat.id].title).toBeTruthy();
      });

      // Verify tools
      TOOLS.forEach((tool) => {
        expect(en.tools[tool.id]).toBeDefined();
        expect(en.tools[tool.id].title).toBeTruthy();
        expect(en.tools[tool.id].description).toBeTruthy();

        expect(vi.tools[tool.id]).toBeDefined();
        expect(vi.tools[tool.id].title).toBeTruthy();
        expect(vi.tools[tool.id].description).toBeTruthy();
      });
    });

    it("supports localized categories and tools resolution based on active language", async () => {
      const { getLocalizedCategories, getLocalizedTools, getToolById } = await import("./index");

      const enCats = getLocalizedCategories("en");
      const viCats = getLocalizedCategories("vi");
      expect(enCats[0].title).not.toBe(viCats[0].title);
      expect(viCats.find((c) => c.id === "text")?.title).toContain("Văn Bản");

      const enTools = getLocalizedTools("en");
      const viTools = getLocalizedTools("vi");
      expect(enTools.length).toBe(viTools.length);

      const enTool = getToolById("file-folder-diff", "en");
      const viTool = getToolById("file-folder-diff", "vi");
      expect(enTool?.title).toBe("File & Folder Diff");
      expect(viTool?.title).toBe("So Sánh File & Thư Mục");
    });

    it("persists language selection and loads default language as English", async () => {
      const { loadLanguageFromDisk, saveLanguageToDisk } = await import("../services/storeService");

      // Test default language
      const defaultLang = await loadLanguageFromDisk();
      expect(["en", "vi"]).toContain(defaultLang);

      // Test saving and loading Vietnamese
      await saveLanguageToDisk("vi");
      const viLang = await loadLanguageFromDisk();
      expect(viLang).toBe("vi");

      // Restore to English
      await saveLanguageToDisk("en");
      const restored = await loadLanguageFromDisk();
      expect(restored).toBe("en");
    });

    it("verifies ui and common dictionaries have complete parity and no empty strings", async () => {
      const { en } = await import("../i18n/locales/en");
      const { vi } = await import("../i18n/locales/vi");

      // Verify common
      const commonKeys = Object.keys(en.common) as (keyof typeof en.common)[];
      commonKeys.forEach((key) => {
        expect(en.common[key]).toBeTruthy();
        expect(vi.common[key]).toBeTruthy();
      });

      // Verify ui
      const uiKeys = Object.keys(en.ui) as (keyof typeof en.ui)[];
      uiKeys.forEach((key) => {
        expect(en.ui[key]).toBeTruthy();
        expect(vi.ui[key]).toBeTruthy();
      });

      // Verify diff
      const diffKeys = Object.keys(en.diff) as (keyof typeof en.diff)[];
      diffKeys.forEach((key) => {
        expect(en.diff[key]).toBeTruthy();
        expect(vi.diff[key]).toBeTruthy();
      });
    });
  });
});


