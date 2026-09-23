import { describe, it, expect } from "vitest";
import {
  autoDetectUnit,
  toMilliseconds,
  datePartsToEpoch,
  getDatePartsInTimezone,
  parseDateInputString,
  getDetailedFormattedDate,
  getTimezoneOffset,
  formatDatePartsToLocalInput,
  parseLocalInputToDateParts,
  getAllSupportedTimezones,
  formatDatePartsToString,
} from "../timestampUtils";

describe("timestampUtils", () => {
  it("correctly auto-detects unit based on digit length", () => {
    expect(autoDetectUnit("1700000000")).toBe("seconds");
    expect(autoDetectUnit("1700000000000")).toBe("milliseconds");
    expect(autoDetectUnit("1700000000000000")).toBe("microseconds");
    expect(autoDetectUnit("1700000000000000000")).toBe("nanoseconds");
  });

  it("converts timestamps of various units to milliseconds", () => {
    expect(toMilliseconds("1700000000", "seconds").ms).toBe(1700000000000);
    expect(toMilliseconds("1700000000000", "milliseconds").ms).toBe(1700000000000);
    expect(toMilliseconds("1700000000000000", "microseconds").ms).toBe(1700000000000);
    expect(toMilliseconds("1700000000000000000", "nanoseconds").ms).toBe(1700000000000);
    // Auto detection
    expect(toMilliseconds("1700000000").ms).toBe(1700000000000);
    expect(toMilliseconds("1700000000000").ms).toBe(1700000000000);
  });

  it("converts DateParts to exact UTC Epoch across different timezones", () => {
    // 2026-09-23 15:00:00 in Vietnam (UTC+7) is 2026-09-23 08:00:00 UTC
    const resVN = datePartsToEpoch(
      { year: 2026, month: 9, day: 23, hour: 15, minute: 0, second: 0, millisecond: 0 },
      "Asia/Ho_Chi_Minh"
    );
    expect(resVN.isoUtc).toBe("2026-09-23T08:00:00.000Z");
    expect(resVN.seconds).toBe(Math.floor(new Date("2026-09-23T08:00:00.000Z").getTime() / 1000));

    // 2026-09-23 15:00:00 in UTC is 2026-09-23 15:00:00 UTC
    const resUTC = datePartsToEpoch(
      { year: 2026, month: 9, day: 23, hour: 15, minute: 0, second: 0, millisecond: 0 },
      "UTC"
    );
    expect(resUTC.isoUtc).toBe("2026-09-23T15:00:00.000Z");

    // 2026-09-23 15:00:00 in New York (EDT, UTC-4) is 2026-09-23 19:00:00 UTC
    const resNY = datePartsToEpoch(
      { year: 2026, month: 9, day: 23, hour: 15, minute: 0, second: 0, millisecond: 0 },
      "America/New_York"
    );
    expect(resNY.isoUtc).toBe("2026-09-23T19:00:00.000Z");
  });

  it("extracts DateParts from Date in target timezone", () => {
    // 08:00:00 UTC corresponds to 15:00:00 in Asia/Ho_Chi_Minh
    const date = new Date("2026-09-23T08:00:00.000Z");
    const partsVN = getDatePartsInTimezone(date, "Asia/Ho_Chi_Minh");
    expect(partsVN.year).toBe(2026);
    expect(partsVN.month).toBe(9);
    expect(partsVN.day).toBe(23);
    expect(partsVN.hour).toBe(15);
    expect(partsVN.minute).toBe(0);
    expect(partsVN.second).toBe(0);
  });

  it("parses date input strings accurately", () => {
    const parts = parseDateInputString("2026-09-23 15:30:45", "UTC");
    expect(parts).not.toBeNull();
    expect(parts?.year).toBe(2026);
    expect(parts?.month).toBe(9);
    expect(parts?.day).toBe(23);
    expect(parts?.hour).toBe(15);
    expect(parts?.minute).toBe(30);
    expect(parts?.second).toBe(45);
  });

  it("formats detailed date outputs including leap year and relative times", () => {
    const epochMs = new Date("2026-09-23T08:00:00.000Z").getTime();
    const details = getDetailedFormattedDate(epochMs, "Asia/Ho_Chi_Minh");
    expect(details).not.toBeNull();
    expect(details?.utcIso).toBe("2026-09-23T08:00:00.000Z");
    expect(details?.epochSeconds).toBe(Math.floor(epochMs / 1000));
    expect(details?.isLeapYear).toBe(false); // 2026 is not leap
    expect(details?.totalDaysInYear).toBe(365);
  });

  it("retrieves valid timezone offsets", () => {
    const ref = new Date("2026-09-23T08:00:00.000Z");
    const offsetVN = getTimezoneOffset("Asia/Ho_Chi_Minh", ref);
    expect(offsetVN.offsetStr).toBe("UTC+07:00");
    expect(offsetVN.offsetMinutes).toBe(420);

    const offsetUTC = getTimezoneOffset("UTC", ref);
    expect(offsetUTC.offsetStr).toBe("UTC+00:00");
    expect(offsetUTC.offsetMinutes).toBe(0);
  });

  it("formats DateParts to HTML5 datetime-local string and parses back", () => {
    const parts = { year: 2026, month: 9, day: 23, hour: 15, minute: 30, second: 45, millisecond: 0 };
    const formatted = formatDatePartsToLocalInput(parts);
    expect(formatted).toBe("2026-09-23T15:30:45");

    const parsed = parseLocalInputToDateParts(formatted);
    expect(parsed).not.toBeNull();
    expect(parsed?.year).toBe(2026);
    expect(parsed?.month).toBe(9);
    expect(parsed?.day).toBe(23);
    expect(parsed?.hour).toBe(15);
    expect(parsed?.minute).toBe(30);
    expect(parsed?.second).toBe(45);
  });

  it("retrieves a populated list of supported timezones with offsets", () => {
    const tzs = getAllSupportedTimezones();
    expect(tzs.length).toBeGreaterThan(10);
    const hasUTC = tzs.some((tz) => tz.id === "UTC");
    expect(hasUTC).toBe(true);
  });

  it("formats DateParts to readable string YYYY-MM-DD HH:mm:ss", () => {
    const parts = { year: 2026, month: 9, day: 23, hour: 15, minute: 30, second: 0, millisecond: 0 };
    expect(formatDatePartsToString(parts)).toBe("2026-09-23 15:30:00");
  });

  it("parses DD/MM/YYYY format accurately", () => {
    const parts = parseDateInputString("23/09/2026 15:30:00", "UTC");
    expect(parts).not.toBeNull();
    expect(parts?.year).toBe(2026);
    expect(parts?.month).toBe(9);
    expect(parts?.day).toBe(23);
    expect(parts?.hour).toBe(15);
    expect(parts?.minute).toBe(30);
  });
});
