/**
 * Timezone and Timestamp Conversion Utilities
 */

export type TimestampUnit = "auto" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds";

export interface TimezoneInfo {
  id: string;
  name: string;
  offset: string;
  offsetMinutes: number;
}

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
  second: number;// 0-59
  millisecond: number; // 0-999
}

export interface EpochResult {
  seconds: number;
  milliseconds: number;
  microseconds: string;
  nanoseconds: string;
  isoUtc: string;
  formattedTz: string;
}

export interface FormattedDateDetails {
  date: Date;
  epochSeconds: number;
  epochMillis: number;
  epochMicro: string;
  epochNano: string;
  selectedTzFormatted: string;
  selectedTzIso: string;
  utcFormatted: string;
  utcIso: string;
  rfc2822: string;
  relativeTimeVi: string;
  relativeTimeEn: string;
  dayOfYear: number;
  totalDaysInYear: number;
  weekOfYear: number;
  isLeapYear: boolean;
  dayOfWeekVi: string;
  dayOfWeekEn: string;
}

/**
 * Get user's local browser timezone
 */
export function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Get offset string like "+07:00" or "-05:00" for a timezone at a specific reference date
 */
export function getTimezoneOffset(tz: string, refDate: Date = new Date()): { offsetStr: string; offsetMinutes: number } {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
      year: "numeric",
    });
    const parts = dtf.formatToParts(refDate);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "";
    // e.g. "GMT+07:00", "GMT-05:00", "GMT"
    const match = tzPart.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const mins = match[2] ? parseInt(match[2], 10) : 0;
      const totalMins = hours * 60 + (hours < 0 ? -mins : mins);
      const sign = totalMins >= 0 ? "+" : "-";
      const absH = String(Math.abs(hours)).padStart(2, "0");
      const absM = String(mins).padStart(2, "0");
      return { offsetStr: `UTC${sign}${absH}:${absM}`, offsetMinutes: totalMins };
    }
    return { offsetStr: "UTC+00:00", offsetMinutes: 0 };
  } catch {
    return { offsetStr: "UTC+00:00", offsetMinutes: 0 };
  }
}

/**
 * Common popular timezones for quick selection
 */
export const POPULAR_TIMEZONES = [
  "UTC",
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * Load all supported IANA timezones sorted with offsets
 */
export function getAllSupportedTimezones(): TimezoneInfo[] {
  let list: string[] = [];
  try {
    const intlAny = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intlAny !== "undefined" && typeof intlAny.supportedValuesOf === "function") {
      list = intlAny.supportedValuesOf("timeZone");
    }
  } catch {
    list = POPULAR_TIMEZONES;
  }

  if (!list.includes("UTC")) {
    list.unshift("UTC");
  }

  const now = new Date();
  const result: TimezoneInfo[] = list.map((id) => {
    const { offsetStr, offsetMinutes } = getTimezoneOffset(id, now);
    const cleanName = id.replace(/_/g, " ");
    return {
      id,
      name: cleanName,
      offset: offsetStr,
      offsetMinutes,
    };
  });

  return result;
}

/**
 * Detect timestamp unit based on digit length
 */
export function autoDetectUnit(rawStr: string): TimestampUnit {
  const digits = rawStr.replace(/[^0-9]/g, "");
  const len = digits.length;
  if (len <= 11) return "seconds";
  if (len <= 14) return "milliseconds";
  if (len <= 17) return "microseconds";
  return "nanoseconds";
}

/**
 * Normalise any numeric epoch string or number to milliseconds
 */
export function toMilliseconds(num: number | string, unit: TimestampUnit = "auto"): { ms: number; detectedUnit: TimestampUnit } {
  const numStr = String(num).trim();
  const effectiveUnit = unit === "auto" ? autoDetectUnit(numStr) : unit;
  const n = Number(numStr);

  if (isNaN(n)) {
    return { ms: NaN, detectedUnit: effectiveUnit };
  }

  switch (effectiveUnit) {
    case "seconds":
      return { ms: n * 1000, detectedUnit: effectiveUnit };
    case "milliseconds":
      return { ms: n, detectedUnit: effectiveUnit };
    case "microseconds":
      return { ms: Math.floor(n / 1000), detectedUnit: effectiveUnit };
    case "nanoseconds":
      return { ms: Math.floor(n / 1000000), detectedUnit: effectiveUnit };
    default:
      return { ms: n * 1000, detectedUnit: "seconds" };
  }
}

/**
 * Convert discrete date/time parts in a target timezone into exact UTC Epoch
 */
