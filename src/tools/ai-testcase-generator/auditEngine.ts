import { TestCase, DeconstructionResult, AuditResult, RTMEntry } from "./types";

/**
 * Computes semantic fingerprint / signature for deduplication
 */
function getTestCaseSignature(tc: TestCase): string {
  const normTitle = tc.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normData = tc.testData.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${tc.reqId}::${tc.category}::${normTitle.slice(0, 30)}::${normData.slice(0, 20)}`;
}

/**
 * Semantic deduplication engine
 */
export function deduplicateTestCases(testCases: TestCase[]): {
  uniqueCases: TestCase[];
  deduplicatedCount: number;
} {
  const seenSignatures = new Set<string>();
  const uniqueCases: TestCase[] = [];
  let deduplicatedCount = 0;

  for (const tc of testCases) {
    const signature = getTestCaseSignature(tc);
    if (seenSignatures.has(signature)) {
      deduplicatedCount++;
    } else {
      seenSignatures.add(signature);
      uniqueCases.push(tc);
    }
  }

  return { uniqueCases, deduplicatedCount };
}

/**
 * Builds the Requirement Traceability Matrix (RTM) and computes coverage
 */
export function buildRTM(
  deconstruction: DeconstructionResult,
  testCases: TestCase[]
): {
  rtmMatrix: RTMEntry[];
  coveragePercentage: number;
  coveredACs: number;
  totalACs: number;
} {
  const acList = deconstruction.acceptanceCriteria;
  const totalACs = acList.length;

  if (totalACs === 0) {
    return {
      rtmMatrix: [],
      coveragePercentage: 100,
      coveredACs: 0,
      totalACs: 0,
    };
  }

  const rtmMatrix: RTMEntry[] = acList.map((ac) => {
    const linkedCases = testCases.filter((tc) => tc.reqId === ac.id);
    const hasHappyPath = linkedCases.some(
      (tc) => tc.category === "functional" || tc.title.toLowerCase().includes("happy")
    );
    const hasNegative = linkedCases.some(
      (tc) =>
        tc.category === "negative" ||
        tc.category === "boundary" ||
        tc.category === "security" ||
        tc.title.toLowerCase().includes("invalid") ||
        tc.title.toLowerCase().includes("boundary")
    );

    return {
      reqId: ac.id,
      reqTitle: ac.title,
      hasHappyPath,
      hasNegative,
      testCaseIds: linkedCases.map((tc) => tc.id),
      isCovered: hasHappyPath && hasNegative,
    };
  });

  const coveredACs = rtmMatrix.filter((e) => e.isCovered).length;
  const coveragePercentage = Math.round((coveredACs / totalACs) * 100);

  return {
    rtmMatrix,
    coveragePercentage,
    coveredACs,
    totalACs,
  };
}

/**
 * Hallucination Guardrail:
 * Verifies that test cases do not introduce ungrounded assumptions (e.g. SMS OTP when not mentioned in spec)
 */
export function checkHallucinations(
  testCases: TestCase[],
  specText: string
): string[] {
  const warnings: string[] = [];
  const lowerSpec = specText.toLowerCase();

  const suspiciousTerms = [
    { term: "otp", desc: "Mã xác thực OTP qua SMS/Email" },
    { term: "face id", desc: "Sinh trắc học Face ID" },
    { term: "vnpay", desc: "Cổng thanh toán VNPay" },
    { term: "momo", desc: "Ví điện tử MoMo" },
    { term: "captcha", desc: "Mã kiểm tra Captcha / reCAPTCHA" },
    { term: "oauth", desc: "Đăng nhập bên thứ ba OAuth" },
  ];

  for (const st of suspiciousTerms) {
    const termPresentInSpec = lowerSpec.includes(st.term);
    if (!termPresentInSpec) {
      // Check if test cases mention this term
      const hallucinatingCases = testCases.filter((tc) => {
        const fullTcText = `${tc.title} ${tc.preconditions} ${tc.steps.join(" ")} ${tc.expectedResult}`.toLowerCase();
        return fullTcText.includes(st.term);
      });

      if (hallucinatingCases.length > 0) {
        warnings.push(
          `Cảnh báo giả định: Tài liệu đặc tả không đề cập đến '${st.desc}', nhưng có ${hallucinatingCases.length} test case (ví dụ: ${hallucinatingCases[0].id}) xuất hiện khái niệm này.`
        );
      }
    }
  }

  return warnings;
}

/**
 * Supplementary Generator:
 * If RTM coverage is below 95%, automatically synthesize complementary
 * Happy Path or Negative test cases to achieve full coverage.
 */
export function ensureFullRtmCoverage(
  deconstruction: DeconstructionResult,
  testCases: TestCase[]
): TestCase[] {
  const enrichedCases = [...testCases];
  const { rtmMatrix } = buildRTM(deconstruction, enrichedCases);
  let counter = enrichedCases.length + 1;

  for (const entry of rtmMatrix) {
    const ac = deconstruction.acceptanceCriteria.find((a) => a.id === entry.reqId);
    if (!ac) continue;

    if (!entry.hasHappyPath) {
      enrichedCases.push({
        id: `TC_SUP_FUN_${String(counter++).padStart(3, "0")}`,
        module: deconstruction.moduleName,
        category: "functional",
        priority: "P2",
        reqId: entry.reqId,
        title: `Verify ${entry.reqTitle} - Supplementary Happy Path`,
        preconditions: "System initialized in valid test environment.",
        testData: "Valid structured input parameters.",
        steps: [
          `1. Execute user scenario for ${ac.title}.`,
          "2. Verify successful acceptance criteria fulfillment.",
        ],
        expectedResult: "Scenario executes successfully with valid persistent state.",
      });
    }

    if (!entry.hasNegative) {
      enrichedCases.push({
        id: `TC_SUP_NEG_${String(counter++).padStart(3, "0")}`,
        module: deconstruction.moduleName,
        category: "negative",
        priority: "P3",
        reqId: entry.reqId,
        title: `Verify ${entry.reqTitle} - Supplementary Negative Exception`,
        preconditions: "Target module loaded.",
        testData: "Conflicting or boundary-violating payload.",
        steps: [
          `1. Trigger ${ac.title} with conflicting or invalid payload.`,
          "2. Observe error interception.",
        ],
        expectedResult: "Operation rejected safely; clear user-friendly error presented.",
      });
    }
  }

  return enrichedCases;
}

/**
 * Main Audit Engine execution
 */
export function runAuditEngine(
  deconstruction: DeconstructionResult,
  rawTestCases: TestCase[],
  specText: string
): { auditedCases: TestCase[]; auditReport: AuditResult } {
  // 1. Semantic Deduplication
  const { uniqueCases, deduplicatedCount } = deduplicateTestCases(rawTestCases);

  // 2. Ensure RTM Coverage >= 95%
  const compliantCases = ensureFullRtmCoverage(deconstruction, uniqueCases);

  // 3. Compute final RTM
  const { rtmMatrix, coveragePercentage, coveredACs, totalACs } = buildRTM(
    deconstruction,
    compliantCases
  );

  // 4. Check Hallucinations
  const hallucinationWarnings = checkHallucinations(compliantCases, specText);

  return {
    auditedCases: compliantCases,
    auditReport: {
      coveragePercentage,
      totalACs,
      coveredACs,
      rtmMatrix,
      deduplicatedCount,
      hallucinationWarnings,
    },
  };
}
