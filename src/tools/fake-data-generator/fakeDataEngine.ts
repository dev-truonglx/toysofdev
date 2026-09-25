/**
 * Realistic Mock & Fake Data Generator Engine
 * 
 * Provides authentic test data generation for Vietnamese, Japanese, and International locales:
 * - Full Names, Genders (Tiếng Việt, 日本語, English)
 * - Authentic VN, JP & International Phone Numbers
 * - Vietnam 12-digit CCCD with valid province & century/gender codes
 * - Japan 12-digit My Number (マイナンバー) with official Modulo-11 Checksum
 * - 10-digit Tax Code with Modulo-11 Checksum
 * - Visa, Mastercard, JCB, Amex with valid Luhn Checksum Modulo 10
 * - Realistically matched Email, Address, DoB/Age
 * - Job, Company, Bank Accounts, Tech fields
 * - Fully Extensible Custom Field Schema (Options List, Number Range, Patterns, Booleans, Dates, Regex, Timestamps)
 * - Export to JSON, CSV, and SQL INSERT
 */

import { generateMatchingString } from "../regex-reverse-generator/regexReverseEngine";

export type FieldDataType =
  | "built-in"
  | "options-list"
  | "number-range"
  | "text-pattern"
  | "boolean"
  | "date-range"
  | "custom-regex"
  | "timestamp"
  | "lorem-sentence";

export interface CustomFieldDef {
  id: string;
  name: string;
  nameVi?: string;
  dataType: FieldDataType;
  builtinType?: string;
  enabled: boolean;
  isCustom?: boolean;
  optionsList?: string[];
  numberMin?: number;
  numberMax?: number;
  numberDecimals?: number;
  textPattern?: string;
  booleanFormat?: "true/false" | "1/0" | "Yes/No";
  dateFrom?: string;
  dateTo?: string;
  customRegex?: string;
}

export type SupportedLocale = "vi" | "en" | "ja";

export interface FakeDataOptions {
  count: number;
  locale: SupportedLocale;
  minAge: number;
  maxAge: number;
  gender: "all" | "male" | "female";
  fields?: Record<string, boolean>;
  customFields?: CustomFieldDef[];
  sqlTableName?: string;
  csvDelimiter?: string;
}

export interface MockRecord {
  id: number;
  fullName?: string;
  gender?: string;
  phone?: string;
  email?: string;
  citizenId?: string;
  taxCode?: string;
  creditCard?: { type: string; number: string; expiry: string; cvv: string } | string;
  dateOfBirth?: string;
  age?: number;
  address?: string;
  company?: string;
  jobTitle?: string;
  bankAccount?: { bank: string; accountNumber: string; balance: string } | string;
  ipv4?: string;
  uuid?: string;
  [key: string]: any;
}

export const DEFAULT_MOCK_FIELDS: CustomFieldDef[] = [
  { id: "fullName", name: "fullName", nameVi: "Họ và Tên", dataType: "built-in", builtinType: "fullName", enabled: true },
  { id: "gender", name: "gender", nameVi: "Giới Tính", dataType: "built-in", builtinType: "gender", enabled: true },
  { id: "phone", name: "phone", nameVi: "Số Điện Thoại", dataType: "built-in", builtinType: "phone", enabled: true },
  { id: "email", name: "email", nameVi: "Email (@example.com)", dataType: "built-in", builtinType: "email", enabled: true },
  { id: "citizenId", name: "citizenId", nameVi: "CCCD / My Number (12 số)", dataType: "built-in", builtinType: "citizenId", enabled: true },
  { id: "taxCode", name: "taxCode", nameVi: "Mã Số Thuế", dataType: "built-in", builtinType: "taxCode", enabled: false },
  { id: "creditCard", name: "creditCard", nameVi: "Thẻ Tín Dụng Test (Luhn)", dataType: "built-in", builtinType: "creditCard", enabled: true },
  { id: "dateOfBirth", name: "dateOfBirth", nameVi: "Ngày Sinh & Tuổi", dataType: "built-in", builtinType: "dateOfBirth", enabled: true },
  { id: "address", name: "address", nameVi: "Địa Chỉ", dataType: "built-in", builtinType: "address", enabled: true },
  { id: "company", name: "company", nameVi: "Công Ty & Vị Trí", dataType: "built-in", builtinType: "company", enabled: false },
  { id: "bankAccount", name: "bankAccount", nameVi: "Tài Khoản Ngân Hàng", dataType: "built-in", builtinType: "bankAccount", enabled: false },
  { id: "ipv4", name: "ipv4", nameVi: "Địa chỉ IPv4", dataType: "built-in", builtinType: "ipv4", enabled: false },
  { id: "uuid", name: "uuid", nameVi: "Mã UUID (v4)", dataType: "built-in", builtinType: "uuid", enabled: false },
];

