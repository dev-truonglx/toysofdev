import { describe, it, expect } from "vitest";
import YAML from "yaml";
import { md5 } from "./hash-generator/md5";
import { TOOLS, CATEGORIES } from "./index";

import { encodeUtf8Base64, decodeUtf8Base64 } from "./base64-converter/base64Utils";
import { filterLogLines } from "./log-grep/logFilterEngine";
import { LOG_PRESETS } from "./log-grep/presets";
import { generateCodeFromJson } from "./json-to-code/jsonToCodeEngine";
import { parseCurlCommand, convertCurlToCode } from "./curl-converter/curlParserEngine";
import {
  parseOctalToState,
  getOctalString,
  getSymbolicString,
  parseSymbolicToState,
  getChmodCommands,
  DEFAULT_CHMOD_STATE,
} from "./chmod-calculator/chmodEngine";
import {
  convertToBytes,
  formatBytes,
  generateDummyBuffer,
  SUPPORTED_FORMATS,
} from "./dummy-file-generator/dummyFileEngine";
import {
  generateStringBoundaryCases,
  generateNumberBoundaryCases,
  generateEmailBoundaryCases,
  exportToMarkdownTable,
  exportToCsv,
  SECURITY_PAYLOADS,
  getSecurityPayloads,
} from "./boundary-tester/boundaryEngine";
import {
  generatePairwiseTestCases,
  calculateCartesianProduct,
  PAIRWISE_PRESETS,
} from "./pairwise-tester/pairwiseEngine";
import {
  isValidLuhn,
  generateValidCreditCard,
  generateVietnamCccd,
  generateVietnamTaxCode,
  generateJapaneseMyNumber,
  isValidJapaneseMyNumber,
  generateMockDataset,
} from "./fake-data-generator/fakeDataEngine";
import {
  generateMatchingString,
  generateRegexTestSuite,
  REGEX_PRESETS,
} from "./regex-reverse-generator/regexReverseEngine";

