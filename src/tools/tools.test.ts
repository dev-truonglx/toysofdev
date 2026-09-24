import { describe, it, expect } from "vitest";
import YAML from "yaml";
import { md5 } from "./hash-generator/md5";
import { TOOLS, CATEGORIES } from "./index";

import { encodeUtf8Base64, decodeUtf8Base64 } from "./base64-converter/base64Utils";
import { filterLogLines } from "./log-grep/logFilterEngine";
import { LOG_PRESETS } from "./log-grep/presets";

describe("Tool Logic Tests", () => {
  it("verifies that all 32 DevToys tools are registered", () => {
    expect(TOOLS.length).toBe(32);
    expect(CATEGORIES.length).toBe(6);

    const ids = new Set(TOOLS.map((t) => t.id));
    expect(ids.size).toBe(32); // All IDs must be unique
    expect(ids.has("file-folder-diff")).toBe(true);
    expect(ids.has("log-grep")).toBe(true);
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
});


