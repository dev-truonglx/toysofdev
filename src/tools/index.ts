import {
  FileCode,
  FileCode2,
  Binary,
  Wrench,
  Globe,
  Hash,
  Fingerprint,
  KeyRound,
  Clock,
  CalendarClock,
  Table,
  Image as ImageIcon,
  Code2,
  FileArchive,
  QrCode,
  Database,
  AlignLeft,
  Sparkles,
  CaseSensitive,
  GitCompare,
  FileText,
  Quote,
  ListFilter,
  Regex,
  Palette,
  Eye,
  CheckCheck,
  SearchCode,
  FolderSync,
  Lock,
  Layers,
  Users,
  Wand2,
} from "lucide-react";
import { CategoryDefinition, ToolDefinition } from "./types";
import { Language, getTranslation } from "../i18n";

// Existing 6 tools
import { JsonFormatter } from "./json-formatter/JsonFormatter";
import { Base64Converter } from "./base64-converter/Base64Converter";
import { UrlEncoder } from "./url-encoder/UrlEncoder";
import { HashGenerator } from "./hash-generator/HashGenerator";
import { UuidGenerator } from "./uuid-generator/UuidGenerator";
import { JwtDecoder } from "./jwt-decoder/JwtDecoder";

// Converters (Batch B)
import { JsonYamlConverter } from "./json-yaml/JsonYamlConverter";
import { TimestampConverter } from "./timestamp-converter/TimestampConverter";
import { NumberBaseConverter } from "./number-base/NumberBaseConverter";
import { CronParser } from "./cron-parser/CronParser";
import { JsonCsvConverter } from "./json-csv/JsonCsvConverter";

// Encoders / Formatters (Batch C)
import { Base64ImageConverter } from "./base64-image/Base64ImageConverter";
import { HtmlEncoder } from "./html-encoder/HtmlEncoder";
import { GzipConverter } from "./gzip-converter/GzipConverter";
import { QrGenerator } from "./qr-generator/QrGenerator";
import { SqlFormatter } from "./sql-formatter/SqlFormatter";
import { XmlFormatter } from "./xml-formatter/XmlFormatter";

// Generators / Text (Batch D)
import { LoremIpsumGenerator } from "./lorem-ipsum/LoremIpsumGenerator";
import { PasswordGenerator } from "./password-generator/PasswordGenerator";
import { TokenGenerator } from "./token-generator/TokenGenerator";
import { TextInspector } from "./text-inspector/TextInspector";
import { TextDiffComparer } from "./text-diff/TextDiffComparer";
import { FileFolderDiffComparer } from "./file-folder-diff/FileFolderDiffComparer";
import { MarkdownPreview } from "./markdown-preview/MarkdownPreview";
import { StringEscape } from "./string-escape/StringEscape";
import { ListComparer } from "./list-comparer/ListComparer";
import { LogGrep } from "./log-grep/LogGrep";

// Graphic & Testing (Batch E)
import { RegexTester } from "./regex-tester/RegexTester";
import { ColorPickerTool } from "./color-picker/ColorPickerTool";
import { ColorBlindnessSimulator } from "./color-blindness/ColorBlindnessSimulator";
import { XmlValidator } from "./xml-validator/XmlValidator";
import { JsonPathTester } from "./jsonpath-tester/JsonPathTester";

import { JsonToCodeConverter } from "./json-to-code/JsonToCodeConverter";
import { CurlConverter } from "./curl-converter/CurlConverter";
import { ChmodCalculator } from "./chmod-calculator/ChmodCalculator";
import { DummyFileGenerator } from "./dummy-file-generator/DummyFileGenerator";
import { BoundaryTester } from "./boundary-tester/BoundaryTester";

// New QA & Dev Daily Tools
import { PairwiseTester } from "./pairwise-tester/PairwiseTester";
import { FakeDataGenerator } from "./fake-data-generator/FakeDataGenerator";
import { RegexReverseGenerator } from "./regex-reverse-generator/RegexReverseGenerator";

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: "converters",
    title: "Converters",
    description: "Convert data formats, timestamps, number bases and schedules",
    icon: FileCode2,
  },
  {
    id: "encoders-decoders",
    title: "Encoders / Decoders",
    description: "Transform data across common text, binary and compression encodings",
    icon: Binary,
  },
  {
    id: "formatters",
    title: "Formatters",
    description: "Format, beautify and minify code, query and markup structures",
    icon: FileCode,
  },
  {
    id: "generators",
    title: "Generators",
    description: "Generate identifiers, secrets, checksums, tokens and placeholder text",
    icon: Wrench,
  },
  {
    id: "text",
    title: "Text Utilities",
    description: "Analyze, compare, preview and transform text and strings",
    icon: CaseSensitive,
  },
  {
    id: "graphic",
    title: "Graphic & Testing",
    description: "Accessibility, color contrast, vision deficiency, and regex testing",
    icon: Palette,
  },
];