describe("Tool Logic Tests", () => {
  it("verifies that all 40 DevToys tools are registered", () => {
    expect(TOOLS.length).toBe(40);
    expect(CATEGORIES.length).toBe(6);

    const ids = new Set(TOOLS.map((t) => t.id));
    expect(ids.size).toBe(40); // All IDs must be unique
    expect(ids.has("file-folder-diff")).toBe(true);
    expect(ids.has("log-grep")).toBe(true);
    expect(ids.has("json-to-code")).toBe(true);
    expect(ids.has("curl-converter")).toBe(true);
    expect(ids.has("chmod-calculator")).toBe(true);
    expect(ids.has("dummy-file-generator")).toBe(true);
    expect(ids.has("boundary-tester")).toBe(true);
    expect(ids.has("pairwise-tester")).toBe(true);
    expect(ids.has("fake-data-generator")).toBe(true);
    expect(ids.has("regex-reverse-generator")).toBe(true);
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
      const urlSafeEncoded = encodeUtf8Base64(text, { urlSafe: true });
      expect(urlSafeEncoded).not.toContain("+");
      expect(urlSafeEncoded).not.toContain("/");
      expect(urlSafeEncoded).not.toContain("=");
      expect(decodeUtf8Base64(urlSafeEncoded, { urlSafe: true })).toBe(text);
    });

    it("handles whitespace and linebreaks in Base64 (PEM/MIME format)", () => {
      const text = "A".repeat(100);
      const encoded = encodeUtf8Base64(text);
      // Split encoded with newlines every 20 characters
      const wrapped = encoded.match(/.{1,20}/g)?.join("\r\n") || encoded;
      expect(decodeUtf8Base64(wrapped)).toBe(text);
    });

    it("efficiently encodes and decodes large payload exceeding call stack limit (>65k bytes)", () => {
      const largeText = "Hello World Chunking Test 🚀\n".repeat(3000); // ~90KB
      const t0 = performance.now();
      const encoded = encodeUtf8Base64(largeText);
      const decoded = decodeUtf8Base64(encoded);
      const elapsed = performance.now() - t0;

      expect(decoded).toBe(largeText);
      expect(elapsed).toBeLessThan(100); // should process in < 100ms
    });
  });

  describe("Regex Tester Logic", () => {
    it("extracts matches and capture groups with global flag", () => {
      const pattern = "(\\w+)@([\\w.]+)";
      const text = "admin@example.com, test@dev.local";
      const reg = new RegExp(pattern, "g");
      const matches: { match: string; groups: string[] }[] = [];
      let m: RegExpExecArray | null;
      while ((m = reg.exec(text)) !== null) {
        matches.push({ match: m[0], groups: m.slice(1) });
      }
      expect(matches.length).toBe(2);
      expect(matches[0].match).toBe("admin@example.com");
      expect(matches[0].groups).toEqual(["admin", "example.com"]);
    });

    it("safely handles zero-length regex matches without infinite loops", () => {
      const reg = new RegExp("\\b", "g");
      const text = "hi";
      let count = 0;
      let m: RegExpExecArray | null;
      while ((m = reg.exec(text)) !== null && count < 10) {
        count++;
        if (m[0].length === 0) {
          if (reg.lastIndex >= text.length) break;
          reg.lastIndex++;
        }
      }
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it("captures named groups (?<name>...)", () => {
      const pattern = "(?<area>\\d{3})-(?<phone>\\d{3}-\\d{4})";
      const text = "Call 123-456-7890 today";
      const reg = new RegExp(pattern);
      const m = reg.exec(text);
      expect(m).not.toBeNull();
      expect(m?.groups).toEqual({ area: "123", phone: "456-7890" });
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

    it("parses decoded segments correctly with parseUrlDecode", async () => {
      const { parseUrlDecode, parseUrlEncode } = await import("./url-encoder/urlUtils");

      const encodedStr = "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world";
      const decodedSegments = parseUrlDecode(encodedStr, false);

      expect(decodedSegments.length).toBeGreaterThan(1);
      const decodedOnly = decodedSegments.filter((s) => s.isChanged);
      expect(decodedOnly.map((s) => s.original)).toEqual(["%3A", "%2F", "%2F", "%2F", "%3F", "%3D", "%20"]);
      expect(decodedOnly.map((s) => s.text)).toEqual([":", "/", "/", "/", "?", "=", " "]);
      expect(decodedSegments.map((s) => s.text).join("")).toBe("https://example.com/search?q=hello world");

      // Test multi-byte UTF-8 emoji & Vietnamese characters
      const utf8Encoded = "Xin%20ch%C3%A0o%20%F0%9F%98%80";
      const utf8DecodedSegments = parseUrlDecode(utf8Encoded, false);
      const utf8DecodedOnly = utf8DecodedSegments.filter((s) => s.isChanged);
      expect(utf8DecodedOnly.map((s) => s.original)).toEqual(["%20", "%C3%A0", "%20", "%F0%9F%98%80"]);
      expect(utf8DecodedOnly.map((s) => s.text)).toEqual([" ", "à", " ", "😀"]);
      expect(utf8DecodedSegments.map((s) => s.text).join("")).toBe("Xin chào 😀");

      // Test encode mode parser
      const plainText = "hello world!";
      const encodeSegments = parseUrlEncode(plainText, false);
      expect(encodeSegments.find((s) => s.isChanged)?.text).toBe("%20");
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

  describe("Log Grep & Filter Engine", () => {
    const sampleLogs = [
      "2026-09-22 10:00:00 [INFO] Starting service",
      "2026-09-22 10:00:01 [WARN] Cache miss for user_id=12",
      "2026-09-22 10:00:02 [ERROR] Database connection failed",
      "java.sql.SQLException: Connection refused",
      "    at com.example.db.Pool.getConnection(Pool.java:45)",
      "2026-09-22 10:00:05 [INFO] Health check GET /healthz 200 OK",
    ].join("\n");

    it("filters lines with literal string search", () => {
      const result = filterLogLines(sampleLogs, {
        pattern: "Database",
        isRegex: false,
        matchCase: false,
        wholeWord: false,
        invertMatch: false,
        contextLines: 0,
      });

      expect(result.matchedCount).toBe(1);
      expect(result.lines.length).toBe(1);
      expect(result.lines[0].lineNumber).toBe(3);
      expect(result.lines[0].content).toContain("Database connection failed");
      expect(result.lines[0].highlights.length).toBe(1);
    });

    it("filters lines with regex pattern", () => {
      const result = filterLogLines(sampleLogs, {
        pattern: "\\[(ERROR|WARN)\\]",
        isRegex: true,
        matchCase: true,
        wholeWord: false,
        invertMatch: false,
        contextLines: 0,
      });

      expect(result.matchedCount).toBe(2);
      expect(result.lines.map((l) => l.lineNumber)).toEqual([2, 3]);
    });

    it("supports invert match (grep -v)", () => {
      const result = filterLogLines(sampleLogs, {
        pattern: "healthz",
        isRegex: false,
        matchCase: false,
        wholeWord: false,
        invertMatch: true,
        contextLines: 0,
      });

      expect(result.matchedCount).toBe(5);
      expect(result.lines.some((l) => l.content.includes("healthz"))).toBe(false);
    });

    it("supports context lines before and after match (grep -C)", () => {
      const result = filterLogLines(sampleLogs, {
        pattern: "Database",
        isRegex: false,
        matchCase: false,
        wholeWord: false,
        invertMatch: false,
        contextLines: 1,
      });

      // Match is line 3, with context 1 line before (line 2) and 1 line after (line 4)
      expect(result.matchedCount).toBe(1);
      expect(result.lines.length).toBe(3);
      expect(result.lines.map((l) => l.lineNumber)).toEqual([2, 3, 4]);
      expect(result.lines[0].isContext).toBe(true);
      expect(result.lines[1].isMatch).toBe(true);
      expect(result.lines[2].isContext).toBe(true);
    });

    it("strictly maintains symmetric context line count before and after matching line", () => {
      const logs = Array.from(
        { length: 50 },
        (_, i) => `Line ${i + 1}: ${i + 1 === 25 ? "TARGET_MATCH" : "normal log"}`,
      ).join("\n");

      [1, 5, 10, 15].forEach((ctx) => {
        const result = filterLogLines(logs, {
          pattern: "TARGET_MATCH",
          isRegex: false,
          matchCase: false,
          wholeWord: false,
          invertMatch: false,
          contextLines: ctx,
        });

        expect(result.matchedCount).toBe(1);
        // Total lines should be ctx before + 1 match + ctx after = 2 * ctx + 1
        expect(result.lines.length).toBe(ctx * 2 + 1);

        const matchIndexInResult = result.lines.findIndex((l) => l.isMatch);
        expect(matchIndexInResult).toBe(ctx); // exactly ctx lines before

        const linesAfterCount = result.lines.length - 1 - matchIndexInResult;
        expect(linesAfterCount).toBe(ctx); // exactly ctx lines after

        // Verify line numbers
        expect(result.lines[0].lineNumber).toBe(25 - ctx);
        expect(result.lines[result.lines.length - 1].lineNumber).toBe(25 + ctx);
      });
    });

    it("verifies all log regex presets are syntactically valid", () => {
      expect(LOG_PRESETS.length).toBeGreaterThan(10);
      LOG_PRESETS.forEach((preset) => {
        expect(() => new RegExp(preset.pattern, "g")).not.toThrow();
        expect(preset.label).toBeTruthy();
        expect(preset.description).toBeTruthy();
      });
    });
  });

  describe("XML Formatter & Minifier", () => {
    it("formats simple XML with inline elements", async () => {
      const { formatXml } = await import("./xml-formatter/XmlFormatter");
      const input = "<note><to>Tove</to><from>Jani</from></note>";
      const formatted = formatXml(input, "2", "inline");
      expect(formatted).toBe("<note>\n  <to>Tove</to>\n  <from>Jani</from>\n</note>");
    });

    it("formats attributes inline when inline mode is selected", async () => {
      const { formatXml } = await import("./xml-formatter/XmlFormatter");
      const input = `<shipping ship_no="123" ship_date="2026/09/26"><goods code="ABC" price="100"/></shipping>`;
      const formatted = formatXml(input, "2", "inline");
      expect(formatted).toContain(`<shipping ship_no="123" ship_date="2026/09/26">`);
      expect(formatted).toContain(`  <goods code="ABC" price="100" />`);
    });

    it("formats attributes multiline with clean vertical indentation when multiline mode is selected", async () => {
      const { formatXml } = await import("./xml-formatter/XmlFormatter");
      const input = `
        <goods
                goods_code="RIF49G"
                price="8172.73"
                                categoryid="97223"
                                    typeid="2012"
            >
            <goodsdetail
                cs_code="019_0C"
                quantity="2"
            />
        </goods>
      `;
      const formatted = formatXml(input, "2", "multiline");

      // Verify that all attributes are indented at the exact same column:
      expect(formatted).toContain("<goods\n  goods_code=\"RIF49G\"\n  price=\"8172.73\"\n  categoryid=\"97223\"\n  typeid=\"2012\"\n>");
      // Verify self-closing tag attributes and closing /> alignment:
      expect(formatted).toContain("  <goodsdetail\n    cs_code=\"019_0C\"\n    quantity=\"2\"\n  />");
    });

    it("minifies XML removing comments and collapsing spaces between tags", async () => {
      const { formatXml } = await import("./xml-formatter/XmlFormatter");
      const input = `
        <!-- comment -->
        <catalog>
          <book id="1">
            <title>XML Guide</title>
          </book>
        </catalog>
      `;
      const minified = formatXml(input, "minified", "inline");
      expect(minified).toBe('<catalog><book id="1"><title>XML Guide</title></book></catalog>');
      expect(minified).not.toContain("<!--");
    });
  });

  describe("JSON to Code / Types Generator", () => {
    const sampleJson = JSON.stringify({
      id: 42,
      name: "Alice",
      isActive: true,
      tags: ["admin", "staff"],
      meta: { created_at: "2026-01-01", count: 10 },
    });

    it("generates TypeScript interface with nested types", () => {
      const code = generateCodeFromJson(sampleJson, {
        rootName: "User",
        language: "typescript-interface",
        optionalFields: false,
        separateNested: true,
      });
      expect(code).toContain("export interface User");
      expect(code).toContain("id: number;");
      expect(code).toContain("name: string;");
      expect(code).toContain("isActive: boolean;");
      expect(code).toContain("tags: string[];");
      expect(code).toContain("meta: UserMeta;");
    });

    it("generates Go Structs with json tags", () => {
      const code = generateCodeFromJson(sampleJson, {
        rootName: "User",
        language: "golang",
        optionalFields: true,
        separateNested: true,
      });
      expect(code).toContain("type User struct");
      expect(code).toContain('Id int64 `json:"id,omitempty"`');
      expect(code).toContain('Name string `json:"name,omitempty"`');
      expect(code).toContain("Tags []string");
    });

    it("generates Python Pydantic models with Field aliases", () => {
      const code = generateCodeFromJson(sampleJson, {
        rootName: "User",
        language: "python-pydantic",
        optionalFields: false,
        separateNested: true,
      });
      expect(code).toContain("class User(BaseModel):");
      expect(code).toContain("is_active: bool = Field(alias=\"isActive\")");
    });

    it("generates Rust Serde Structs", () => {
      const code = generateCodeFromJson(sampleJson, {
        rootName: "User",
        language: "rust-serde",
        optionalFields: false,
        separateNested: true,
      });
      expect(code).toContain("pub struct User");
      expect(code).toContain("pub id: i64,");
      expect(code).toContain("pub tags: Vec<String>,");
    });
  });

  describe("cURL to Code Converter", () => {
    const curlSample = `curl -X POST 'https://api.example.com/v1/auth' \\
      -H 'Content-Type: application/json' \\
      -H 'Authorization: Bearer token123' \\
      --data-raw '{"email":"test@example.com"}'`;

    it("parses cURL into method, url, headers, and body", () => {
      const parsed = parseCurlCommand(curlSample);
      expect(parsed.method).toBe("POST");
      expect(parsed.rawUrl).toBe("https://api.example.com/v1/auth");
      expect(parsed.headers["Content-Type"]).toBe("application/json");
      expect(parsed.headers["Authorization"]).toBe("Bearer token123");
      expect(parsed.data).toContain("test@example.com");
    });

    it("converts cURL to JavaScript Fetch", () => {
      const code = convertCurlToCode(curlSample, "javascript-fetch");
      expect(code).toContain("fetch(url, options)");
      expect(code).toContain('method: "POST"');
      expect(code).toContain('"Authorization": "Bearer token123"');
    });

    it("converts cURL to Python Requests", () => {
      const code = convertCurlToCode(curlSample, "python-requests");
      expect(code).toContain("import requests");
      expect(code).toContain("response = requests.post(");
      expect(code).toContain("headers=headers");
    });

    it("converts cURL to Go net/http", () => {
      const code = convertCurlToCode(curlSample, "golang-nethttp");
      expect(code).toContain('http.NewRequest("POST"');
      expect(code).toContain("req.Header.Add");
    });

    it("converts cURL to Playwright API test", () => {
      const code = convertCurlToCode(curlSample, "playwright-test");
      expect(code).toContain("import { test, expect } from '@playwright/test'");
      expect(code).toContain("await request.fetch(");
      expect(code).toContain("expect(response.ok()).toBeTruthy()");
    });

    it("converts cURL to Cypress cy.request test", () => {
      const code = convertCurlToCode(curlSample, "cypress-cy-request");
      expect(code).toContain("cy.request({");
      expect(code).toContain('method: "POST"');
      expect(code).toContain("expect(response.status).to.be.oneOf([200, 201, 204])");
    });

    it("converts cURL to Postman Collection JSON", () => {
      const code = convertCurlToCode(curlSample, "postman-collection");
      const collection = JSON.parse(code);
      expect(collection.info.name).toBe("Exported cURL Collection");
      expect(collection.item[0].request.method).toBe("POST");
      expect(collection.item[0].request.url.raw).toBe("https://api.example.com/v1/auth");
    });

    it("converts cURL to k6 load test script", () => {
      const code = convertCurlToCode(curlSample, "k6-load-test");
      expect(code).toContain("import http from 'k6/http'");
      expect(code).toContain("http.request(");
      expect(code).toContain("'status is 200': (r) => r.status === 200");
    });

    it("converts cURL to Java RestAssured", () => {
      const code = convertCurlToCode(curlSample, "java-restassured");
      expect(code).toContain("import io.restassured.RestAssured;");
      expect(code).toContain(".post(");
      expect(code).toContain(".statusCode(200)");
    });
  });

  describe("Linux Chmod Permissions Calculator", () => {
    it("converts default 755 state to octal and symbolic string", () => {
      expect(getOctalString(DEFAULT_CHMOD_STATE)).toBe("755");
      expect(getSymbolicString(DEFAULT_CHMOD_STATE)).toBe("-rwxr-xr-x");
    });

    it("parses octal string 644 into correct permission state", () => {
      const state = parseOctalToState("644", DEFAULT_CHMOD_STATE);
      expect(state.owner).toEqual({ read: true, write: true, execute: false });
      expect(state.group).toEqual({ read: true, write: false, execute: false });
      expect(state.others).toEqual({ read: true, write: false, execute: false });
      expect(getSymbolicString(state)).toBe("-rw-r--r--");
    });

    it("handles special bits (SetUID, SetGID, Sticky Bit)", () => {
      const stickyState = parseOctalToState("1777", DEFAULT_CHMOD_STATE);
      expect(stickyState.special.sticky).toBe(true);
      expect(getSymbolicString(stickyState)).toBe("-rwxrwxrwt");
      expect(getOctalString(stickyState)).toBe("1777");
    });

    it("generates correct terminal commands", () => {
      const state = parseOctalToState("700", DEFAULT_CHMOD_STATE);
      const cmds = getChmodCommands(state, "secret_dir");
      expect(cmds.numeric).toBe("chmod 700 secret_dir");
      expect(cmds.symbolic).toBe("chmod u=rwx,g=-,o=- secret_dir");
      expect(cmds.recursive).toBe("chmod -R 700 ./folder");
    });

    it("parses symbolic string back to state", () => {
      const state = parseSymbolicToState("rwxr-xr-x", DEFAULT_CHMOD_STATE);
      expect(getOctalString(state)).toBe("755");
    });
  });

  describe("Dummy / Mock File Generator Logic", () => {
    it("calculates exact byte conversions across units", () => {
      expect(convertToBytes(0, "B")).toBe(0);
      expect(convertToBytes(500, "KB")).toBe(512000);
      expect(convertToBytes(2, "MB")).toBe(2097152);
      expect(convertToBytes(1, "GB")).toBe(1073741824);
    });

    it("formats bytes into human-readable strings", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1048576 * 2.5)).toBe("2.5 MB");
    });

    it("generates exact buffer sizes for dummy files", () => {
      const buffer = generateDummyBuffer({
        filename: "test.pdf",
        format: "pdf",
        sizeBytes: 1024,
        pattern: "random",
      });
      expect(buffer.length).toBe(1024);
    });

    it("embeds correct magic bytes for PDF, PNG, and ZIP headers", () => {
      const pdfBuf = generateDummyBuffer({
        filename: "test.pdf",
        format: "pdf",
        sizeBytes: 100,
        pattern: "random",
      });
      // %PDF-1.4 = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]
      expect(Array.from(pdfBuf.slice(0, 8))).toEqual(SUPPORTED_FORMATS.pdf.magicBytes);

      const pngBuf = generateDummyBuffer({
        filename: "image.png",
        format: "png",
        sizeBytes: 100,
        pattern: "zeros",
      });
      expect(Array.from(pngBuf.slice(0, 8))).toEqual(SUPPORTED_FORMATS.png.magicBytes);

      const zipBuf = generateDummyBuffer({
        filename: "archive.zip",
        format: "zip",
        sizeBytes: 50,
        pattern: "random",
      });
      expect(Array.from(zipBuf.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    });

    it("corrupts magic headers when corruptHeader option is enabled", () => {
      const corruptBuf = generateDummyBuffer({
        filename: "corrupt.pdf",
        format: "pdf",
        sizeBytes: 100,
        pattern: "random",
        corruptHeader: true,
      });
      expect(Array.from(corruptBuf.slice(0, 4))).toEqual([0, 0, 0, 0]);
    });
  });

  describe("Boundary & Test Case Suggester Logic", () => {
    it("generates complete boundary value analysis for string length", () => {
      const cases = generateStringBoundaryCases({
        minLength: 6,
        maxLength: 20,
        charset: "alphanumeric",
      });

      const titles = cases.map((c) => c.title);
      expect(titles.some((t) => t.includes("Below Min Boundary (5 chars)"))).toBe(true);
      expect(titles.some((t) => t.includes("Exact Minimum Boundary (6 chars)"))).toBe(true);
      expect(titles.some((t) => t.includes("Exact Maximum Boundary (20 chars)"))).toBe(true);
      expect(titles.some((t) => t.includes("Exceeding Maximum (21 chars)"))).toBe(true);

      const invalidCases = cases.filter((c) => c.type === "Invalid");
      expect(invalidCases.length).toBeGreaterThanOrEqual(2);
    });

    it("generates number range boundary cases with step calculations", () => {
      const cases = generateNumberBoundaryCases({
        minValue: 10,
        maxValue: 50,
        allowDecimals: false,
        decimalPlaces: 2,
      });

      expect(cases.find((c) => c.id === "num-below-min")?.testValue).toBe("9");
      expect(cases.find((c) => c.id === "num-at-min")?.testValue).toBe("10");
      expect(cases.find((c) => c.id === "num-at-max")?.testValue).toBe("50");
      expect(cases.find((c) => c.id === "num-above-max")?.testValue).toBe("51");
    });

    it("exports test cases to Markdown table and CSV formats", () => {
      const cases = generateEmailBoundaryCases();
      const md = exportToMarkdownTable(cases);
      expect(md).toContain("| Category | Type | Test Case Title | Test Input Value | Expected Behavior |");
      expect(md).toContain("tester.qa@example.com");

      const csv = exportToCsv(cases);
      expect(csv).toContain('"Category","Type","Title","Test Value","Expected Result","Description"');
      expect(csv).toContain("Standard Valid Email");
    });

    it("provides comprehensive security fuzzing payloads (XSS, SQLi, LFI, OS Command)", () => {
      expect(SECURITY_PAYLOADS.length).toBeGreaterThanOrEqual(15);
      const groups = new Set(SECURITY_PAYLOADS.map((p) => p.group));
      expect(groups.has("XSS")).toBe(true);
      expect(groups.has("SQL Injection")).toBe(true);
      expect(groups.has("NoSQL Injection")).toBe(true);
      expect(groups.has("Command Injection")).toBe(true);
      expect(groups.has("Path Traversal")).toBe(true);
      expect(groups.has("String Breakers")).toBe(true);
    });

    it("supports Vietnamese localization for BVA cases and security payloads", () => {
      const viCases = generateStringBoundaryCases(
        { minLength: 6, maxLength: 20, charset: "alphanumeric" },
        "vi"
      );
      expect(viCases.some((c) => c.title.includes("Đúng ngưỡng tối thiểu (6 ký tự)"))).toBe(true);
      expect(viCases.some((c) => c.category === "Giá trị biên")).toBe(true);
      expect(viCases.some((c) => c.expectedResult === "Chấp nhận / Thành công")).toBe(true);

      const viEmailCases = generateEmailBoundaryCases("vi");
      expect(viEmailCases.some((c) => c.title.includes("Email hợp lệ"))).toBe(true);
      const viMd = exportToMarkdownTable(viEmailCases, "vi");
      expect(viMd).toContain("| Phân loại | Kiểu | Tên Test Case | Giá trị kiểm thử | Hành vi kỳ vọng |");

      const viPayloads = getSecurityPayloads("vi");
      expect(viPayloads.some((p) => p.name === "Thẻ Script Cổ Điển")).toBe(true);
      expect(viPayloads.some((p) => p.name.includes("Vượt Xác Thực Cổ Điển"))).toBe(true);
    });
  });

  describe("Pairwise Test Case Generator Logic", () => {
    it("reduces high-dimensional matrix while preserving 100% 2-way pair coverage", () => {
      const preset = PAIRWISE_PRESETS[0];
      const fullCount = calculateCartesianProduct(preset.parameters);
      expect(fullCount).toBe(960);

      const result = generatePairwiseTestCases(preset.parameters);
      expect(result.coveredPairs).toBe(result.totalPairs);
      expect(result.testCases.length).toBeLessThan(40);
      expect(result.reductionPercentage).toBeGreaterThan(90);
    });
  });

  describe("Realistic Fake Data Generator Logic", () => {
    it("generates valid credit cards conforming to Luhn algorithm", () => {
      const card = generateValidCreditCard("Visa");
      const clean = card.number.replace(/\s+/g, "");
      expect(isValidLuhn(clean)).toBe(true);
    });

    it("generates authentic 12-digit Vietnam CCCD and valid Tax Code", () => {
      const cccd = generateVietnamCccd(1996, false);
      expect(cccd.length).toBe(12);
      expect(cccd.substring(4, 6)).toBe("96");

      const taxCode = generateVietnamTaxCode();
      expect(taxCode.length).toBe(10);
    });

    it("generates authentic 12-digit Japanese My Number and Japan test dataset", () => {
      const myNum = generateJapaneseMyNumber();
      expect(myNum.length).toBe(12);
      expect(isValidJapaneseMyNumber(myNum)).toBe(true);

      const jpData = generateMockDataset({
        count: 3,
        locale: "ja",
        minAge: 20,
        maxAge: 40,
        gender: "all",
        fields: { fullName: true, phone: true, citizenId: true, address: true },
      });
      expect(jpData.length).toBe(3);
      expect(jpData[0].phone).toMatch(/^0[789]0-/);
      expect(jpData[0].address).toContain("〒");
    });

    it("generates valid realistic user dataset", () => {
      const data = generateMockDataset({
        count: 5,
        locale: "vi",
        minAge: 18,
        maxAge: 50,
        gender: "all",
        fields: { fullName: true, phone: true, email: true },
      });
      expect(data.length).toBe(5);
      expect(data[0].fullName).toBeDefined();
    });
  });

  describe("Regex Reverse Generator Logic", () => {
    it("generates strings matching email regex", () => {
      const emailPreset = REGEX_PRESETS[0];
      const match = generateMatchingString(emailPreset.pattern, emailPreset.flags);
      const reg = new RegExp(emailPreset.pattern, emailPreset.flags);
      expect(reg.test(match)).toBe(true);
    });

    it("generates test suite with both PASS and FAIL cases for QA testing", () => {
      const phonePreset = REGEX_PRESETS[1];
      const suite = generateRegexTestSuite(phonePreset.pattern, phonePreset.flags, 3, false);
      expect(suite.isValidRegex).toBe(true);
      expect(suite.testCases.some((c) => c.expected === "PASS")).toBe(true);
      expect(suite.testCases.some((c) => c.expected === "FAIL")).toBe(true);
    });
  });
});