// --- Vietnamese Datasets ---

const VN_LAST_NAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đoàn", "Lâm", "Trịnh", "Mai"
];

const VN_MALE_MIDDLE = ["Văn", "Hữu", "Đức", "Minh", "Quốc", "Thanh", "Tuấn", "Hoàng", "Gia", "Đình"];
const VN_MALE_FIRST = [
  "An", "Bình", "Cường", "Dũng", "Duy", "Hải", "Hiếu", "Huy", "Hùng", "Khánh",
  "Khoa", "Kiên", "Long", "Minh", "Nam", "Nghĩa", "Phong", "Phúc", "Quân", "Quang",
  "Sơn", "Thắng", "Thịnh", "Tiến", "Toàn", "Trung", "Tuấn", "Tùng", "Việt", "Vinh"
];

const VN_FEMALE_MIDDLE = ["Thị", "Ngọc", "Phương", "Thu", "Thanh", "Mỹ", "Ánh", "Hải", "Quỳnh", "Bảo"];
const VN_FEMALE_FIRST = [
  "Anh", "Châu", "Dung", "Duyên", "Giang", "Hà", "Hạnh", "Hoa", "Hương", "Huyền",
  "Lan", "Linh", "Mai", "My", "Nga", "Ngân", "Ngọc", "Nhi", "Nhung", "Oanh",
  "Phương", "Quỳnh", "Thảo", "Thu", "Thủy", "Trang", "Trâm", "Tuyết", "Uyên", "Yến"
];

const VN_PHONE_PREFIXES = [
  "098", "097", "096", "086", "032", "033", "034", "035", "036", "037", "038", "039",
  "091", "094", "088", "081", "082", "083", "084", "085",
  "090", "093", "089", "070", "079", "077", "076", "078",
  "092", "056", "058",
];

const VN_PROVINCES = [
  { code: "001", name: "Hà Nội" },
  { code: "079", name: "TP. Hồ Chí Minh" },
  { code: "048", name: "Đà Nẵng" },
  { code: "031", name: "Hải Phòng" },
  { code: "092", name: "Cần Thơ" },
  { code: "024", name: "Bắc Giang" },
  { code: "037", name: "Ninh Bình" },
  { code: "038", name: "Thanh Hóa" },
  { code: "040", name: "Nghệ An" },
  { code: "056", name: "Khánh Hòa" },
  { code: "068", name: "Lâm Đồng" },
  { code: "074", name: "Bình Dương" },
  { code: "075", name: "Đồng Nai" },
  { code: "080", name: "Long An" },
  { code: "082", name: "Tiền Giang" },
];

const VN_STREETS = [
  "Nguyễn Huệ", "Lê Lợi", "Trần Hưng Đạo", "Hai Bà Trưng", "Phan Chu Trinh",
  "Lý Thường Kiệt", "Quang Trung", "Nguyễn Thị Minh Khai", "Điện Biên Phủ",
  "Võ Văn Kiệt", "Hoàng Hoa Thám", "Trần Phú", "Nguyễn Trãi", "Lê Duẩn"
];

const VN_WARDS = [
  "Phường Bến Nghé", "Phường Bến Thành", "Phường Tân Định", "Phường Đa Kao",
  "Phường Cầu Giấy", "Phường Dịch Vọng", "Phường Láng Hạ", "Phường Kim Mã",
  "Phường Thạch Thang", "Phường Hải Châu I", "Phường Hòa Cường Bắc"
];