export const TOOLS: ToolDefinition[] = [
  // 1. Converters (5)
  {
    id: "json-yaml-converter",
    title: "JSON ↔ YAML Converter",
    description: "Convert JSON data to YAML, or YAML data to JSON",
    category: "converters",
    icon: FileCode2,
    keywords: ["json", "yaml", "yml", "convert", "transform"],
    component: JsonYamlConverter,
  },
  {
    id: "timestamp-converter",
    title: "Timestamp / Date Converter",
    description: "Convert Epoch Unix timestamp to human-readable date & time and vice-versa",
    category: "converters",
    icon: Clock,
    keywords: ["timestamp", "epoch", "date", "time", "unix", "seconds", "milliseconds"],
    component: TimestampConverter,
  },
  {
    id: "number-base-converter",
    title: "Number Base Converter",
    description: "Convert numbers in real-time between Decimal, Hexadecimal, Binary, and Octal bases",
    category: "converters",
    icon: Binary,
    keywords: ["number", "base", "decimal", "hex", "hexadecimal", "binary", "octal", "radix"],
    component: NumberBaseConverter,
  },
  {
    id: "cron-parser",
    title: "Cron Expression Parser",
    description: "Parse, explain and calculate upcoming execution dates for cron schedules",
    category: "converters",
    icon: CalendarClock,
    keywords: ["cron", "schedule", "crontab", "timing", "job", "parser", "next"],
    component: CronParser,
  },
  {
    id: "json-to-csv",
    title: "JSON to Table / CSV Converter",
    description: "Convert JSON array of objects to tabular Delimited/CSV format",
    category: "converters",
    icon: Table,
    keywords: ["json", "csv", "table", "tsv", "excel", "export", "flatten"],
    component: JsonCsvConverter,
  },
  {
    id: "json-to-code",
    title: "JSON to Code / Types Converter",
    description: "Generate TypeScript, Go Structs, Python Pydantic, Rust Serde, Java and C# models directly from JSON",
    category: "converters",
    icon: Code2,
    keywords: ["json", "typescript", "golang", "go", "python", "pydantic", "rust", "serde", "java", "csharp", "c#", "types", "interface", "struct", "model"],
    component: JsonToCodeConverter,
  },
  {
    id: "curl-converter",
    title: "cURL to Automation & Code Converter",
    description: "Convert cURL commands into Playwright, Cypress, Postman, k6, RestAssured, Fetch, Axios, and Python scripts",
    category: "converters",
    icon: Globe,
    keywords: [
      "curl",
      "bash",
      "playwright",
      "cypress",
      "postman",
      "k6",
      "restassured",
      "fetch",
      "axios",
      "python",
      "requests",
      "go",
      "rust",
      "php",
      "http",
      "api",
      "request",
      "automation",
      "test",
    ],
    component: CurlConverter,
  },

  // 2. Encoders / Decoders (7)
  {
    id: "base64-converter",
    title: "Base64 Text Encoder / Decoder",
    description: "Encode and decode text data to and from Base64 format with full UTF-8 support",
    category: "encoders-decoders",
    icon: Binary,
    keywords: ["base64", "encode", "decode", "btoa", "atob", "utf8", "urlsafe"],
    component: Base64Converter,
  },
  {
    id: "base64-image-converter",
    title: "Base64 Image Converter",
    description: "Convert image files to Base64 Data URI strings or preview Base64 encoded images",
    category: "encoders-decoders",
    icon: ImageIcon,
    keywords: ["base64", "image", "png", "jpg", "svg", "datauri", "picture", "photo"],
    component: Base64ImageConverter,
  },
  {
    id: "url-encoder",
    title: "URL Encoder / Decoder",
    description: "Encode or decode characters according to RFC 3986",
    category: "encoders-decoders",
    icon: Globe,
    keywords: ["url", "uri", "encode", "decode", "percent", "escape", "unescape"],
    component: UrlEncoder,
  },
  {
    id: "html-encoder",
    title: "HTML Entity Encoder / Decoder",
    description: "Encode and decode HTML entities and special characters",
    category: "encoders-decoders",
    icon: Code2,
    keywords: ["html", "entity", "escape", "unescape", "special", "characters", "&amp;"],
    component: HtmlEncoder,
  },
  {
    id: "jwt-decoder",
    title: "JWT Decoder",
    description: "Decode and inspect Header, Payload claims and expiration timestamps",
    category: "encoders-decoders",
    icon: KeyRound,
    keywords: ["jwt", "token", "json web token", "decode", "payload", "claims", "expire"],
    component: JwtDecoder,
  },
  {
    id: "gzip-converter",
    title: "GZip Compressor / Decompressor",
    description: "Compress plain text into Base64 GZip payloads or decompress GZip data",
    category: "encoders-decoders",
    icon: FileArchive,
    keywords: ["gzip", "compress", "decompress", "archive", "tar", "deflate"],
    component: GzipConverter,
  },
  {
    id: "qr-generator",
    title: "QR Code Generator",
    description: "Generate customizable QR codes from text, URLs, or contact information",
    category: "encoders-decoders",
    icon: QrCode,
    keywords: ["qr", "qrcode", "barcode", "matrix", "scanner", "generator", "link"],
    component: QrGenerator,
  },

  // 3. Formatters (3)
  {
    id: "json-formatter",
    title: "JSON Formatter & Minifier",
    description: "Indent, prettify or minify JSON data, with optional key sorting",
    category: "formatters",
    icon: FileCode,
    keywords: ["json", "format", "minify", "beautify", "indent", "prettify", "sort"],
    component: JsonFormatter,
  },
  {
    id: "sql-formatter",
    title: "SQL Formatter & Beautifier",
    description: "Format and beautify standard SQL queries with uppercase keywords and clause indentation",
    category: "formatters",
    icon: Database,
    keywords: ["sql", "query", "database", "format", "beautify", "select", "indent"],
    component: SqlFormatter,
  },
  {
    id: "xml-formatter",
    title: "XML Formatter & Minifier",
    description: "Format, indent, or minify XML / SVG text with syntax validation",
    category: "formatters",
    icon: FileCode,
    keywords: ["xml", "svg", "html", "format", "indent", "beautify", "minify"],
    component: XmlFormatter,
  },

  // 4. Generators (5)
  {
    id: "hash-generator",
    title: "Hash Generator",
    description: "Calculate MD5, SHA-1, SHA-256, and SHA-512 hashes",
    category: "generators",
    icon: Hash,
    keywords: ["hash", "md5", "sha1", "sha256", "sha512", "checksum", "digest", "crypto"],
    component: HashGenerator,
  },
  {
    id: "uuid-generator",
    title: "UUID / GUID Generator",
    description: "Generate cryptographically strong Universally Unique Identifiers (v4)",
    category: "generators",
    icon: Fingerprint,
    keywords: ["uuid", "guid", "random", "v4", "identifier", "generate"],
    component: UuidGenerator,
  },
  {
    id: "lorem-ipsum-generator",
    title: "Lorem Ipsum Generator",
    description: "Create placeholder text by paragraphs, sentences, or words",
    category: "generators",
    icon: AlignLeft,
    keywords: ["lorem", "ipsum", "dummy", "placeholder", "text", "generator"],
    component: LoremIpsumGenerator,
  },
  {
    id: "password-generator",
    title: "Password & Passphrase Generator",
    description: "Generate cryptographically secure random passwords or memorable passphrases",
    category: "generators",
    icon: KeyRound,
    keywords: ["password", "passphrase", "secret", "security", "entropy", "generator"],
    component: PasswordGenerator,
  },
  {
    id: "token-generator",
    title: "NanoID / Random Token Generator",
    description: "Generate secure random URL-safe NanoIDs and customizable tokens",
    category: "generators",
    icon: Sparkles,
    keywords: ["token", "nanoid", "random", "secret", "key", "alphanumeric"],
    component: TokenGenerator,
  },
  {
    id: "chmod-calculator",
    title: "Chmod / Linux Permissions Calculator",
    description: "Interactive calculator for Linux file permissions with octal numbers, symbolic strings, presets, and terminal commands",
    category: "generators",
    icon: Lock,
    keywords: ["chmod", "linux", "permissions", "unix", "octal", "rwx", "755", "644", "777", "file", "security", "chown"],
    component: ChmodCalculator,
  },
  {
    id: "dummy-file-generator",
    title: "Dummy / Mock File Generator",
    description: "Generate mock files with exact byte sizes, valid magic headers, or corrupted signatures for upload testing",
    category: "generators",
    icon: FileArchive,
    keywords: [
      "dummy",
      "mock",
      "file",
      "generator",
      "upload",
      "size",
      "bytes",
      "corrupt",
      "pdf",
      "png",
      "zip",
      "tester",
      "qa",
      "tạo file",
    ],
    component: DummyFileGenerator,
  },
  {
    id: "fake-data-generator",
    title: "Realistic Mock & Fake Data Generator",
    description: "Generate authentic test profiles with valid Luhn credit cards, Vietnam CCCD, Tax IDs, local phone numbers, emails, addresses, and bank accounts",
    category: "generators",
    icon: Users,
    keywords: [
      "fake",
      "mock",
      "data",
      "faker",
      "generator",
      "cccd",
      "tax",
      "credit card",
      "luhn",
      "phone",
      "email",
      "vietnam",
      "profile",
      "user",
      "tester",
      "dữ liệu giả",
    ],
    component: FakeDataGenerator,
  },

  // 5. Text Utilities (5)
  {
    id: "text-case-converter",
    title: "Text Case Converter & Inspector",
    description: "Analyze text statistics and convert strings between camelCase, snake_case, PascalCase, and more",
    category: "text",
    icon: CaseSensitive,
    keywords: ["case", "camelcase", "snakecase", "pascalcase", "words", "characters", "inspector"],
    component: TextInspector,
  },
  {
    id: "text-diff-comparer",
    title: "Text Diff / Comparer",
    description: "Compare two blocks of text and highlight line-by-line additions, deletions, and differences",
    category: "text",
    icon: GitCompare,
    keywords: ["diff", "compare", "difference", "changes", "merge", "text"],
    component: TextDiffComparer,
  },
  {
    id: "file-folder-diff",
    title: "File & Folder Diff",
    description: "So sánh nội dung giữa 2 tệp tin hoặc duyệt trực quan các thay đổi giữa 2 thư mục",
    category: "text",
    icon: FolderSync,
    keywords: ["file", "folder", "directory", "diff", "compare", "tree", "so sánh", "tệp", "thư mục"],
    component: FileFolderDiffComparer,
  },
  {
    id: "markdown-preview",
    title: "Markdown Live Preview",
    description: "Edit and render GitHub Flavored Markdown with real-time live preview",
    category: "text",
    icon: FileText,
    keywords: ["markdown", "md", "preview", "gfm", "render", "html"],
    component: MarkdownPreview,
  },
  {
    id: "string-escape",
    title: "String Escape / Unescape",
    description: "Escape or unescape special characters like quotes, tabs, and newlines for different programming languages",
    category: "text",
    icon: Quote,
    keywords: ["escape", "unescape", "quote", "slashes", "json", "csharp", "python", "sql"],
    component: StringEscape,
  },
  {
    id: "list-comparer",
    title: "List Comparer",
    description: "Compare two lists of text line-by-line to find intersection, difference, or union",
    category: "text",
    icon: ListFilter,
    keywords: ["list", "compare", "intersection", "difference", "union", "deduplicate"],
    component: ListComparer,
  },
  {
    id: "log-grep",
    title: "Log Grep & Filter",
    description: "Filter, grep and analyze log lines using literal text or regular expressions with context lines and preset patterns",
    category: "text",
    icon: ListFilter,
    keywords: ["grep", "log", "filter", "regex", "search", "trace", "error", "lines"],
    component: LogGrep,
  },

  // 6. Graphic & Testing (5)
  {
    id: "regex-tester",
    title: "Regular Expression (Regex) Tester",
    description: "Test, debug and validate regular expressions against text in real-time",
    category: "graphic",
    icon: Regex,
    keywords: ["regex", "regexp", "pattern", "tester", "match", "test", "expression"],
    component: RegexTester,
  },
  {
    id: "color-picker-contrast",
    title: "Color Picker & Contrast Checker",
    description: "Inspect color spaces (HEX, RGB, HSL) and verify WCAG 2.1 accessibility contrast compliance",
    category: "graphic",
    icon: Palette,
    keywords: ["color", "picker", "contrast", "wcag", "accessibility", "hex", "rgb", "hsl"],
    component: ColorPickerTool,
  },
  {
    id: "color-blindness-simulator",
    title: "Color Blindness Simulator",
    description: "Simulate how images and UI designs appear to individuals with different color vision deficiencies",
    category: "graphic",
    icon: Eye,
    keywords: ["color", "blindness", "simulator", "deuteranopia", "protanopia", "tritanopia", "vision"],
    component: ColorBlindnessSimulator,
  },
  {
    id: "xml-validator",
    title: "XML Validator",
    description: "Validate XML documents against syntax specifications and inspect structure",
    category: "graphic",
    icon: CheckCheck,
    keywords: ["xml", "validator", "schema", "syntax", "check", "wellformed"],
    component: XmlValidator,
  },
  {
    id: "jsonpath-tester",
    title: "JSONPath Tester",
    description: "Query, filter, and extract sub-trees from complex JSON data using JSONPath syntax",
    category: "graphic",
    icon: SearchCode,
    keywords: ["jsonpath", "query", "json", "filter", "xpath", "extract"],
    component: JsonPathTester,
  },
  {
    id: "boundary-tester",
    title: "Boundary & Test Case Suggester",
    description: "Generate Boundary Value Analysis (BVA), Equivalence Partitioning, and Security Fuzzing payloads for test design",
    category: "graphic",
    icon: CheckCheck,
    keywords: [
      "boundary",
      "bva",
      "equivalence",
      "partitioning",
      "testcase",
      "tester",
      "qa",
      "fuzzing",
      "xss",
      "sqli",
      "payload",
      "edgecase",
      "kiểm thử",
      "biên",
    ],
    component: BoundaryTester,
  },
  {
    id: "pairwise-tester",
    title: "Pairwise / All-Pairs Test Case Generator",
    description: "Generate an optimal combinatorial test suite covering 100% of 2-way interactions with the minimal number of test cases",
    category: "graphic",
    icon: Layers,
    keywords: [
      "pairwise",
      "allpairs",
      "orthogonal",
      "testcase",
      "combinatorial",
      "matrix",
      "tester",
      "qa",
      "istqb",
      "tổ hợp",
      "kiểm thử",
    ],
    component: PairwiseTester,
  },
  {
    id: "regex-reverse-generator",
    title: "Regex Reverse Test String Generator",
    description: "Reverse-engineer regular expressions to generate both matching happy path strings and negative boundary test cases",
    category: "graphic",
    icon: Wand2,
    keywords: [
      "regex",
      "reverse",
      "generator",
      "fuzzer",
      "negative",
      "boundary",
      "testcase",
      "tester",
      "qa",
      "dịch ngược regex",
      "chuỗi kiểm thử",
    ],
    component: RegexReverseGenerator,
  },
];