export function datePartsToEpoch(parts: DateParts, tz: string): EpochResult {
  const { year, month, day, hour, minute, second, millisecond } = parts;

  let exactMs = 0;
  if (tz === "UTC") {
    exactMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  } else {
    // 1. Create a dummy UTC timestamp using these numbers
    const fakeUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));

    // 2. Format fakeUtc into the target timezone to find the timezone offset at this exact instant
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const formattedParts = dtf.formatToParts(fakeUtc);
    const partMap: Record<string, string> = {};
    for (const p of formattedParts) {
      partMap[p.type] = p.value;
    }

    let parsedHour = parseInt(partMap.hour, 10);
    if (parsedHour === 24) parsedHour = 0;

    const inTzAsUtc = Date.UTC(
      parseInt(partMap.year, 10),
      parseInt(partMap.month, 10) - 1,
      parseInt(partMap.day, 10),
      parsedHour,
      parseInt(partMap.minute, 10),
      parseInt(partMap.second, 10),
      millisecond
    );

    const offsetMs = inTzAsUtc - fakeUtc.getTime();
    exactMs = fakeUtc.getTime() - offsetMs;
  }

  const exactDate = new Date(exactMs);
  const seconds = Math.floor(exactMs / 1000);
  const microStr = `${exactMs}000`;
  const nanoStr = `${exactMs}000000`;

  // Format in selected timezone
  const formattedTz = formatDateTime(exactDate, tz);

  return {
    seconds,
    milliseconds: exactMs,
    microseconds: microStr,
    nanoseconds: nanoStr,
    isoUtc: exactDate.toISOString(),
    formattedTz,
  };
}

/**
 * Format a Date object into a readable string in a specific timezone
 */
export function formatDateTime(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}

/**
 * Extract DateParts for a Date object rendered in a specific timezone
 */
export function getDatePartsInTimezone(date: Date, tz: string): DateParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  let h = parseInt(partMap.hour, 10);
  if (h === 24) h = 0;

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: h,
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
    millisecond: date.getUTCMilliseconds(),
  };
}

/**
 * Format ISO 8601 with timezone offset (e.g. 2026-09-23T15:00:00+07:00)
 */
export function formatIsoWithOffset(date: Date, tz: string): string {
  const parts = getDatePartsInTimezone(date, tz);
  const { offsetStr } = getTimezoneOffset(tz, date);
  const rawOffset = offsetStr.replace("UTC", ""); // "+07:00"

  const Y = String(parts.year).padStart(4, "0");
  const M = String(parts.month).padStart(2, "0");
  const D = String(parts.day).padStart(2, "0");
  const h = String(parts.hour).padStart(2, "0");
  const m = String(parts.minute).padStart(2, "0");
  const s = String(parts.second).padStart(2, "0");
  const ms = String(parts.millisecond).padStart(3, "0");

  return `${Y}-${M}-${D}T${h}:${m}:${s}.${ms}${rawOffset || "Z"}`;
}

/**
 * Generate all formatted representations for a timestamp in a given timezone
 */