const VN_COMPANIES = [
  "FPT Software", "VNG Corporation", "Viettel Group", "VNPT Technology", "Masan Group",
  "VinGroup", "Tiki Corporation", "Shopee Vietnam", "ZaloPay Technology", "MoMo Payments"
];

const VN_BANKS = [
  "Vietcombank (VCB)", "Techcombank (TCB)", "MB Bank (Quân Đội)", "VPBank", "ACB",
  "BIDV", "VietinBank", "TPBank", "Sacombank", "HDBank"
];

// --- Japanese Datasets (日本) ---

const JA_LAST_NAMES = [
  { kanji: "佐藤", romaji: "sato" },
  { kanji: "鈴木", romaji: "suzuki" },
  { kanji: "高橋", romaji: "takahashi" },
  { kanji: "田中", romaji: "tanaka" },
  { kanji: "渡辺", romaji: "watanabe" },
  { kanji: "伊藤", romaji: "ito" },
  { kanji: "山本", romaji: "yamamoto" },
  { kanji: "中村", romaji: "nakamura" },
  { kanji: "小林", romaji: "kobayashi" },
  { kanji: "加藤", romaji: "kato" },
  { kanji: "吉田", romaji: "yoshida" },
  { kanji: "山田", romaji: "yamada" },
  { kanji: "佐々木", romaji: "sasaki" },
  { kanji: "山口", romaji: "yamaguchi" },
  { kanji: "松本", romaji: "matsumoto" },
  { kanji: "井上", romaji: "inoue" },
  { kanji: "木村", romaji: "kimura" },
  { kanji: "林", romaji: "hayashi" },
  { kanji: "清水", romaji: "shimizu" },
  { kanji: "斉藤", romaji: "saito" },
];

const JA_MALE_FIRST = [
  { kanji: "蓮", romaji: "ren" },
  { kanji: "大翔", romaji: "hiroto" },
  { kanji: "陽翔", romaji: "haruto" },
  { kanji: "湊", romaji: "minato" },
  { kanji: "悠真", romaji: "yuma" },
  { kanji: "悠人", romaji: "yuto" },
  { kanji: "蒼", romaji: "aoi" },
  { kanji: "律", romaji: "ritsu" },
  { kanji: "樹", romaji: "itsuki" },
  { kanji: "大和", romaji: "yamato" },
  { kanji: "翔平", romaji: "shohei" },
  { kanji: "健太", romaji: "kenta" },
  { kanji: "拓海", romaji: "takumi" },
  { kanji: "陸", romaji: "riku" },
  { kanji: "颯太", romaji: "sota" },
];

const JA_FEMALE_FIRST = [
  { kanji: "陽葵", romaji: "himari" },
  { kanji: "凛", romaji: "rin" },
  { kanji: "芽依", romaji: "mei" },
  { kanji: "結菜", romaji: "yuina" },
  { kanji: "咲良", romaji: "sakura" },
  { kanji: "莉子", romaji: "riko" },
  { kanji: "結月", romaji: "yuzuki" },
  { kanji: "紬", romaji: "tsumugi" },
  { kanji: "澪", romaji: "mio" },
  { kanji: "結愛", romaji: "yua" },
  { kanji: "葵", romaji: "aoi" },
  { kanji: "美咲", romaji: "misaki" },
  { kanji: "七海", romaji: "nanami" },
  { kanji: "花", romaji: "hana" },
  { kanji: "愛", romaji: "ai" },
];

const JA_PHONE_PREFIXES = ["090", "080", "070"];

const JA_ADDRESSES = [
  { postal: "〒160-0022", address: "東京都新宿区新宿3-1-1" },
  { postal: "〒150-0043", address: "東京都渋谷区道玄坂1-2-3" },
  { postal: "〒100-0005", address: "東京都千代田区丸の内1-1-1" },
  { postal: "〒105-0011", address: "東京都港区芝公園4-2-8" },
  { postal: "〒530-0001", address: "大阪府大阪市北区梅田3-1-1" },
  { postal: "〒542-0076", address: "大阪府大阪市中央区難波5-1-60" },
  { postal: "〒220-0012", address: "神奈川県横浜市西区みなとみらい2-2-1" },
  { postal: "〒604-8005", address: "京都府京都市中京区河原町通三条上る" },
  { postal: "〒450-0002", address: "愛知県名古屋市中村区名駅1-1-4" },
  { postal: "〒812-0012", address: "福岡県福岡市博多区博多駅中央街1-1" },
  { postal: "〒060-0005", address: "北海道札幌市中央区北5条西2丁目" },
];

