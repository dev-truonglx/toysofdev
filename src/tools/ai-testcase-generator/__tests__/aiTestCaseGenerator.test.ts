import { describe, it, expect } from "vitest";
import {
  htmlTableToMarkdown,
  reduceDocumentNoise,
  chunkDocumentSemantically,
  ingestDocument,
} from "../documentParser";
import { extractDeconstructionFallback } from "../specAnalystEngine";
import { generateOfflineTestSuite } from "../multiTierEngine";
import {
  deduplicateTestCases,
  checkHallucinations,
  runAuditEngine,
} from "../auditEngine";
import {
  exportToJiraXrayCsv,
  exportToTestRailCsv,
  exportToBddFeature,
  generateMarkdownReport,
} from "../exportEngine";
import { extractJsonFromText } from "../../../services/aiService";
import { DEFAULT_PREFERENCES, TestCase } from "../types";

describe("AI Test Case Generator Suite", () => {
  describe("Module 1: Document Ingestion & Parser", () => {
    it("converts HTML tables to Markdown tables accurately", () => {
      const html = `
        <p>Field specification:</p>
        <table>
          <tr><th>Field Name</th><th>Data Type</th><th>Min</th><th>Max</th></tr>
          <tr><td>username</td><td>string</td><td>3</td><td>20</td></tr>
          <tr><td>age</td><td>number</td><td>18</td><td>65</td></tr>
        </table>
      `;
      const md = htmlTableToMarkdown(html);
      expect(md).toContain("| Field Name | Data Type | Min | Max |");
      expect(md).toContain("| --- | --- | --- | --- |");
      expect(md).toContain("| username | string | 3 | 20 |");
      expect(md).toContain("| age | number | 18 | 65 |");
    });

    it("reduces document administrative noise (sign-offs & revision history)", () => {
      const noisyText = `
# Specification for Checkout
Revision History:
v1.0 - Initial draft approved by John Doe.
v1.1 - Signed off by Legal Dept.

## Business Rules
- User must pay with credit card.
- Minimum order value is $10.
`;
      const cleaned = reduceDocumentNoise(noisyText);
      expect(cleaned).not.toContain("Initial draft approved by John Doe");
      expect(cleaned).toContain("User must pay with credit card");
      expect(cleaned).toContain("Minimum order value is $10");
    });

    it("chunks document semantically based on headings", () => {
      const spec = `
# Module: Authentication
User can login with email and password.

## Business Rules
Password length must be between 8 and 32 characters.

## RBAC Matrix
Admin has full control.
`;
      const chunks = chunkDocumentSemantically(spec);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some((c) => c.title.includes("Authentication"))).toBe(true);
      expect(chunks.some((c) => c.sectionType === "rules" || c.title.includes("Business Rules"))).toBe(true);
    });

    it("ingests raw text and counts tables", async () => {
      const text = `
Feature: Payment
| Method | Enabled |
|---|---|
| Card | Yes |
| Cash | No |
`;
      const result = await ingestDocument(text, "Payment_Spec.md");
      expect(result.metadata.tableCount).toBe(1);
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe("Module 2: Spec Analyst Engine", () => {
    it("deconstructs text into flows, rules, acceptance criteria, and clarification questions", () => {
      const sample = `
Feature: Customer Registration
Tên khách hàng: bắt buộc, tối thiểu 2 ký tự và tối đa 50 ký tự.
Email liên hệ: định dạng chuẩn RFC 5322.
Số điện thoại: 10 chữ số.
Hệ thống xử lý giao dịch tức thì và lưu trữ an toàn.
`;
      const decomp = extractDeconstructionFallback(sample);
      expect(decomp.flows.length).toBe(3); // Main, Alternative, Exception
      expect(decomp.flows.some((f) => f.type === "main")).toBe(true);
      expect(decomp.flows.some((f) => f.type === "exception")).toBe(true);

      expect(decomp.businessRules.length).toBeGreaterThan(0);
      expect(decomp.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(decomp.acceptanceCriteria[0].id).toMatch(/^REQ_\d{3}$/);

      // Ambiguity detection for "tức thì"
      expect(decomp.clarificationQuestions.some((q) => q.question.includes("tức thì"))).toBe(true);
    });
  });

  describe("Module 3: Multi-Tier Test Generation", () => {
    it("generates ISTQB-compliant test cases with concrete data values", () => {
      const sample = `
Feature: User Profile
Tên hiển thị: từ 6 đến 30 ký tự.
`;
      const decomp = extractDeconstructionFallback(sample);
      const testCases = generateOfflineTestSuite(decomp, DEFAULT_PREFERENCES);

      expect(testCases.length).toBeGreaterThan(5);

      // Verify categories
      const categories = new Set(testCases.map((c) => c.category));
      expect(categories.has("functional")).toBe(true);
      expect(categories.has("boundary")).toBe(true);
      expect(categories.has("negative")).toBe(true);
      expect(categories.has("security")).toBe(true);
      expect(categories.has("rbac")).toBe(true);

      // Verify BVA concrete data (not abstract)
      const bvaCases = testCases.filter((c) => c.category === "boundary");
      expect(bvaCases.some((c) => c.bvaPoint === "min" || c.bvaPoint === "min-1")).toBe(true);
      for (const bCase of bvaCases) {
        expect(bCase.testData.length).toBeGreaterThan(0);
        expect(bCase.testData.toLowerCase()).not.toBe("maximum value");
      }

      // Verify negative cases (double-click, session expiry)
      const negativeCases = testCases.filter((c) => c.category === "negative");
      expect(negativeCases.some((c) => c.title.toLowerCase().includes("double-click") || c.title.toLowerCase().includes("back"))).toBe(true);

      // Verify security cases (SQLi, XSS)
      const securityCases = testCases.filter((c) => c.category === "security");
      expect(securityCases.some((c) => c.testData.includes("' OR '1'='1'"))).toBe(true);
      expect(securityCases.some((c) => c.testData.includes("<script>"))).toBe(true);
    });
  });

  describe("Module 4: Quality & Audit Engine", () => {
    it("deduplicates identical test cases", () => {
      const baseCase: TestCase = {
        id: "TC_FUN_001",
        module: "Auth",
        category: "functional",
        priority: "P1",
        reqId: "REQ_001",
        title: "Login success",
        preconditions: "User exists",
        testData: "admin@test.com",
        steps: ["1. Login"],
        expectedResult: "Success",
      };

      const duplicated = [baseCase, { ...baseCase, id: "TC_FUN_002" }];
      const { uniqueCases, deduplicatedCount } = deduplicateTestCases(duplicated);
      expect(uniqueCases.length).toBe(1);
      expect(deduplicatedCount).toBe(1);
    });

    it("builds RTM matrix and enforces >= 95% coverage", () => {
      const sample = `
Feature: Payment
Số thẻ: 16 chữ số.
`;
      const decomp = extractDeconstructionFallback(sample);
      const rawCases = generateOfflineTestSuite(decomp, DEFAULT_PREFERENCES);

      const { auditedCases, auditReport } = runAuditEngine(
        decomp,
        rawCases,
        sample
      );

      expect(auditReport.coveragePercentage).toBeGreaterThanOrEqual(95);
      expect(auditReport.rtmMatrix.length).toBe(decomp.acceptanceCriteria.length);
      expect(auditedCases.length).toBeGreaterThan(0);
    });

    it("detects hallucinations when terms like SMS OTP are introduced without spec grounding", () => {
      const spec = "Basic login with username and password only.";
      const cases: TestCase[] = [
        {
          id: "TC_001",
          module: "Login",
          category: "functional",
          priority: "P1",
          reqId: "REQ_001",
          title: "Verify SMS OTP verification flow",
          preconditions: "Phone linked",
          testData: "123456",
          steps: ["1. Enter OTP sent via SMS"],
          expectedResult: "OTP verified",
        },
      ];

      const warnings = checkHallucinations(cases, spec);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("Mã xác thực OTP qua SMS/Email");
    });
  });

  describe("Module 5: Export Engine", () => {
    const sample = "Feature: Test";
    const decomp = extractDeconstructionFallback(sample);
    const testCases = generateOfflineTestSuite(decomp, DEFAULT_PREFERENCES);
    const { auditReport } = runAuditEngine(decomp, testCases, sample);

    it("generates valid Jira Xray CSV format", () => {
      const csv = exportToJiraXrayCsv(testCases, "TestModule");
      expect(csv).toContain("Test Key,Issue Type,Summary,Description,Priority,Requirement Key");
      expect(csv).toContain("TC_FUN_001,Test");
    });

    it("generates valid TestRail CSV format", () => {
      const csv = exportToTestRailCsv(testCases);
      expect(csv).toContain("Section,Title,Type,Priority,Preconditions,Steps,Expected Result");
      expect(csv).toContain("FUNCTIONAL");
    });

    it("generates valid BDD Gherkin (.feature) format", () => {
      const feature = exportToBddFeature(testCases, "Authentication");
      expect(feature).toContain("Feature: Authentication");
      expect(feature).toContain("Scenario:");
      expect(feature).toContain("Given ");
      expect(feature).toContain("Then ");
    });

    it("generates an executive Markdown report", () => {
      const report = generateMarkdownReport(testCases, decomp, auditReport);
      expect(report).toContain("BÁO CÁO PHÂN TÍCH VÀ KIỂM THỬ");
      expect(report).toContain("Ma Trận Truy Vết Yêu Cầu (Requirement Traceability Matrix - RTM)");
      expect(report).toContain("Nhật Ký Câu Hỏi Làm Rõ Nghiệp Vụ");
    });
  });

  describe("AI Service JSON parsing & extraction", () => {
    it("extracts pure JSON from markdown code fences", () => {
      const rawResponse = "Here is the response:\n```json\n{\"moduleName\": \"Test\", \"count\": 42}\n```\nHope it helps!";
      const extracted = extractJsonFromText(rawResponse);
      const parsed = JSON.parse(extracted);
      expect(parsed.moduleName).toBe("Test");
      expect(parsed.count).toBe(42);
    });

    it("extracts JSON arrays from text", () => {
      const rawResponse = "Result:\n```\n[{\"id\": 1}, {\"id\": 2}]\n```";
      const extracted = extractJsonFromText(rawResponse);
      const parsed = JSON.parse(extracted);
      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe(1);
    });
  });
});
