import { describe, it, expect } from "vitest";
import {
  generateAllPairs,
  calculateCartesianProduct,
  generatePairwiseTestCases,
  getExcludedCombinations,
  exportPairwiseToMarkdown,
  exportPairwiseToCsv,
  exportPairwiseToJson,
  PAIRWISE_PRESETS,
  ParameterDef,
} from "../pairwiseEngine";

describe("pairwiseEngine", () => {
  it("calculates Cartesian product correctly", () => {
    const params: ParameterDef[] = [
      { id: "1", name: "A", values: ["a1", "a2"] },
      { id: "2", name: "B", values: ["b1", "b2", "b3"] },
      { id: "3", name: "C", values: ["c1", "c2"] },
    ];
    // 2 * 3 * 2 = 12
    expect(calculateCartesianProduct(params)).toBe(12);
  });

  it("generates correct number of 2-way pairs", () => {
    const params: ParameterDef[] = [
      { id: "1", name: "A", values: ["a1", "a2"] },
      { id: "2", name: "B", values: ["b1", "b2", "b3"] },
      { id: "3", name: "C", values: ["c1", "c2"] },
    ];
    // pairs(A,B) = 2*3 = 6
    // pairs(A,C) = 2*2 = 4
    // pairs(B,C) = 3*2 = 6
    // total pairs = 16
    const pairs = generateAllPairs(params);
    expect(pairs.size).toBe(16);
  });

  it("covers 100% of 2-way pairs with significant reduction", () => {
    const preset = PAIRWISE_PRESETS[0]; // E-Commerce: 4 * 4 * 5 * 4 * 3 = 960 full combinations
    expect(preset.parameters.length).toBe(5);

    const fullProduct = calculateCartesianProduct(preset.parameters);
    expect(fullProduct).toBe(960);

    const result = generatePairwiseTestCases(preset.parameters);
    expect(result.coveredPairs).toBe(result.totalPairs);
    expect(result.testCases.length).toBeLessThan(40); // All-pairs should reduce 960 down to ~25-30 cases
    expect(result.reductionPercentage).toBeGreaterThan(90); // >90% reduction
  });

  it("handles edge case with fewer than 2 parameters", () => {
    const singleParam: ParameterDef[] = [{ id: "1", name: "A", values: ["a1", "a2"] }];
    const res = generatePairwiseTestCases(singleParam);
    expect(res.testCases.length).toBe(2);
    expect(res.reductionPercentage).toBe(0);

    const emptyRes = generatePairwiseTestCases([]);
    expect(emptyRes.testCases.length).toBe(0);
  });

  it("exports correctly to Markdown, CSV, and JSON", () => {
    const params: ParameterDef[] = [
      { id: "1", name: "OS", values: ["Win", "Mac"] },
      { id: "2", name: "Browser", values: ["Chrome", "Firefox"] },
    ];
    const res = generatePairwiseTestCases(params);

    const md = exportPairwiseToMarkdown(res.parameters, res.testCases);
    expect(md).toContain("| # | OS | Browser |");
    expect(md).toContain("| 1 |");

    const csv = exportPairwiseToCsv(res.parameters, res.testCases);
    expect(csv).toContain("Case #,OS,Browser");

    const json = exportPairwiseToJson(res.parameters, res.testCases);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(res.testCases.length);
    expect(parsed[0].caseId).toBe(1);
    expect(parsed[0].OS).toBeDefined();
  });

  it("calculates excluded test cases count and retrieves pruned combinations", () => {
    const params: ParameterDef[] = [
      { id: "1", name: "A", values: ["a1", "a2"] },
      { id: "2", name: "B", values: ["b1", "b2", "b3"] },
      { id: "3", name: "C", values: ["c1", "c2"] },
    ];
    // Cartesian = 2 * 3 * 2 = 12
    const res = generatePairwiseTestCases(params);
    expect(res.excludedCount).toBe(12 - res.testCases.length);
    expect(res.excludedCount).toBeGreaterThan(0);

    const { excludedCases, totalExcluded, isTruncated } = getExcludedCombinations(params, res.testCases, 100);
    expect(totalExcluded).toBe(res.excludedCount);
    expect(excludedCases.length).toBe(res.excludedCount);
    expect(isTruncated).toBe(false);

    // Verify none of the excluded cases are in the pairwise set, and check coverage details
    for (const exc of excludedCases) {
      const match = res.testCases.some(
        (tc) => tc.A === exc.A && tc.B === exc.B && tc.C === exc.C
      );
      expect(match).toBe(false);
      expect(exc.coveringCaseIds.length).toBeGreaterThan(0);
      expect(exc.totalPairs).toBe(3); // 3*(3-1)/2 = 3 pairs
      expect(exc.pairsDetail.length).toBe(3);
      expect(exc.reasonVi).toContain("100% cặp tương tác");

      // Verify each coveringCaseId is valid 1-indexed case
      for (const cId of exc.coveringCaseIds) {
        expect(cId).toBeGreaterThanOrEqual(1);
        expect(cId).toBeLessThanOrEqual(res.testCases.length);
      }
    }

    // Verify exporting excluded cases includes coverage and reason columns
    const csv = exportPairwiseToCsv(params, excludedCases);
    expect(csv).toContain("Trạng thái,Được phủ bởi,Lý do");
    expect(csv).toContain("Đã loại trừ");
    expect(csv).toContain("Case #");

    const md = exportPairwiseToMarkdown(params, excludedCases);
    expect(md).toContain("| Được phủ bởi | Lý do loại trừ |");

    const json = exportPairwiseToJson(params, excludedCases);
    const parsedJson = JSON.parse(json);
    expect(parsedJson[0]._status).toBe("excluded");
    expect(parsedJson[0]._coveredByCases.length).toBeGreaterThan(0);
    expect(parsedJson[0]._reason).toBeDefined();
  });

  it("respects incompatible 2-way constraints and removes invalid pairs", () => {
    const params: ParameterDef[] = [
      { id: "1", name: "OS", values: ["Windows", "macOS"] },
      { id: "2", name: "Browser", values: ["Chrome", "Safari", "Edge"] },
      { id: "3", name: "Device", values: ["Laptop", "Desktop"] },
    ];

    // Constraint: Windows Desktop does not support Safari
    const constraints = [
      {
        id: "c1",
        name: "Safari on Windows not supported",
        type: "incompatible" as const,
        enabled: true,
        conditions: [
          { paramName: "OS", operator: "equals" as const, value: "Windows" },
          { paramName: "Browser", operator: "equals" as const, value: "Safari" },
        ],
      },
    ];

    const result = generatePairwiseTestCases(params, constraints);

    // Verify that NO generated test case contains both Windows and Safari
    for (const tc of result.testCases) {
      if (tc.OS === "Windows") {
        expect(tc.Browser).not.toBe("Safari");
      }
    }

    // Verify excluded combinations tag this constraint violation
    const { excludedCases } = getExcludedCombinations(params, result.testCases, 100, constraints);
    const violations = excludedCases.filter((c) => c.isConstraintViolation);
    expect(violations.length).toBeGreaterThan(0);
    for (const v of violations) {
      expect(v.values.OS).toBe("Windows");
      expect(v.values.Browser).toBe("Safari");
      expect(v.violatedConstraintName).toBe("Safari on Windows not supported");
      expect(v.reasonVi).toContain("Bị loại trừ do vi phạm ràng buộc");
    }
  });

  it("respects conditional if-then constraints (e.g. Guest role requires 2FA Disabled)", () => {
    const params: ParameterDef[] = [
      { id: "1", name: "Role", values: ["Admin", "Guest", "Member"] },
      { id: "2", name: "2FA", values: ["Enabled", "Disabled"] },
      { id: "3", name: "Platform", values: ["Web", "Mobile"] },
    ];

    // IF Role = Guest THEN 2FA = Disabled
    const constraints = [
      {
        id: "c_guest_2fa",
        name: "Guest must have 2FA Disabled",
        type: "if_then" as const,
        enabled: true,
        conditions: [
          { paramName: "Role", operator: "equals" as const, value: "Guest" },
        ],
        thenClause: {
          paramName: "2FA",
          operator: "equals" as const,
          value: "Disabled",
        },
      },
    ];

    const result = generatePairwiseTestCases(params, constraints);

    for (const tc of result.testCases) {
      if (tc.Role === "Guest") {
        expect(tc["2FA"]).toBe("Disabled");
      }
    }
  });

  it("handles 3-condition constraints (user's specific request: A combined with B cannot use C)", () => {
    // User scenario: A, B, C. When A = a1 AND B = b1, condition C = c1 cannot be used!
    const params: ParameterDef[] = [
      { id: "1", name: "ConditionA", values: ["a1", "a2"] },
      { id: "2", name: "ConditionB", values: ["b1", "b2"] },
      { id: "3", name: "ConditionC", values: ["c1", "c2"] },
    ];

    const constraints = [
      {
        id: "c_tri_rule",
        name: "A1 + B1 cannot use C1",
        type: "incompatible" as const,
        enabled: true,
        conditions: [
          { paramName: "ConditionA", operator: "equals" as const, value: "a1" },
          { paramName: "ConditionB", operator: "equals" as const, value: "b1" },
          { paramName: "ConditionC", operator: "equals" as const, value: "c1" },
        ],
      },
    ];

    const result = generatePairwiseTestCases(params, constraints);

    // Verify that NO test case has A=a1, B=b1, and C=c1 simultaneously
    for (const tc of result.testCases) {
      const isForbiddenTriple =
        tc.ConditionA === "a1" && tc.ConditionB === "b1" && tc.ConditionC === "c1";
      expect(isForbiddenTriple).toBe(false);
    }

    // Verify excluded combinations tag this forbidden combo as constraint violation
    const { excludedCases } = getExcludedCombinations(params, result.testCases, 100, constraints);
    const forbiddenTripleCase = excludedCases.find(
      (c) => c.values.ConditionA === "a1" && c.values.ConditionB === "b1" && c.values.ConditionC === "c1"
    );
    expect(forbiddenTripleCase).toBeDefined();
    expect(forbiddenTripleCase?.isConstraintViolation).toBe(true);
    expect(forbiddenTripleCase?.violatedConstraintName).toBe("A1 + B1 cannot use C1");
  });
});