const JA_COMPANIES = [
  "トヨタ自動車 (Toyota)", "ソニーグループ (Sony)", "任天堂 (Nintendo)", "パナソニック (Panasonic)",
  "ソフトバンク (SoftBank)", "楽天グループ (Rakuten)", "本田技研工業 (Honda)", "日立製作所 (Hitachi)",
  "三菱商事 (Mitsubishi)", "LINEヤフー (LY Corporation)", "ファーストリテイリング (UNIQLO)", "キーエンス (Keyence)"
];

const JA_JOB_TITLES = [
  "シニアQAエンジニア (Senior QA)", "ソフトウェア開発者 (Software Engineer)", "プロダクトマネージャー (Product Manager)",
  "フロントエンドエンジニア (Frontend)", "バックエンドエンジニア (Backend)", "SRE / DevOpsエンジニア",
  "UI/UXデザイナー (Designer)", "セキュリティエンジニア (Security)", "テックリード (Tech Lead)"
];

const JA_BANKS = [
  "三菱UFJ銀行 (MUFG)", "三井住友銀行 (SMBC)", "みずほ銀行 (Mizuho)", "ゆうちょ銀行 (Japan Post)",
  "りそな銀行 (Resona)", "楽天銀行 (Rakuten Bank)", "住信SBIネット銀行 (SBI Sumishin)"
];

// --- English / International Datasets ---

const EN_MALE_FIRST = [
  "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph",
  "Thomas", "Charles", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven",
  "Andrew", "Paul", "Joshua", "Kevin", "Brian", "George", "Edward", "Ronald", "Timothy"
];

const EN_FEMALE_FIRST = [
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica",
  "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley",
  "Kimberly", "Emily", "Donna", "Michelle", "Carol", "Amanda", "Melissa", "Deborah", "Stephanie"
];

const EN_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris"
];

const EN_STREETS = [
  "Main Street", "Broadway", "Oak Avenue", "Maple Lane", "Cedar Drive",
  "Washington Street", "Lakeview Boulevard", "Sunset Highway", "Park Avenue"
];

