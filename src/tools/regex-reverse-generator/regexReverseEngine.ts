/**
 * Regex Reverse Test String Generator Engine
 * 
 * Generates both Positive (Matching) and Negative (Mismatching / Boundary) test strings
 * from regular expression patterns for QA and Developer testing.
 */

export interface GeneratedTestCase {
  id: number;
  value: string;
  expected: "PASS" | "FAIL";
  category: "Happy Path" | "Boundary" | "Security" | "Format Error" | "Negative";
  reason: string;
  matched: boolean;
}

export interface RegexPreset {
  id: string;
  title: string;
  titleVi: string;
  pattern: string;
  flags: string;
  description: string;
  descriptionVi: string;
}

export const REGEX_PRESETS: RegexPreset[] = [
  {
    id: "email",
    title: "Email Address",
    titleVi: "Địa chỉ Email",
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    flags: "",
    description: "Standard RFC 5322 compatible email address validation",
    descriptionVi: "Định dạng email tiêu chuẩn có tên miền và phần mở rộng",
  },
  {
    id: "vn-phone",
    title: "Vietnam Mobile Phone",
    titleVi: "Số Điện Thoại Di Động Việt Nam",
    pattern: "^0(3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$",
    flags: "",
    description: "10-digit Vietnamese mobile phone number with valid telecom prefixes",
    descriptionVi: "Số điện thoại di động 10 số đúng đầu số Viettel, Vina, Mobi, VNMB",
  },
  {
    id: "strong-password",
    title: "Strong Password",
    titleVi: "Mật Khẩu Mạnh (Bảo Mật)",
    pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,32}$",
    flags: "",
    description: "Minimum 8 chars: at least 1 uppercase, 1 lowercase, 1 number, 1 special character",
    descriptionVi: "Tối thiểu 8 ký tự: gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt",
  },
  {
    id: "vn-cccd",
    title: "Vietnam Citizen ID (CCCD)",
    titleVi: "Căn Cước Công Dân (12 Chữ Số)",
    pattern: "^\\d{12}$",
    flags: "",
    description: "12-digit numeric national citizen identity card",
    descriptionVi: "12 chữ số Căn cước công dân gắn chip",
  },
  {
    id: "hex-color",
    title: "Hex Color Code",
    titleVi: "Mã Màu Hex (#RGB hoặc #RRGGBB)",
    pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
    flags: "",
    description: "3 or 6 hex digits preceded by a hash symbol",
    descriptionVi: "Mã màu Hex 3 hoặc 6 ký tự bắt đầu bằng dấu #",
  },
  {
    id: "ipv4",
    title: "IPv4 Address",
    titleVi: "Địa Chỉ IPv4",
    pattern: "^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
    flags: "",
    description: "Standard dotted-decimal IPv4 address (0.0.0.0 to 255.255.255.255)",
    descriptionVi: "Địa chỉ IPv4 chuẩn 4 octet từ 0.0.0.0 đến 255.255.255.255",
  },
  {
    id: "date-iso",
    title: "ISO Date (YYYY-MM-DD)",
    titleVi: "Ngày Định Dạng YYYY-MM-DD",
    pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
    flags: "",
    description: "Standard ISO 8601 calendar date with valid months and days",
    descriptionVi: "Định dạng ngày ISO 8601 có kiểm tra tháng (01-12) và ngày (01-31)",
  },
  {
    id: "slug",
    title: "URL Slug / Kebab-case",
    titleVi: "Đường Dẫn URL Thân Thiện (Slug)",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    flags: "",
    description: "Lowercase letters and numbers separated by single hyphens",
    descriptionVi: "Ký tự thường và số nối nhau bằng dấu gạch ngang",
  },
  {
    id: "username",
    title: "Alphanumeric Username",
    titleVi: "Tên Đăng Nhập (Username)",
    pattern: "^[a-zA-Z0-9_]{3,16}$",
    flags: "",
    description: "3 to 16 characters containing letters, numbers and underscores",
    descriptionVi: "Từ 3 đến 16 ký tự gồm chữ cái, chữ số và dấu gạch dưới",
  },
  {
    id: "uuid-v4",
    title: "UUID v4 Identifier",
    titleVi: "Mã Định Danh UUID v4",
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    flags: "i",
    description: "Standard RFC 4122 Version 4 UUID format",
    descriptionVi: "Chuẩn định danh Universally Unique Identifier Version 4",
  },
];

// Helper: Pick random element (supports arrays and strings)
function pick<T>(arr: T[] | string): any {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper: Random integer
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a character from common character classes
 */
function sampleCharFromClass(charset: string): string {
  if (charset === "\\d" || charset === "[0-9]") return randInt(0, 9).toString();
  if (charset === "\\w") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
    return pick(chars);
  }
  if (charset === "\\s") return " ";
  if (charset === "[a-z]") {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    return pick(chars);
  }
  if (charset === "[A-Z]") {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return pick(chars);
  }
  if (charset === "[a-zA-Z]") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return pick(chars);
  }
  if (charset === "[a-zA-Z0-9]") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return pick(chars);
  }
  return "a";
}

