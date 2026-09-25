import { describe, it, expect } from "vitest";
import {
  generateMatchingString,
  generateRegexTestSuite,
  exportRegexCasesToMarkdown,
  exportRegexCasesToCsv,
  REGEX_PRESETS,
} from "../regexReverseEngine";

describe("regexReverseEngine", () => {
  it("generates strings that match standard email regex", () => {
    const emailPreset = REGEX_PRESETS.find((p) => p.id === "email")!;
    const reg = new RegExp(emailPreset.pattern, emailPreset.flags);

    for (let i = 0; i < 5; i++) {
      const match = generateMatchingString(emailPreset.pattern, emailPreset.flags);
      expect(reg.test(match)).toBe(true);
    }
  });

  it("generates strings that match Vietnamese phone regex", () => {
    const vnPhonePreset = REGEX_PRESETS.find((p) => p.id === "vn-phone")!;
    const reg = new RegExp(vnPhonePreset.pattern, vnPhonePreset.flags);

    for (let i = 0; i < 5; i++) {
      const match = generateMatchingString(vnPhonePreset.pattern, vnPhonePreset.flags);
      expect(reg.test(match)).toBe(true);
    }
  });

  it("generates valid test suite with both PASS and FAIL cases", () => {
    const emailPreset = REGEX_PRESETS.find((p) => p.id === "email")!;
    const suite = generateRegexTestSuite(emailPreset.pattern, emailPreset.flags, 5, false);

    expect(suite.isValidRegex).toBe(true);
    expect(suite.testCases.length).toBeGreaterThan(5);

    const passCases = suite.testCases.filter((c) => c.expected === "PASS");
    const failCases = suite.testCases.filter((c) => c.expected === "FAIL");

    expect(passCases.length).toBeGreaterThanOrEqual(1);
    expect(failCases.length).toBeGreaterThanOrEqual(1);

    const reg = new RegExp(emailPreset.pattern, emailPreset.flags);
    // Verify each PASS case really matches
    for (const c of passCases) {
      expect(reg.test(c.value)).toBe(true);
    }
    // Verify each FAIL case really fails
    for (const c of failCases) {
      expect(reg.test(c.value)).toBe(false);
    }
  });

  it("handles invalid regular expression syntax gracefully", () => {
    const invalidPattern = "[a-z(invalid";
    const suite = generateRegexTestSuite(invalidPattern, "", 5, false);
    expect(suite.isValidRegex).toBe(false);
    expect(suite.errorMessage).toBeDefined();
    expect(suite.testCases.length).toBe(0);
  });

  it("exports test suite to Markdown and CSV", () => {
    const emailPreset = REGEX_PRESETS.find((p) => p.id === "email")!;
    const suite = generateRegexTestSuite(emailPreset.pattern, emailPreset.flags, 3, false);

    const md = exportRegexCasesToMarkdown(suite.testCases, false);
    expect(md).toContain("| # | Expected | Category | Test Input Value | Objective / Failure Reason |");

    const csv = exportRegexCasesToCsv(suite.testCases, false);
    expect(csv).toContain("CaseID,Expected,Category,TestValue,Reason");
  });
});