export function getDetailedFormattedDate(epochMs: number, tz: string): FormattedDateDetails | null {
  const date = new Date(epochMs);
  if (isNaN(date.getTime())) {
    return null;
  }

  const epochSeconds = Math.floor(epochMs / 1000);
  const epochMicro = `${epochMs}000`;
  const epochNano = `${epochMs}000000`;

  // Selected timezone format
  const selectedTzFormatted = new Intl.DateTimeFormat("vi-VN", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);

  const selectedTzIso = formatIsoWithOffset(date, tz);
  const utcFormatted = date.toUTCString();
  const utcIso = date.toISOString();

  // RFC 2822
  const rfc2822 = date.toUTCString();

  // Relative time
  const nowMs = Date.now();
  const diffSec = Math.round((nowMs - epochMs) / 1000);
  let relativeTimeEn = "";
  let relativeTimeVi = "";

  if (Math.abs(diffSec) < 5) {
    relativeTimeEn = "Just now";
    relativeTimeVi = "Vừa xong";
  } else if (diffSec > 0) {
    if (diffSec < 60) {
      relativeTimeEn = `${diffSec} seconds ago`;
      relativeTimeVi = `${diffSec} giây trước`;
    } else if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      relativeTimeEn = `${mins} minute${mins > 1 ? "s" : ""} ago`;
      relativeTimeVi = `${mins} phút trước`;
    } else if (diffSec < 86400) {
      const hrs = Math.floor(diffSec / 3600);
      relativeTimeEn = `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
      relativeTimeVi = `${hrs} giờ trước`;
    } else {
      const days = Math.floor(diffSec / 86400);
      relativeTimeEn = `${days} day${days > 1 ? "s" : ""} ago`;
      relativeTimeVi = `${days} ngày trước`;
    }
  } else {
    const absDiff = Math.abs(diffSec);
    if (absDiff < 60) {
      relativeTimeEn = `In ${absDiff} seconds`;
      relativeTimeVi = `Sau ${absDiff} giây nữa`;
    } else if (absDiff < 3600) {
      const mins = Math.floor(absDiff / 60);
      relativeTimeEn = `In ${mins} minute${mins > 1 ? "s" : ""}`;
      relativeTimeVi = `Sau ${mins} phút nữa`;
    } else if (absDiff < 86400) {
      const hrs = Math.floor(absDiff / 3600);
      relativeTimeEn = `In ${hrs} hour${hrs > 1 ? "s" : ""}`;
      relativeTimeVi = `Sau ${hrs} giờ nữa`;
    } else {
      const days = Math.floor(absDiff / 86400);
      relativeTimeEn = `In ${days} day${days > 1 ? "s" : ""}`;
      relativeTimeVi = `Sau ${days} ngày nữa`;
    }
  }

  // Day of year, week of year, leap year
  const parts = getDatePartsInTimezone(date, tz);
  const year = parts.year;
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalDaysInYear = isLeapYear ? 366 : 365;

  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const currentUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOfYear = Math.floor((currentUtc.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const weekOfYear = Math.ceil((dayOfYear + startOfYear.getUTCDay()) / 7);

  // Day of week
  const dayOfWeekEn = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(date);
  const dayOfWeekVi = new Intl.DateTimeFormat("vi-VN", { timeZone: tz, weekday: "long" }).format(date);

  return {
    date,
    epochSeconds,
    epochMillis: epochMs,
    epochMicro,
    epochNano,
    selectedTzFormatted,
    selectedTzIso,
    utcFormatted,
    utcIso,
    rfc2822,
    relativeTimeVi,
    relativeTimeEn,
    dayOfYear,
    totalDaysInYear,
    weekOfYear,
    isLeapYear,
    dayOfWeekVi,
    dayOfWeekEn,
  };
}

/**
 * Parse an arbitrary date string (ISO, standard formats, DD/MM/YYYY, etc.)
 */
export function parseDateInputString(inputStr: string, tz: string): DateParts | null {
  const trimmed = inputStr.trim();
  if (!trimmed) return null;

  // 1. Try ISO / YYYY-MM-DD HH:mm:ss (or with T, /, .)
  const ymdRegex = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/;
  const ymdMatch = trimmed.match(ymdRegex);
  if (ymdMatch) {
    return {
      year: parseInt(ymdMatch[1], 10),
      month: parseInt(ymdMatch[2], 10),
      day: parseInt(ymdMatch[3], 10),
      hour: ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0,
      minute: ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0,
      second: ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0,
      millisecond: ymdMatch[7] ? parseInt(ymdMatch[7].padEnd(3, "0"), 10) : 0,
    };
  }

  // 2. Try DD/MM/YYYY or DD-MM-YYYY [HH:mm:ss]
  const dmyRegex = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/;
  const dmyMatch = trimmed.match(dmyRegex);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    let day = part1;
    let month = part2;
    if (part1 <= 12 && part2 > 12) {
      month = part1;
      day = part2;
    }
    return {
      year,
      month,
      day,
      hour: dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0,
      minute: dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0,
      second: dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0,
      millisecond: dmyMatch[7] ? parseInt(dmyMatch[7].padEnd(3, "0"), 10) : 0,
    };
  }

  // 3. Try JavaScript native Date.parse
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return getDatePartsInTimezone(new Date(parsed), tz);
  }

  return null;
}

/**
 * Format DateParts into standard human-readable format YYYY-MM-DD HH:mm:ss
 */
export function formatDatePartsToString(parts: DateParts): string {
  const Y = String(parts.year).padStart(4, "0");
  const M = String(parts.month).padStart(2, "0");
  const D = String(parts.day).padStart(2, "0");
  const h = String(parts.hour).padStart(2, "0");
  const m = String(parts.minute).padStart(2, "0");
  const s = String(parts.second).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

/**
 * Format DateParts into HTML5 datetime-local string (YYYY-MM-DDTHH:mm:ss)
 */
export function formatDatePartsToLocalInput(parts: DateParts): string {
  const Y = String(parts.year).padStart(4, "0");
  const M = String(parts.month).padStart(2, "0");
  const D = String(parts.day).padStart(2, "0");
  const h = String(parts.hour).padStart(2, "0");
  const m = String(parts.minute).padStart(2, "0");
  const s = String(parts.second).padStart(2, "0");
  return `${Y}-${M}-${D}T${h}:${m}:${s}`;
}

/**
 * Parse HTML5 datetime-local value (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss) to DateParts
 */
export function parseLocalInputToDateParts(val: string): DateParts | null {
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    hour: parseInt(match[4], 10),
    minute: parseInt(match[5], 10),
    second: match[6] ? parseInt(match[6], 10) : 0,
    millisecond: 0,
  };
}

