import * as XLSX from "xlsx";
import { TestCase, DeconstructionResult, AuditResult } from "./types";

/**
 * Downloads a Blob or text content directly in browser or desktop webview
 */
export function downloadFile(filename: string, content: string | Uint8Array, mimeType: string) {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports test suite to a multi-sheet Excel (.xlsx) file with:
 * - Sheet 1: Test Cases (with formatted headers, auto-filters)
 * - Sheet 2: RTM Traceability Matrix
 * - Sheet 3: Clarification Questions Log
 */
export function exportToExcel(
  testCases: TestCase[],
  deconstruction: DeconstructionResult,
  auditResult: AuditResult,
  filename?: string
): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Test Cases
  const tcRows = testCases.map((tc) => ({
    "Test ID": tc.id,
    "Module / Feature": tc.module,
    "Category": tc.category.toUpperCase(),
    "Priority": tc.priority,
    "Requirement ID": tc.reqId,
    "Test Title": tc.title,
    "Pre-conditions": tc.preconditions,
    "Test Data": tc.testData,
    "Steps": tc.steps.join("\n"),
    "Expected Result": tc.expectedResult,
  }));

  const wsTestCases = XLSX.utils.json_to_sheet(tcRows);
  // Set column widths for comfortable reading
  wsTestCases["!cols"] = [
    { wch: 15 }, // Test ID
    { wch: 22 }, // Module
    { wch: 14 }, // Category
    { wch: 10 }, // Priority
    { wch: 16 }, // Req ID
    { wch: 35 }, // Title
    { wch: 30 }, // Preconditions
    { wch: 25 }, // Test Data
    { wch: 45 }, // Steps
    { wch: 45 }, // Expected Result
  ];

  // Auto-filter range
  if (tcRows.length > 0) {
    wsTestCases["!autofilter"] = {
      ref: `A1:J${tcRows.length + 1}`,
    };
  }

  XLSX.utils.book_append_sheet(wb, wsTestCases, "Test Cases");

  // 2. Sheet 2: RTM Traceability Matrix
  const rtmRows = auditResult.rtmMatrix.map((r) => ({
    "Requirement ID": r.reqId,
    "Requirement Title": r.reqTitle,
    "Happy Path Covered": r.hasHappyPath ? "YES" : "NO",
    "Negative / Boundary Covered": r.hasNegative ? "YES" : "NO",
    "Overall Covered": r.isCovered ? "PASS (100%)" : "INCOMPLETE",
    "Linked Test Cases": r.testCaseIds.join(", "),
  }));

  const wsRTM = XLSX.utils.json_to_sheet(rtmRows);
  wsRTM["!cols"] = [
    { wch: 16 },
    { wch: 40 },
    { wch: 20 },
    { wch: 25 },
    { wch: 18 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRTM, "RTM Matrix");

  // 3. Sheet 3: Clarification Questions Log
  const qRows = deconstruction.clarificationQuestions.map((q) => ({
    "Question ID": q.id,
    "Question Description": q.question,
    "Impact Level": q.impact,
    "Document Context": q.context,
    "Status": q.status.toUpperCase(),
    "BA / QA Clarification": q.answer || "",
  }));

  const wsQuestions = XLSX.utils.json_to_sheet(qRows);
  wsQuestions["!cols"] = [
    { wch: 14 },
    { wch: 50 },
    { wch: 14 },
    { wch: 40 },
    { wch: 14 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, "Clarification Log");

  // Generate buffer and trigger download
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const finalName = filename || `${deconstruction.moduleName.replace(/[^a-zA-Z0-9_-]/g, "_")}_TestCases.xlsx`;
  downloadFile(finalName, new Uint8Array(excelBuffer), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/**
 * Exports to Jira Xray / Zephyr compatible CSV format
 */
export function exportToJiraXrayCsv(testCases: TestCase[], moduleName: string): string {
  const headers = [
    "Test Key",
    "Issue Type",
    "Summary",
    "Description",
    "Priority",
    "Requirement Key",
    "Preconditions",
    "Action",
    "Data",
    "Expected Result",
  ];

  const rows: string[] = [headers.join(",")];

  for (const tc of testCases) {
    const action = tc.steps.join(" \n ");
    const cells = [
      tc.id,
      "Test",
      `"${tc.title.replace(/"/g, '""')}"`,
      `"Category: ${tc.category.toUpperCase()} | Module: ${tc.module || moduleName}"`,
      tc.priority,
      tc.reqId,
      `"${tc.preconditions.replace(/"/g, '""')}"`,
      `"${action.replace(/"/g, '""')}"`,
      `"${tc.testData.replace(/"/g, '""')}"`,
      `"${tc.expectedResult.replace(/"/g, '""')}"`,
    ];
    rows.push(cells.join(","));
  }

  return rows.join("\n");
}

/**
 * Exports to TestRail compatible CSV format
 */
export function exportToTestRailCsv(testCases: TestCase[]): string {
  const headers = [
    "Section",
    "Title",
    "Type",
    "Priority",
    "Preconditions",
    "Steps",
    "Expected Result",
  ];

  const rows: string[] = [headers.join(",")];

  for (const tc of testCases) {
    const stepsFormatted = tc.steps.join("\n");
    const cells = [
      `"${tc.module.replace(/"/g, '""')}"`,
      `"${tc.title.replace(/"/g, '""')}"`,
      `"${tc.category.toUpperCase()}"`,
      tc.priority,
      `"${tc.preconditions.replace(/"/g, '""')}"`,
      `"${stepsFormatted.replace(/"/g, '""')}"`,
      `"${tc.expectedResult.replace(/"/g, '""')}"`,
    ];
    rows.push(cells.join(","));
  }

  return rows.join("\n");
}

/**
 * Converts test cases into BDD Gherkin (.feature) format
 */
export function exportToBddFeature(testCases: TestCase[], moduleName: string): string {
  const lines: string[] = [];
  lines.push(`Feature: ${moduleName}`);
  lines.push(`  As a QA Engineer and Automation Developer`);
  lines.push(`  I want comprehensive automated scenarios covering ISTQB acceptance criteria\n`);

  for (const tc of testCases) {
    lines.push(`  @${tc.category} @${tc.priority} @${tc.reqId}`);
    lines.push(`  Scenario: ${tc.title} (${tc.id})`);
    lines.push(`    Given ${tc.preconditions}`);
    if (tc.testData) {
      lines.push(`    And test data payload: "${tc.testData}"`);
    }

    if (tc.steps.length > 0) {
      lines.push(`    When ${tc.steps[0].replace(/^\d+\.\s*/, "")}`);
      for (let s = 1; s < tc.steps.length; s++) {
        lines.push(`    And ${tc.steps[s].replace(/^\d+\.\s*/, "")}`);
      }
    } else {
      lines.push(`    When user performs the required workflow action`);
    }

    lines.push(`    Then ${tc.expectedResult}\n`);
  }

  return lines.join("\n");
}

/**
 * Generates an executive Markdown audit and summary report
 */
export function generateMarkdownReport(
  testCases: TestCase[],
  deconstruction: DeconstructionResult,
  auditResult: AuditResult
): string {
  const categoryCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};

  testCases.forEach((tc) => {
    categoryCounts[tc.category] = (categoryCounts[tc.category] || 0) + 1;
    priorityCounts[tc.priority] = (priorityCounts[tc.priority] || 0) + 1;
  });

  const lines: string[] = [];
  lines.push(`# BÁO CÁO PHÂN TÍCH VÀ KIỂM THỬ: ${deconstruction.moduleName.toUpperCase()}`);
  lines.push(`*Generated by AI Test Case Generation Agent (ISTQB Compliant)*\n`);

  lines.push(`## 1. Tổng Quan & Số Liệu Bao Phủ (Coverage Summary)`);
  lines.push(`- **Tổng số ca kiểm thử:** ${testCases.length}`);
  lines.push(`- **Tỷ lệ bao phủ RTM:** **${auditResult.coveragePercentage}%** (${auditResult.coveredACs}/${auditResult.totalACs} Acceptance Criteria)`);
  lines.push(`- **Số ca kiểm thử đã loại trùng:** ${auditResult.deduplicatedCount}`);
  lines.push(``);

  lines.push(`### Phân bố theo Danh mục (Categories):`);
  lines.push(`| Danh mục | Số lượng | Tỷ lệ |`);
  lines.push(`| :--- | :--- | :--- |`);
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    lines.push(`| **${cat.toUpperCase()}** | ${count} | ${Math.round((count / testCases.length) * 100)}% |`);
  });

  lines.push(`\n### Phân bố theo Mức độ ưu tiên (Priority):`);
  lines.push(`| Mức độ | Ý nghĩa | Số lượng |`);
  lines.push(`| :--- | :--- | :--- |`);
  lines.push(`| **P1** | Critical / Auth / Blocker | ${priorityCounts["P1"] || 0} |`);
  lines.push(`| **P2** | High / Primary Happy Paths | ${priorityCounts["P2"] || 0} |`);
  lines.push(`| **P3** | Medium / Boundary & Negative | ${priorityCounts["P3"] || 0} |`);
  lines.push(`| **P4** | Low / Minor Edge Cases | ${priorityCounts["P4"] || 0} |`);

  lines.push(`\n## 2. Ma Trận Truy Vết Yêu Cầu (Requirement Traceability Matrix - RTM)`);
  lines.push(`| Req ID | Tiêu chí chấp thuận (AC) | Happy Path | Negative / Boundary | Trạng thái | Linked Test IDs |`);
  lines.push(`| :--- | :--- | :---: | :---: | :---: | :--- |`);
  auditResult.rtmMatrix.forEach((r) => {
    lines.push(
      `| **${r.reqId}** | ${r.reqTitle} | ${r.hasHappyPath ? "✅" : "❌"} | ${r.hasNegative ? "✅" : "❌"} | **${
        r.isCovered ? "PASS" : "INCOMPLETE"
      }** | \`${r.testCaseIds.join(", ")}\` |`
    );
  });

  if (deconstruction.clarificationQuestions.length > 0) {
    lines.push(`\n## 3. Nhật Ký Câu Hỏi Làm Rõ Nghiệp Vụ (Clarification Questions Log)`);
    lines.push(`| Mã | Câu hỏi cần BA/Product làm rõ | Mức ảnh hưởng | Ngữ cảnh | Trạng thái |`);
    lines.push(`| :--- | :--- | :---: | :--- | :---: |`);
    deconstruction.clarificationQuestions.forEach((q) => {
      lines.push(`| **${q.id}** | ${q.question} | ${q.impact} | ${q.context} | ${q.status.toUpperCase()} |`);
    });
  }

  if (auditResult.hallucinationWarnings.length > 0) {
    lines.push(`\n## 4. Cảnh Báo Kiểm Soát Ảo Giác (Hallucination Guardrails)`);
    auditResult.hallucinationWarnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
  }

  return lines.join("\n");
}