/**
 * Robust lightweight generator for standard regex constructs
 */
export function generateMatchingString(rawPattern: string, _flags: string = ""): string {
  // Strip enclosing slashes and start/end anchors for generation
  let p = rawPattern.trim();
  if (p.startsWith("/") && p.lastIndexOf("/") > 0) {
    p = p.substring(1, p.lastIndexOf("/"));
  }
  if (p.startsWith("^")) p = p.substring(1);
  if (p.endsWith("$")) p = p.substring(0, p.length - 1);

  // Check if pattern contains lookaheads for strong passwords: ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$
  if (p.includes("(?=")) {
    const specials = "@$!%*?&_#";
    const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowers = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";

    const base = [
      pick(uppers),
      pick(lowers),
      pick(digits),
      pick(specials),
    ];

    while (base.length < 12) {
      base.push(pick(uppers + lowers + digits + specials));
    }

    // Shuffle
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }

    return base.join("");
  }

  // Handle specific known patterns directly for 100% fidelity
  if (rawPattern.includes("@") && rawPattern.includes("\\.")) {
    // Email pattern (always use RFC 2606 reserved example.com for safe mock testing)
    const user = pick(["alex", "test.user", "developer99", "qa.automation", "john_doe"]);
    const domain = "example.com";
    return `${user}@${domain}`;
  }

  if (rawPattern.includes("0(3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])") || rawPattern.includes("^0[3|5|7|8|9]")) {
    // VN Phone
    const prefix = pick(["098", "090", "091", "086", "070", "038", "058"]);
    return `${prefix}${randInt(1000000, 9999999)}`;
  }

  if (rawPattern.includes("\\d{12}") || rawPattern.includes("[0-9]{12}")) {
    // CCCD 12 digits
    return `079295${randInt(100000, 999999)}`;
  }

  if (rawPattern.includes("#") && rawPattern.includes("A-Fa-f0-9")) {
    // Hex Color
    const hex = Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0");
    return `#${hex}`;
  }

  if (rawPattern.includes("25[0-5]") && rawPattern.includes("\\.")) {
    // IPv4
    return `${randInt(10, 220)}.${randInt(1, 254)}.${randInt(1, 254)}.${randInt(1, 254)}`;
  }

  if (rawPattern.includes("\\d{4}-") || rawPattern.includes("YYYY-MM-DD")) {
    // ISO Date
    const y = randInt(2020, 2030);
    const m = String(randInt(1, 12)).padStart(2, "0");
    const d = String(randInt(1, 28)).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (rawPattern.includes("[0-9a-f]{8}-[0-9a-f]{4}-4")) {
    // UUID v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Generic Token Expansion
  let result = "";
  let i = 0;

  while (i < p.length) {
    const ch = p[i];

    // Character Class [...]
    if (ch === "[") {
      const closeIdx = p.indexOf("]", i);
      if (closeIdx !== -1) {
        const classContent = p.substring(i, closeIdx + 1);
        i = closeIdx + 1;

        // Check for quantifier after ]
        let count = 1;
        if (i < p.length) {
          if (p[i] === "+") {
            count = randInt(2, 6);
            i++;
          } else if (p[i] === "*") {
            count = randInt(1, 5);
            i++;
          } else if (p[i] === "?") {
            count = Math.random() > 0.3 ? 1 : 0;
            i++;
          } else if (p[i] === "{") {
            const endBrace = p.indexOf("}", i);
            if (endBrace !== -1) {
              const bounds = p.substring(i + 1, endBrace).split(",");
              const minB = parseInt(bounds[0], 10) || 1;
              const maxB = bounds.length > 1 ? parseInt(bounds[1], 10) || minB + 3 : minB;
              count = randInt(minB, maxB);
              i = endBrace + 1;
            }
          }
        }

        for (let c = 0; c < count; c++) {
          if (classContent.includes("a-z") && classContent.includes("A-Z") && classContent.includes("0-9")) {
            result += sampleCharFromClass("[a-zA-Z0-9]");
          } else if (classContent.includes("a-z") && classContent.includes("A-Z")) {
            result += sampleCharFromClass("[a-zA-Z]");
          } else if (classContent.includes("a-z") && classContent.includes("0-9")) {
            result += pick("abcdefghijklmnopqrstuvwxyz0123456789");
          } else if (classContent.includes("a-z")) {
            result += sampleCharFromClass("[a-z]");
          } else if (classContent.includes("A-Z")) {
            result += sampleCharFromClass("[A-Z]");
          } else if (classContent.includes("0-9") || classContent.includes("\\d")) {
            result += sampleCharFromClass("[0-9]");
          } else {
            // Strip brackets
            const chars = classContent.replace(/[[\]]/g, "");
            result += pick(chars);
          }
        }
        continue;
      }
    }

    // Escaped sequences \d, \w, \s, \., etc.
    if (ch === "\\") {
      const nextChar = p[i + 1];
      i += 2;
      let generatedChar = nextChar;
      if (nextChar === "d") generatedChar = sampleCharFromClass("\\d");
      else if (nextChar === "w") generatedChar = sampleCharFromClass("\\w");
      else if (nextChar === "s") generatedChar = " ";

      // Quantifier check
      let count = 1;
      if (i < p.length) {
        if (p[i] === "+") {
          count = randInt(2, 5);
          i++;
        } else if (p[i] === "*") {
          count = randInt(1, 4);
          i++;
        } else if (p[i] === "{") {
          const endBrace = p.indexOf("}", i);
          if (endBrace !== -1) {
            const bounds = p.substring(i + 1, endBrace).split(",");
            const minB = parseInt(bounds[0], 10) || 1;
            const maxB = bounds.length > 1 ? parseInt(bounds[1], 10) || minB + 3 : minB;
            count = randInt(minB, maxB);
            i = endBrace + 1;
          }
        }
      }

      for (let c = 0; c < count; c++) {
        result += nextChar === "d" ? sampleCharFromClass("\\d") : generatedChar;
      }
      continue;
    }

    // Alternation (a|b)
    if (ch === "(") {
      const closeParen = p.indexOf(")", i);
      if (closeParen !== -1) {
        let inside = p.substring(i + 1, closeParen);
        i = closeParen + 1;
        if (inside.startsWith("?:")) inside = inside.substring(2);
        const options = inside.split("|");
        result += pick(options);
        continue;
      }
    }

    // Plain characters
    if (!["+", "*", "?", "^", "$", "|"].includes(ch)) {
      result += ch;
    }
    i++;
  }

  return result || "valid_sample";
}

/**
 * Generate comprehensive test cases (both positive and negative) for a given regex
 */
export function generateRegexTestSuite(
  patternStr: string,
  flags: string = "",
  count: number = 5,
  isVi: boolean = false
): {
  testCases: GeneratedTestCase[];
  isValidRegex: boolean;
  errorMessage?: string;
} {
  let reg: RegExp;
  try {
    let cleanPattern = patternStr.trim();
    let cleanFlags = flags;

    // Handle /pattern/flags format
    if (cleanPattern.startsWith("/") && cleanPattern.lastIndexOf("/") > 0) {
      cleanFlags = cleanPattern.substring(cleanPattern.lastIndexOf("/") + 1);
      cleanPattern = cleanPattern.substring(1, cleanPattern.lastIndexOf("/"));
    }

    reg = new RegExp(cleanPattern, cleanFlags);
  } catch (err: unknown) {
    return {
      testCases: [],
      isValidRegex: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  const cases: GeneratedTestCase[] = [];
  let currentId = 1;

  // 1. Generate Matching (Positive) Strings
  const positiveValues = new Set<string>();
  let positiveAttempts = 0;

  while (positiveValues.size < count && positiveAttempts < count * 8) {
    positiveAttempts++;
    const candidate = generateMatchingString(patternStr, flags);
    if (reg.test(candidate)) {
      positiveValues.add(candidate);
    }
  }

  Array.from(positiveValues).forEach((val, idx) => {
    cases.push({
      id: currentId++,
      value: val,
      expected: "PASS",
      category: "Happy Path",
      reason: isVi
        ? `Chuỗi hợp lệ thỏa mãn toàn bộ biểu thức chính quy (Mẫu #${idx + 1})`
        : `Valid string fully satisfying the regex pattern (Variant #${idx + 1})`,
      matched: true,
    });
  });

  // 2. Generate Mismatching (Negative / Boundary) Strings
  const sampleValid = positiveValues.size > 0 ? Array.from(positiveValues)[0] : "abc123";
  const negativeCandidates: { val: string; category: GeneratedTestCase["category"]; reason: string; reasonVi: string }[] = [
    {
      val: "",
      category: "Boundary",
      reason: "Empty string / Zero length input",
      reasonVi: "Chuỗi rỗng / Không nhập dữ liệu",
    },
    {
      val: `  ${sampleValid}  `,
      category: "Format Error",
      reason: "Contains forbidden leading and trailing whitespaces",
      reasonVi: "Chứa khoảng trắng ở đầu hoặc cuối chuỗi",
    },
    {
      val: `${sampleValid}<script>alert(1)</script>`,
      category: "Security",
      reason: "XSS script tag payload injection",
      reasonVi: "Tấn công chèn mã độc XSS / Ký tự HTML bất hợp lệ",
    },
    {
      val: `${sampleValid}'; DROP TABLE users; --`,
      category: "Security",
      reason: "SQL Injection payload boundary breaker",
      reasonVi: "Ký tự gây lỗi SQL Injection / Dấu ngoặc đơn bất thường",
    },
    {
      val: sampleValid.length > 2 ? sampleValid.substring(0, Math.floor(sampleValid.length / 2)) : "a",
      category: "Boundary",
      reason: "Truncated input violating minimum length constraint",
      reasonVi: "Chuỗi bị cắt ngắn, vi phạm độ dài tối thiểu",
    },
    {
      val: sampleValid.repeat(20),
      category: "Boundary",
      reason: "Buffer overflow / Exceeds maximum length boundary",
      reasonVi: "Chuỗi quá dài, vượt quá giới hạn độ dài tối đa",
    },
    {
      val: `${sampleValid} 🚀 #!$`,
      category: "Format Error",
      reason: "Contains emojis and disallowed special characters",
      reasonVi: "Chứa biểu tượng cảm xúc (Emoji) và ký tự đặc biệt",
    },
    {
      val: sampleValid.replace(/\d/g, "A").replace(/[a-zA-Z]/g, "9"),
      category: "Negative",
      reason: "Inverted character types (Digits swapped with Letters)",
      reasonVi: "Đảo ngược loại ký tự (Thay số bằng chữ hoặc ngược lại)",
    },
  ];

  // Specific additions based on pattern inspection
  if (patternStr.includes("@")) {
    negativeCandidates.push(
      {
        val: "missing_at_symbol.com",
        category: "Format Error",
        reason: "Missing '@' symbol in email",
        reasonVi: "Thiếu ký tự '@' trong email",
      },
      {
        val: "user@domain_without_tld",
        category: "Format Error",
        reason: "Missing domain top-level extension (TLD)",
        reasonVi: "Thiếu phần mở rộng tên miền (.com, .vn...)",
      }
    );
  }

  if (patternStr.includes("0(3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])")) {
    negativeCandidates.push(
      {
        val: "0123456789",
        category: "Format Error",
        reason: "Invalid telecom prefix ('01' no longer exists in Vietnam)",
        reasonVi: "Đầu số mạng không tồn tại ở VN (đầu 01 đã chuyển đổi)",
      },
      {
        val: "098123456", // 9 digits
        category: "Boundary",
        reason: "Only 9 digits (Vietnam mobile requires exactly 10 digits)",
        reasonVi: "Chỉ có 9 chữ số (SĐT VN bắt buộc đủ 10 số)",
      }
    );
  }

  // Filter only those candidates that actually FAIL reg.test()
  const addedNegatives = new Set<string>();
  for (const item of negativeCandidates) {
    if (!reg.test(item.val) && !addedNegatives.has(item.val)) {
      addedNegatives.add(item.val);
      cases.push({
        id: currentId++,
        value: item.val,
        expected: "FAIL",
        category: item.category,
        reason: isVi ? item.reasonVi : item.reason,
        matched: false,
      });
      if (addedNegatives.size >= count + 2) break;
    }
  }

  return {
    testCases: cases,
    isValidRegex: true,
  };
}

/**
 * Format regex test cases to Markdown Table
 */
export function exportRegexCasesToMarkdown(cases: GeneratedTestCase[], isVi: boolean = false): string {
  if (cases.length === 0) return "";

  const headers = isVi
    ? ["#", "Dự Kiến", "Phân Loại", "Giá Trị Kiểm Thử", "Lý Do / Mục Tiêu"]
    : ["#", "Expected", "Category", "Test Input Value", "Objective / Failure Reason"];

  const divider = ["---", "---", "---", "---", "---"];

  const rows = cases.map((c) => {
    const displayVal = c.value === "" ? "`<Empty String>`" : `\`${c.value.replace(/\|/g, "\\|")}\``;
    return `| ${c.id} | **${c.expected}** | ${c.category} | ${displayVal} | ${c.reason} |`;
  });

  return [`| ${headers.join(" | ")} |`, `| ${divider.join(" | ")} |`, ...rows].join("\n");
}

/**
 * Format regex test cases to CSV
 */
export function exportRegexCasesToCsv(cases: GeneratedTestCase[], isVi: boolean = false): string {
  if (cases.length === 0) return "";

  const header = isVi
    ? "CaseID,Expected,Category,TestValue,Reason"
    : "CaseID,Expected,Category,TestValue,Reason";

  const rows = cases.map((c) => {
    const valEscaped = `"${c.value.replace(/"/g, '""')}"`;
    const reasonEscaped = `"${c.reason.replace(/"/g, '""')}"`;
    return `${c.id},${c.expected},${c.category},${valEscaped},${reasonEscaped}`;
  });

  return [header, ...rows].join("\n");
}