export function getLocalizedCategories(lang: Language = "en"): CategoryDefinition[] {
  const t = getTranslation(lang);
  return CATEGORIES.map((cat) => ({
    ...cat,
    title: t.categories[cat.id]?.title || cat.title,
    description: t.categories[cat.id]?.description || cat.description,
  }));
}

export function getLocalizedTools(lang: Language = "en"): ToolDefinition[] {
  const t = getTranslation(lang);
  return TOOLS.map((tool) => ({
    ...tool,
    title: t.tools[tool.id]?.title || tool.title,
    description: t.tools[tool.id]?.description || tool.description,
  }));
}

export function getToolById(id: string, lang: Language = "en"): ToolDefinition | undefined {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) return undefined;
  const t = getTranslation(lang);
  return {
    ...tool,
    title: t.tools[tool.id]?.title || tool.title,
    description: t.tools[tool.id]?.description || tool.description,
  };
}

export function getToolsByCategory(categoryId: string, lang: Language = "en"): ToolDefinition[] {
  const tools = getLocalizedTools(lang);
  return tools.filter((t) => t.category === categoryId);
}

export function searchTools(query: string, lang: Language = "en"): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  const tools = getLocalizedTools(lang);
  if (!q) return tools;
  return tools.filter(
    (tool) =>
      tool.title.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.keywords.some((kw) => kw.toLowerCase().includes(q)),
  );
}