const EN_CITIES = [
  { city: "New York", state: "NY", zip: "10001" },
  { city: "Los Angeles", state: "CA", zip: "90001" },
  { city: "Chicago", state: "IL", zip: "60601" },
  { city: "Houston", state: "TX", zip: "77001" },
  { city: "San Francisco", state: "CA", zip: "94102" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Boston", state: "MA", zip: "02108" },
];

const EN_COMPANIES = [
  "Acme Corporation", "Globex Global", "Initech Systems", "Umbrella Solutions", "Stark Industries",
  "Cyberdyne Tech", "Massive Dynamic", "Hooli Labs", "Wayne Enterprises", "Pied Piper"
];

const EN_JOB_TITLES = [
  "Software Engineer", "Senior QA Automation Engineer", "Product Manager", "UI/UX Designer",
  "DevOps Engineer", "Frontend Developer", "Backend Developer", "Security Analyst",
  "Scrum Master", "Data Engineer", "Technical Lead", "Solutions Architect"
];

const EN_BANKS = [
  "JPMorgan Chase", "Bank of America", "Citibank", "Wells Fargo", "Goldman Sachs",
  "Barclays", "HSBC", "Morgan Stanley"
];

// Helper: random integer in range [min, max]
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: random choice
function pick<T>(arr: T[] | string): any {
  return arr[Math.floor(Math.random() * arr.length)];
}

const vnSimpleNamesCache = new Map<string, string>();

/**
 * Remove Vietnamese accents for email/usernames
 */
export function removeVietnameseTones(str: string): string {
  let cached = vnSimpleNamesCache.get(str);
  if (cached) return cached;
  const result = str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
  vnSimpleNamesCache.set(str, result);
  return result;
}

/**
 * Validates a number against Luhn algorithm (Modulo 10)
 */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (!digits || digits.length < 2) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Generate a valid credit card number conforming to Luhn Checksum (Modulo 10)
 */
export function generateValidCreditCard(cardType: "Visa" | "Mastercard" | "JCB" | "Amex"): {
  type: string;
  number: string;
  expiry: string;
  cvv: string;
} {
  let prefix = "4";
  let length = 16;

  if (cardType === "Visa") {
    prefix = "4";
    length = 16;
  } else if (cardType === "Mastercard") {
    prefix = pick(["51", "52", "53", "54", "55"]);
    length = 16;
  } else if (cardType === "JCB") {
    prefix = "35";
    length = 16;
  } else if (cardType === "Amex") {
    prefix = pick(["34", "37"]);
    length = 15;
  }

  let partial = prefix;
  while (partial.length < length - 1) {
    partial += randInt(0, 9).toString();
  }

  for (let d = 0; d <= 9; d++) {
    const candidate = partial + d.toString();
    if (isValidLuhn(candidate)) {
      const now = new Date();
      const expMonth = String(randInt(1, 12)).padStart(2, "0");
      const expYear = String((now.getFullYear() + randInt(1, 5)) % 100).padStart(2, "0");
      const cvv = cardType === "Amex" ? String(randInt(1000, 9999)) : String(randInt(100, 999));
      const formatted = candidate.replace(/(.{4})/g, "$1 ").trim();

      return {
        type: cardType,
        number: formatted,
        expiry: `${expMonth}/${expYear}`,
        cvv,
      };
    }
  }

  return {
    type: cardType,
    number: partial + "0",
    expiry: "12/28",
    cvv: "123",
  };
}

/**
 * Generate a 12-digit Vietnam National ID (CCCD)
 */
export function generateVietnamCccd(birthYear: number, isFemale: boolean): string {
  const province = pick(VN_PROVINCES).code;
  
  let centuryGenderCode = 0;
  if (birthYear >= 1900 && birthYear < 2000) {
    centuryGenderCode = isFemale ? 1 : 0;
  } else if (birthYear >= 2000 && birthYear < 2100) {
    centuryGenderCode = isFemale ? 3 : 2;
  }

  const birthYearSuffix = String(birthYear % 100).padStart(2, "0");
  const randomSeq = String(randInt(100000, 999999));

  return `${province}${centuryGenderCode}${birthYearSuffix}${randomSeq}`;
}

/**
 * Validates Japanese 12-digit My Number (個人番号 / マイナンバー)
 */
export function isValidJapaneseMyNumber(myNumber: string): boolean {
  const digits = myNumber.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  const nums = digits.split("").map(Number);

  let sum = 0;
  for (let n = 1; n <= 11; n++) {
    const d = nums[11 - n];
    const q = n <= 6 ? n + 1 : n - 5;
    sum += d * q;
  }

  const rem = sum % 11;
  const expectedCheck = rem <= 1 ? 0 : 11 - rem;
  return nums[11] === expectedCheck;
}

/**
 * Generate an authentic 12-digit Japanese My Number (マイナンバー) with valid Modulo-11 Checksum
 */
export function generateJapaneseMyNumber(): string {
  const first11 = Array.from({ length: 11 }, () => randInt(0, 9));
  if (first11[0] === 0) first11[0] = randInt(1, 9);

  let sum = 0;
  for (let n = 1; n <= 11; n++) {
    const d = first11[11 - n];
    const q = n <= 6 ? n + 1 : n - 5;
    sum += d * q;
  }

  const rem = sum % 11;
  const checkDigit = rem <= 1 ? 0 : 11 - rem;
  return `${first11.join("")}${checkDigit}`;
}

/**
 * Generate a valid 10-digit Vietnamese Tax Code with Modulo-11 Checksum
 */
export function generateVietnamTaxCode(): string {
  const first9 = Array.from({ length: 9 }, () => randInt(0, 9));
  if (first9[0] === 0) first9[0] = randInt(1, 9);

  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = first9.reduce((acc, digit, idx) => acc + digit * weights[idx], 0);
  const remainder = sum % 11;
  let checkDigit = 11 - remainder;
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0;

  return `${first9.join("")}${checkDigit}`;
}

/**
 * Generates an array of realistic mock records based on options (supports both built-in and custom dynamic fields)
 */
export function generateMockDataset(options: FakeDataOptions): MockRecord[] {
  const records: MockRecord[] = [];
  const currentYear = new Date().getFullYear();

  // Determine active fields (customFields takes precedence if provided)
  const activeFields: CustomFieldDef[] = options.customFields
    ? options.customFields.filter((f) => f.enabled)
    : DEFAULT_MOCK_FIELDS.filter((f) => (options.fields ? options.fields[f.id] : f.enabled));

  for (let i = 1; i <= options.count; i++) {
    const isVi = options.locale === "vi";
    const isJa = options.locale === "ja";
    const isFemale =
      options.gender === "female"
        ? true
        : options.gender === "male"
        ? false
        : Math.random() < 0.5;

    // Age & DoB
    const age = randInt(options.minAge, options.maxAge);
    const birthYear = currentYear - age;
    const birthMonth = randInt(1, 12);
    const birthDay = randInt(1, 28);
    const dobString = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

    // Name & Email
    let fullName = "";
    let firstNameSimple = "";
    let lastNameSimple = "";

    if (isVi) {
      const lastName = pick(VN_LAST_NAMES);
      const middleName = isFemale ? pick(VN_FEMALE_MIDDLE) : pick(VN_MALE_MIDDLE);
      const firstName = isFemale ? pick(VN_FEMALE_FIRST) : pick(VN_MALE_FIRST);
      fullName = `${lastName} ${middleName} ${firstName}`;
      firstNameSimple = removeVietnameseTones(firstName);
      lastNameSimple = removeVietnameseTones(lastName);
    } else if (isJa) {
      const lastNameObj = pick(JA_LAST_NAMES);
      const firstNameObj = isFemale ? pick(JA_FEMALE_FIRST) : pick(JA_MALE_FIRST);
      fullName = `${lastNameObj.kanji} ${firstNameObj.kanji}`;
      firstNameSimple = firstNameObj.romaji;
      lastNameSimple = lastNameObj.romaji;
    } else {
      const firstName = isFemale ? pick(EN_FEMALE_FIRST) : pick(EN_MALE_FIRST);
      const lastName = pick(EN_LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
      firstNameSimple = firstName.toLowerCase();
      lastNameSimple = lastName.toLowerCase();
    }

    // Phone
    let phone = "";
    if (isVi) {
      phone = `${pick(VN_PHONE_PREFIXES)}${randInt(1000000, 9999999)}`;
    } else if (isJa) {
      const prefix = pick(JA_PHONE_PREFIXES);
      const mid = String(randInt(1000, 9999));
      const end = String(randInt(1000, 9999));
      phone = `${prefix}-${mid}-${end}`;
    } else {
      phone = `+1 (${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`;
    }

    // Safe Email with RFC 2606 domain
    const email = `${firstNameSimple}.${lastNameSimple}${randInt(10, 99)}@example.com`;

    // National ID
    let citizenId = "";
    if (isVi) {
      citizenId = generateVietnamCccd(birthYear, isFemale);
    } else if (isJa) {
      citizenId = generateJapaneseMyNumber();
    } else {
      citizenId = `${randInt(100, 999)}-${randInt(10, 99)}-${randInt(1000, 9999)}`;
    }

    // Tax Code
    let taxCode = "";
    if (isVi) {
      taxCode = generateVietnamTaxCode();
    } else if (isJa) {
      taxCode = `T${randInt(1000000000000, 9999999999999)}`;
    } else {
      taxCode = `${randInt(10, 99)}-${randInt(1000000, 9999999)}`;
    }

    // Address
    let address = "";
    if (isVi) {
      const prov = pick(VN_PROVINCES).name;
      address = `Số ${randInt(1, 350)} ${pick(VN_STREETS)}, ${pick(VN_WARDS)}, ${prov}`;
    } else if (isJa) {
      const jaLoc = pick(JA_ADDRESSES);
      address = `${jaLoc.postal} ${jaLoc.address}`;
    } else {
      const loc = pick(EN_CITIES);
      address = `${randInt(100, 9999)} ${pick(EN_STREETS)}, ${loc.city}, ${loc.state} ${loc.zip}`;
    }

    // Credit Card
    const cardType = isJa
      ? pick<"JCB" | "Visa" | "Mastercard">(["JCB", "JCB", "Visa", "Mastercard"])
      : pick<"Visa" | "Mastercard" | "JCB" | "Amex">(["Visa", "Mastercard", "JCB", "Amex"]);
    const creditCard = generateValidCreditCard(cardType);

    // Company & Job
    const company = isVi ? pick(VN_COMPANIES) : isJa ? pick(JA_COMPANIES) : pick(EN_COMPANIES);
    const jobTitle = isVi ? pick(EN_JOB_TITLES) : isJa ? pick(JA_JOB_TITLES) : pick(EN_JOB_TITLES);

    // Bank Account
    const bank = isVi ? pick(VN_BANKS) : isJa ? pick(JA_BANKS) : pick(EN_BANKS);
    const accountNumber = String(randInt(100000000, 999999999999));
    const balance = isVi
      ? `${(randInt(5, 500) * 1000000).toLocaleString("vi-VN")} ₫`
      : isJa
      ? `¥${(randInt(50, 1500) * 10000).toLocaleString("ja-JP")}`
      : `$${randInt(500, 50000).toLocaleString("en-US")}`;

    // Tech
    const ipv4 = `${randInt(11, 223)}.${randInt(1, 254)}.${randInt(1, 254)}.${randInt(1, 254)}`;
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    const record: MockRecord = { id: i };

    // Iterate through active fields and assign values
    for (const field of activeFields) {
      const key = field.name || field.id;

      if (field.dataType === "built-in") {
        const bType = field.builtinType || field.id;
        if (bType === "fullName") record[key] = fullName;
        else if (bType === "gender") {
          if (isVi) record[key] = isFemale ? "Nữ" : "Nam";
          else if (isJa) record[key] = isFemale ? "女性" : "男性";
          else record[key] = isFemale ? "Female" : "Male";
        }
        else if (bType === "phone") record[key] = phone;
        else if (bType === "email") record[key] = email;
        else if (bType === "citizenId") record[key] = citizenId;
        else if (bType === "taxCode") record[key] = taxCode;
        else if (bType === "creditCard") record[key] = creditCard;
        else if (bType === "dateOfBirth") {
          record[key] = dobString;
          record["age"] = age;
        }
        else if (bType === "address") record[key] = address;
        else if (bType === "company") {
          record[key] = company;
          record["jobTitle"] = jobTitle;
        }
        else if (bType === "bankAccount") {
          record[key] = { bank, accountNumber, balance };
        }
        else if (bType === "ipv4") record[key] = ipv4;
        else if (bType === "uuid") record[key] = uuid;
      } else if (field.dataType === "options-list") {
        const opts = field.optionsList && field.optionsList.length > 0 ? field.optionsList : ["Option 1", "Option 2"];
        record[key] = pick(opts);
      } else if (field.dataType === "number-range") {
        const min = field.numberMin ?? 0;
        const max = field.numberMax ?? 100;
        const dec = field.numberDecimals ?? 0;
        if (dec > 0) {
          record[key] = parseFloat((Math.random() * (max - min) + min).toFixed(dec));
        } else {
          record[key] = randInt(min, max);
        }
      } else if (field.dataType === "text-pattern") {
        const pat = field.textPattern || "ORD-####-??";
        record[key] = pat.replace(/[#?*]/g, (char) => {
          if (char === "#") return randInt(0, 9).toString();
          if (char === "?") return pick("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
          return pick("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        });
      } else if (field.dataType === "boolean") {
        const boolVal = Math.random() > 0.5;
        if (field.booleanFormat === "1/0") record[key] = boolVal ? 1 : 0;
        else if (field.booleanFormat === "Yes/No") record[key] = boolVal ? (isVi ? "Có" : "Yes") : (isVi ? "Không" : "No");
        else record[key] = boolVal;
      } else if (field.dataType === "date-range") {
        const fromTime = field.dateFrom ? new Date(field.dateFrom).getTime() : new Date("2024-01-01").getTime();
        const toTime = field.dateTo ? new Date(field.dateTo).getTime() : new Date("2026-12-31").getTime();
        const randomTime = randInt(Math.min(fromTime, toTime), Math.max(fromTime, toTime));
        record[key] = new Date(randomTime).toISOString().split("T")[0];
      } else if (field.dataType === "custom-regex") {
        record[key] = generateMatchingString(field.customRegex || "^[A-Z]{3}-\\d{4}$");
      } else if (field.dataType === "timestamp") {
        record[key] = Date.now() - randInt(0, 365) * 86400000;
      } else if (field.dataType === "lorem-sentence") {
        const sentences = isVi
          ? [
              "Giao dịch đã được hệ thống ghi nhận thành công.",
              "Khách hàng đã hoàn thành xác thực danh tính.",
              "Đơn hàng được phân bổ tới trung tâm kho vận.",
              "Hồ sơ người dùng đáp ứng tiêu chuẩn phê duyệt.",
            ]
          : isJa
          ? [
              "取引はシステムによって正常に記録されました。",
              "ユーザーのアカウント認証が正常に完了しました。",
              "注文は配送センターに割り当てられました。",
              "会員プロフィールは承認基準を満たしています。",
            ]
          : [
              "Transaction completed successfully without errors.",
              "User account verification finished successfully.",
              "Order dispatched to local fulfillment warehouse.",
              "Customer profile meets all verification criteria.",
            ];
        record[key] = pick(sentences);
      }
    }

    records.push(record);
  }

  return records;
}

/**
 * Export records to formatted JSON
 */
export function exportMockToJson(records: MockRecord[]): string {
  return JSON.stringify(records, null, 2);
}

/**
 * Export records to CSV string
 */
export function exportMockToCsv(records: MockRecord[], delimiter: string = ","): string {
  if (records.length === 0) return "";

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    let str = "";
    if (typeof val === "object") {
      str = JSON.stringify(val);
    } else {
      str = String(val);
    }
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const keys = Object.keys(records[0]);
  const header = keys.map(escapeCell).join(delimiter);

  const rows = records.map((rec) => {
    return keys
      .map((k) => {
        const val = rec[k];
        if (typeof val === "object" && val !== null) {
          if ("number" in val) {
            const cardObj = val as { type: string; number: string };
            return escapeCell(`${cardObj.number} (${cardObj.type})`);
          }
          if ("accountNumber" in val) {
            const bankObj = val as { bank: string; accountNumber: string };
            return escapeCell(`${bankObj.bank}: ${bankObj.accountNumber}`);
          }
        }
        return escapeCell(val);
      })
      .join(delimiter);
  });

  return [header, ...rows].join("\n");
}

/**
 * Export records to SQL INSERT INTO statement
 */
export function exportMockToSql(records: MockRecord[], tableName: string = "mock_users"): string {
  if (records.length === 0) return "";

  const sample = records[0];
  const keys = Object.keys(sample).filter((k) => k !== "id");
  const columnNames = keys.map((k) =>
    k
      .trim()
      .replace(/[\s-]+/g, "_")
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/_+/g, "_")
  );

  const statements = records.map((rec) => {
    const values = keys.map((k) => {
      const val = rec[k];
      if (val === null || val === undefined) return "NULL";
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
      if (typeof val === "object") {
        if ("number" in val) return `'${(val as { number: string }).number.replace(/'/g, "''")}'`;
        if ("accountNumber" in val) return `'${(val as { accountNumber: string }).accountNumber.replace(/'/g, "''")}'`;
        return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      }
      return `'${String(val).replace(/'/g, "''")}'`;
    });
    return `INSERT INTO ${tableName} (${columnNames.join(", ")}) VALUES (${values.join(", ")});`;
  });

  return statements.join("\n");
}
