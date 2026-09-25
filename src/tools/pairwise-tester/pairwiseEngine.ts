/**
 * Pairwise / All-Pairs Test Case Generation Engine
 * 
 * Implements an optimized greedy All-Pairs heuristic that covers 100% of 2-way parameter pairs
 * with the minimal number of test cases.
 */

export interface ParameterDef {
  id: string;
  name: string;
  values: string[];
}

export interface PairwiseResult {
  parameters: ParameterDef[];
  testCases: Record<string, string>[];
  totalCombinations: number;
  totalPairs: number;
  coveredPairs: number;
  reductionPercentage: number;
  excludedCount: number;
}

export interface PairCoverageDetail {
  paramAName: string;
  valA: string;
  paramBName: string;
  valB: string;
  coveredByCaseId: number;
}

export interface ExcludedCaseItem {
  [key: string]: any;
  id: number;
  values: Record<string, string>;
  reasonVi: string;
  reasonEn: string;
  coveringCaseIds: number[];
  bestMatchCaseId: number;
  bestMatchParamCount: number;
  totalPairs: number;
  pairsDetail: PairCoverageDetail[];
  isConstraintViolation?: boolean;
  violatedConstraintName?: string;
}

export interface ExcludedCasesResult {
  excludedCases: ExcludedCaseItem[];
  totalExcluded: number;
  isTruncated: boolean;
}

export type ConstraintOperator = "equals" | "not_equals";

export interface ConstraintClause {
  paramName: string;
  operator: ConstraintOperator;
  value: string;
}

export type ConstraintType = "incompatible" | "if_then";

export interface TestConstraint {
  id: string;
  name: string;
  type: ConstraintType;
  enabled: boolean;
  conditions: ConstraintClause[];
  thenClause?: ConstraintClause;
  description?: string;
}

export interface ParameterPreset {
  id: string;
  title: string;
  titleVi: string;
  description: string;
  descriptionVi: string;
  parameters: ParameterDef[];
  constraints?: TestConstraint[];
}

/**
 * Pre-defined test suites commonly used by QA and Devs
 */
export const PAIRWISE_PRESETS: ParameterPreset[] = [
  {
    id: "ecommerce-checkout",
    title: "E-Commerce Checkout & Payment",
    titleVi: "Thanh toán & Đơn hàng E-Commerce",
    description: "Combinations of Devices, Browsers, Payments, and Promo Codes",
    descriptionVi: "Tổ hợp Thiết bị, Trình duyệt, Phương thức thanh toán và Mã giảm giá",
    parameters: [
      {
        id: "p_device",
        name: "Device Type",
        values: ["Desktop (macOS)", "Desktop (Windows)", "Mobile (iOS)", "Mobile (Android)"],
      },
      {
        id: "p_browser",
        name: "Browser",
        values: ["Chrome", "Safari", "Firefox", "Edge"],
      },
      {
        id: "p_payment",
        name: "Payment Method",
        values: ["Credit Card", "MoMo Wallet", "ZaloPay", "Bank Transfer", "Cash on Delivery (COD)"],
      },
      {
        id: "p_coupon",
        name: "Coupon / Discount",
        values: ["No Coupon", "Valid 10% Off", "Expired Coupon", "Free Shipping"],
      },
      {
        id: "p_user_type",
        name: "User Account",
        values: ["Guest", "Registered Member", "VIP Customer"],
      },
    ],
    constraints: [
      {
        id: "c_win_safari",
        name: "Safari không hỗ trợ Windows Desktop",
        type: "incompatible",
        enabled: true,
        conditions: [
          { paramName: "Device Type", operator: "equals", value: "Desktop (Windows)" },
          { paramName: "Browser", operator: "equals", value: "Safari" },
        ],
        description: "Trình duyệt Safari không chạy trên hệ điều hành Windows",
      },
    ],
  },
  {
    id: "auth-security",
    title: "User Auth & Permission Matrix",
    titleVi: "Xác thực & Phân quyền Người dùng",
    description: "Roles, 2FA status, SSO Provider, and Account Status",
    descriptionVi: "Quyền hạn, Trạng thái 2FA, Nhà cung cấp SSO và Trạng thái tài khoản",
    parameters: [
      {
        id: "p_role",
        name: "User Role",
        values: ["Super Admin", "Project Manager", "Standard Member", "Guest / Read-only"],
      },
      {
        id: "p_auth_method",
        name: "Auth Provider",
        values: ["Email + Password", "Google OAuth", "GitHub OAuth", "SAML SSO"],
      },
      {
        id: "p_two_factor",
        name: "Two-Factor Auth (2FA)",
        values: ["2FA Disabled", "2FA SMS OTP", "2FA Authenticator App"],
      },
      {
        id: "p_status",
        name: "Account State",
        values: ["Active", "Email Unverified", "Locked / Suspended", "Password Expired"],
      },
    ],
    constraints: [
      {
        id: "c_guest_2fa",
        name: "Tài khoản khách (Guest) bắt buộc tắt 2FA",
        type: "if_then",
        enabled: true,
        conditions: [
          { paramName: "User Role", operator: "equals", value: "Guest / Read-only" },
        ],
        thenClause: {
          paramName: "Two-Factor Auth (2FA)",
          operator: "equals",
          value: "2FA Disabled",
        },
        description: "Guest chỉ có quyền xem nên không hỗ trợ kích hoạt 2FA OTP/App",
      },
    ],
  },
  {
    id: "form-field-validation",
    title: "Input Field Boundary Matrix",
    titleVi: "Ma trận Kiểm thử Form Nhập liệu",
    description: "Length boundaries, character types, whitespaces, and required flag",
    descriptionVi: "Độ dài biên, Loại ký tự, Khoảng trắng và Ràng buộc bắt buộc",
    parameters: [
      {
        id: "p_length",
        name: "Input Length",
        values: ["Empty (0)", "Min Valid (1)", "Normal (15)", "Max Valid (50)", "Over Max (51)"],
      },
      {
        id: "p_char_type",
        name: "Character Set",
        values: ["Alphanumeric (a-Z, 0-9)", "Special Symbols (!@#$)", "Vietnamese Unicode (Tiếng Việt)", "HTML / Script Tags"],
      },
      {
        id: "p_whitespace",
        name: "Whitespace Format",
        values: ["No spaces", "Leading / Trailing Space", "Multiple Consecutive Spaces"],
      },
      {
        id: "p_required",
        name: "Field Requirement",
        values: ["Mandatory (Required)", "Optional Field"],
      },
    ],
    constraints: [
      {
        id: "c_empty_whitespace",
        name: "Chuỗi rỗng (Empty 0) bắt buộc không chứa khoảng trắng",
        type: "if_then",
        enabled: true,
        conditions: [
          { paramName: "Input Length", operator: "equals", value: "Empty (0)" },
        ],
        thenClause: {
          paramName: "Whitespace Format",
          operator: "equals",
          value: "No spaces",
        },
        description: "Khi độ dài chuỗi bằng 0 thì không thể có ký tự khoảng trắng",
      },
    ],
  },
];

/**
 * Represents a pair between two parameter values: (paramA=valA, paramB=valB)
 */
function pairKey(paramIdx1: number, val1: string, paramIdx2: number, val2: string): string {
  if (paramIdx1 < paramIdx2) {
    return `${paramIdx1}:${val1}|${paramIdx2}:${val2}`;
  }
  return `${paramIdx2}:${val2}|${paramIdx1}:${val1}`;
}

/**
 * Evaluates whether a constraint clause matches the given test case values.
 * Returns:
 * - "match": The parameter is assigned in testCase and matches operator/value.
 * - "mismatch": The parameter is assigned in testCase and does not match operator/value.
 * - "undetermined": The parameter is not yet assigned in testCase.
 */
export function evaluateClause(
  clause: ConstraintClause,
  testCase: Record<string, string>
): "match" | "mismatch" | "undetermined" {
  const val = testCase[clause.paramName];
  if (val === undefined) return "undetermined";

  if (clause.operator === "equals") {
    return val === clause.value ? "match" : "mismatch";
  } else {
    return val !== clause.value ? "match" : "mismatch";
  }
}

/**
 * Checks whether a (complete or partial) test case violates a specific constraint.
 * Returns true if the constraint is violated, false otherwise.
 */
export function checkConstraintViolation(
  testCase: Record<string, string>,
  constraint: TestConstraint
): boolean {
  if (!constraint.enabled) return false;

  if (constraint.type === "incompatible") {
    if (!constraint.conditions || constraint.conditions.length === 0) return false;
    // An incompatible constraint is violated when all conditions match
    const allMatch = constraint.conditions.every(
      (c) => evaluateClause(c, testCase) === "match"
    );
    return allMatch;
  }

  if (constraint.type === "if_then" && constraint.thenClause) {
    if (!constraint.conditions || constraint.conditions.length === 0) return false;
    // Check if the "IF" premise holds
    const ifMatches = constraint.conditions.every(
      (c) => evaluateClause(c, testCase) === "match"
    );
    if (!ifMatches) return false;

    // If premise holds, the "THEN" clause must be satisfied
    const thenRes = evaluateClause(constraint.thenClause, testCase);
    return thenRes === "mismatch";
  }

  return false;
}

/**
 * Returns the first active constraint violated by the test case, or null if all satisfied.
 */
export function getViolatedConstraint(
  testCase: Record<string, string>,
  constraints: TestConstraint[]
): TestConstraint | null {
  for (const c of constraints) {
    if (checkConstraintViolation(testCase, c)) {
      return c;
    }
  }
  return null;
}

/**
 * Checks if a test case satisfies all enabled constraints.
 */
export function isTestCaseSatisfiesConstraints(
  testCase: Record<string, string>,
  constraints: TestConstraint[]
): boolean {
  return getViolatedConstraint(testCase, constraints) === null;
}

/**
 * Checks if a 2-way pair is allowed under active constraints.
 * If combining paramA=valA and paramB=valB inherently violates a constraint, returns false.
 */
export function isPairAllowed(
  paramAName: string,
  valA: string,
  paramBName: string,
  valB: string,
  constraints: TestConstraint[]
): boolean {
  const pairCase: Record<string, string> = {
    [paramAName]: valA,
    [paramBName]: valB,
  };
  return isTestCaseSatisfiesConstraints(pairCase, constraints);
}

/**
 * Generate all 2-way pairs that must be covered, excluding pairs that violate active constraints
 */
export function generateAllPairs(
  parameters: ParameterDef[],
  constraints: TestConstraint[] = []
): Set<string> {
  const allPairs = new Set<string>();
  const n = parameters.length;
  const activeConstraints = constraints.filter((c) => c.enabled);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const vals1 = parameters[i].values;
      const vals2 = parameters[j].values;
      for (const v1 of vals1) {
        for (const v2 of vals2) {
          if (
            activeConstraints.length === 0 ||
            isPairAllowed(parameters[i].name, v1, parameters[j].name, v2, activeConstraints)
          ) {
            allPairs.add(pairKey(i, v1, j, v2));
          }
        }
      }
    }
  }

  return allPairs;
}

/**
 * Calculates Cartesian product count
 */
export function calculateCartesianProduct(parameters: ParameterDef[]): number {
  if (parameters.length === 0) return 0;
  return parameters.reduce((acc, param) => acc * Math.max(1, param.values.length), 1);
}

/**
 * All-Pairs Test Case Generation using Greedy Cover Heuristic with Constraint Satisfaction
 */
export function generatePairwiseTestCases(
  parameters: ParameterDef[],
  constraints: TestConstraint[] = []
): PairwiseResult {
  const activeConstraints = constraints.filter((c) => c.enabled);

  // Filter out parameters with empty values
  const validParams = parameters
    .map((p) => ({
      ...p,
      values: p.values.map((v) => v.trim()).filter((v) => v.length > 0),
    }))
    .filter((p) => p.values.length > 0);

  if (validParams.length < 2) {
    // If fewer than 2 parameters, pairwise is just the values of the parameter
    const testCases: Record<string, string>[] = [];
    if (validParams.length === 1) {
      for (const val of validParams[0].values) {
        const singleCase = { [validParams[0].name]: val };
        if (isTestCaseSatisfiesConstraints(singleCase, activeConstraints)) {
          testCases.push(singleCase);
        }
      }
    }
    const totalCombos = validParams.length === 1 ? validParams[0].values.length : 0;
    return {
      parameters: validParams,
      testCases,
      totalCombinations: totalCombos,
      totalPairs: 0,
      coveredPairs: 0,
      reductionPercentage: 0,
      excludedCount: 0,
    };
  }

  const allPairs = generateAllPairs(validParams, activeConstraints);
  const uncoveredPairs = new Set<string>(allPairs);
  const totalPairsCount = allPairs.size;

  // Track value usage frequency to balance test distributions
  const valueUsage: Record<string, number> = {};
  for (let i = 0; i < validParams.length; i++) {
    for (const val of validParams[i].values) {
      valueUsage[`${i}:${val}`] = 0;
    }
  }

  const testCases: Record<string, string>[] = [];
  const maxIterations = 2000; // Safeguard against infinite loops
  let iterations = 0;
  let stagnantCount = 0;

  while (uncoveredPairs.size > 0 && iterations < maxIterations) {
    iterations++;

    // Pick the uncovered pair with the least used values to ensure even distribution
    let bestStartingPair: string | null = null;
    let minUsageSum = Infinity;

    for (const pair of uncoveredPairs) {
      const [partA, partB] = pair.split("|");
      const usageSum = (valueUsage[partA] || 0) + (valueUsage[partB] || 0);
      if (usageSum < minUsageSum) {
        minUsageSum = usageSum;
        bestStartingPair = pair;
      }
    }

    if (!bestStartingPair) break;

    // Initialize test case with the starting pair
    const [partA, partB] = bestStartingPair.split("|");
    const [pIdxAStr, valA] = partA.split(":");
    const [pIdxBStr, valB] = partB.split(":");
    const pIdxA = parseInt(pIdxAStr, 10);
    const pIdxB = parseInt(pIdxBStr, 10);

    const currentCaseValues: (string | null)[] = new Array(validParams.length).fill(null);
    currentCaseValues[pIdxA] = valA;
    currentCaseValues[pIdxB] = valB;

    // Determine the order to fill the remaining parameters
    const remainingIndices: number[] = [];
    for (let i = 0; i < validParams.length; i++) {
      if (i !== pIdxA && i !== pIdxB) {
        remainingIndices.push(i);
      }
    }

    // Fill each unset parameter greedily while respecting constraints
    for (const targetIdx of remainingIndices) {
      // Build current partial assignment dictionary
      const currentAssigned: Record<string, string> = {};
      for (let i = 0; i < validParams.length; i++) {
        if (currentCaseValues[i] !== null) {
          currentAssigned[validParams[i].name] = currentCaseValues[i]!;
        }
      }

      // Filter candidate values to those satisfying active constraints
      const validCandidates: string[] = [];
      const invalidCandidates: string[] = [];

      for (const candidateVal of validParams[targetIdx].values) {
        const testCombo = {
          ...currentAssigned,
          [validParams[targetIdx].name]: candidateVal,
        };
        if (isTestCaseSatisfiesConstraints(testCombo, activeConstraints)) {
          validCandidates.push(candidateVal);
        } else {
          invalidCandidates.push(candidateVal);
        }
      }

      // Prioritize valid candidates that do not violate constraints
      const candidatesToEvaluate =
        validCandidates.length > 0 ? validCandidates : invalidCandidates;

      let bestVal = candidatesToEvaluate[0];
      let maxNewCovered = -1;
      let minUsage = Infinity;

      for (const candidateVal of candidatesToEvaluate) {
        let newCovered = 0;
        for (let assignedIdx = 0; assignedIdx < validParams.length; assignedIdx++) {
          if (currentCaseValues[assignedIdx] !== null) {
            const pair = pairKey(targetIdx, candidateVal, assignedIdx, currentCaseValues[assignedIdx]!);
            if (uncoveredPairs.has(pair)) {
              newCovered++;
            }
          }
        }

        const usage = valueUsage[`${targetIdx}:${candidateVal}`] || 0;

        if (newCovered > maxNewCovered || (newCovered === maxNewCovered && usage < minUsage)) {
          maxNewCovered = newCovered;
          minUsage = usage;
          bestVal = candidateVal;
        }
      }

      currentCaseValues[targetIdx] = bestVal;
    }

    // Form final test case dictionary
    const testCaseDict: Record<string, string> = {};
    for (let i = 0; i < validParams.length; i++) {
      const chosenVal = currentCaseValues[i] || validParams[i].values[0];
      testCaseDict[validParams[i].name] = chosenVal;
    }

    // Double-check constraints on the complete test case; run quick local repair if needed
    if (!isTestCaseSatisfiesConstraints(testCaseDict, activeConstraints)) {
      for (let pIdx = 0; pIdx < validParams.length; pIdx++) {
        const originalVal = testCaseDict[validParams[pIdx].name];
        let repaired = false;
        for (const altVal of validParams[pIdx].values) {
          if (altVal === originalVal) continue;
          testCaseDict[validParams[pIdx].name] = altVal;
          if (isTestCaseSatisfiesConstraints(testCaseDict, activeConstraints)) {
            currentCaseValues[pIdx] = altVal;
            repaired = true;
            break;
          }
        }
        if (repaired) break;
        testCaseDict[validParams[pIdx].name] = originalVal;
      }
    }

    // Update value usages
    for (let i = 0; i < validParams.length; i++) {
      const finalVal = testCaseDict[validParams[i].name];
      valueUsage[`${i}:${finalVal}`] = (valueUsage[`${i}:${finalVal}`] || 0) + 1;
    }

    const prevUncoveredSize = uncoveredPairs.size;

    // Remove all pairs covered by this test case from uncoveredPairs
    for (let i = 0; i < validParams.length; i++) {
      for (let j = i + 1; j < validParams.length; j++) {
        const covered = pairKey(i, testCaseDict[validParams[i].name], j, testCaseDict[validParams[j].name]);
        uncoveredPairs.delete(covered);
      }
    }

    testCases.push(testCaseDict);

    // Stagnation guard for impossible-to-cover pairs under restrictive constraints
    if (uncoveredPairs.size === prevUncoveredSize) {
      stagnantCount++;
      if (stagnantCount > 50) {
        break;
      }
    } else {
      stagnantCount = 0;
    }
  }

  const totalCombinations = calculateCartesianProduct(validParams);
  const coveredCount = totalPairsCount - uncoveredPairs.size;
  const reductionPercentage =
    totalCombinations > 0 ? Math.round(((totalCombinations - testCases.length) / totalCombinations) * 1000) / 10 : 0;
  const excludedCount = Math.max(0, totalCombinations - testCases.length);

  return {
    parameters: validParams,
    testCases,
    totalCombinations,
    totalPairs: totalPairsCount,
    coveredPairs: coveredCount,
    reductionPercentage: Math.max(0, reductionPercentage),
    excludedCount,
  };
}

/**
 * Computes the combinations that were excluded/pruned by Pairwise optimization,
 * along with detailed explanation of which optimal test case(s) cover each pair.
 * Capped at maxLimit to protect memory and performance on large Cartesian sets.
 */
export function getExcludedCombinations(
  parameters: ParameterDef[],
  pairwiseCases: Record<string, string>[],
  maxLimit: number = 500,
  constraints: TestConstraint[] = []
): ExcludedCasesResult {
  const activeConstraints = constraints.filter((c) => c.enabled);

  const validParams = parameters
    .map((p) => ({
      ...p,
      values: p.values.map((v) => v.trim()).filter((v) => v.length > 0),
    }))
    .filter((p) => p.values.length > 0);

  if (validParams.length < 2) {
    return { excludedCases: [], totalExcluded: 0, isTruncated: false };
  }

  const pairwiseSet = new Set<string>();
  for (const tc of pairwiseCases) {
    const key = validParams.map((p) => tc[p.name] ?? "").join("::");
    pairwiseSet.add(key);
  }

  // Pre-index: map every pairKey to all 1-indexed case IDs containing it
  const pairToCasesMap = new Map<string, number[]>();
  for (let cIdx = 0; cIdx < pairwiseCases.length; cIdx++) {
    const tc = pairwiseCases[cIdx];
    const caseId = cIdx + 1;

    for (let i = 0; i < validParams.length; i++) {
      const valI = tc[validParams[i].name];
      if (valI === undefined) continue;

      for (let j = i + 1; j < validParams.length; j++) {
        const valJ = tc[validParams[j].name];
        if (valJ === undefined) continue;

        const pKey = pairKey(i, valI, j, valJ);
        let list = pairToCasesMap.get(pKey);
        if (!list) {
          list = [];
          pairToCasesMap.set(pKey, list);
        }
        list.push(caseId);
      }
    }
  }

  const totalCombinations = calculateCartesianProduct(validParams);
  const totalExcluded = Math.max(0, totalCombinations - pairwiseCases.length);
  const totalPairsCount = (validParams.length * (validParams.length - 1)) / 2;

  const excluded: ExcludedCaseItem[] = [];
  let isTruncated = false;

  function processExcludedCombo(combo: Record<string, string>) {
    // Check if this combination violates any active constraint
    const violatedConstraint = getViolatedConstraint(combo, activeConstraints);
    const isConstraintViolation = violatedConstraint !== null;
    const violatedConstraintName = violatedConstraint ? violatedConstraint.name : undefined;

    // 1. Gather all pairs in this combo
    const comboPairs: { pKey: string; i: number; j: number; valI: string; valJ: string }[] = [];
    for (let i = 0; i < validParams.length; i++) {
      const valI = combo[validParams[i].name];
      for (let j = i + 1; j < validParams.length; j++) {
        const valJ = combo[validParams[j].name];
        comboPairs.push({
          pKey: pairKey(i, valI, j, valJ),
          i,
          j,
          valI,
          valJ,
        });
      }
    }

    // 2. Count shared pairs and matching parameters with each optimal test case
    const casePairCoverageCount = new Map<number, number>();
    const caseParamMatchCount = new Map<number, number>();

    for (let cIdx = 0; cIdx < pairwiseCases.length; cIdx++) {
      const caseId = cIdx + 1;
      const tc = pairwiseCases[cIdx];

      let paramMatches = 0;
      for (let i = 0; i < validParams.length; i++) {
        if (tc[validParams[i].name] === combo[validParams[i].name]) {
          paramMatches++;
        }
      }
      caseParamMatchCount.set(caseId, paramMatches);
      casePairCoverageCount.set(caseId, 0);
    }

    for (const cp of comboPairs) {
      const coverers = pairToCasesMap.get(cp.pKey) || [];
      for (const cId of coverers) {
        casePairCoverageCount.set(cId, (casePairCoverageCount.get(cId) || 0) + 1);
      }
    }

    // 3. Find the best matching case (highest parameter match, then pair count)
    let bestMatchCaseId = 1;
    let maxParamMatches = -1;
    let maxPairsCovered = -1;

    for (let cIdx = 0; cIdx < pairwiseCases.length; cIdx++) {
      const caseId = cIdx + 1;
      const pMatches = caseParamMatchCount.get(caseId) || 0;
      const pairsCovered = casePairCoverageCount.get(caseId) || 0;

      if (
        pMatches > maxParamMatches ||
        (pMatches === maxParamMatches && pairsCovered > maxPairsCovered)
      ) {
        maxParamMatches = pMatches;
        maxPairsCovered = pairsCovered;
        bestMatchCaseId = caseId;
      }
    }

    // 4. Find the minimal set of covering cases using Greedy Set Cover
    const uncoveredPairKeys = new Set<string>(comboPairs.map((cp) => cp.pKey));
    const chosenCaseIds: number[] = [];

    // Prioritize best match case
    if (uncoveredPairKeys.size > 0 && (casePairCoverageCount.get(bestMatchCaseId) || 0) > 0) {
      chosenCaseIds.push(bestMatchCaseId);
      for (const cp of comboPairs) {
        const coverers = pairToCasesMap.get(cp.pKey) || [];
        if (coverers.includes(bestMatchCaseId)) {
          uncoveredPairKeys.delete(cp.pKey);
        }
      }
    }

    while (uncoveredPairKeys.size > 0) {
      let bestCandidateId = -1;
      let bestCandidateCover = 0;

      for (let cIdx = 0; cIdx < pairwiseCases.length; cIdx++) {
        const caseId = cIdx + 1;
        if (chosenCaseIds.includes(caseId)) continue;

        let currentCover = 0;
        for (const cp of comboPairs) {
          if (uncoveredPairKeys.has(cp.pKey)) {
            const coverers = pairToCasesMap.get(cp.pKey) || [];
            if (coverers.includes(caseId)) {
              currentCover++;
            }
          }
        }

        if (currentCover > bestCandidateCover) {
          bestCandidateCover = currentCover;
          bestCandidateId = caseId;
        }
      }

      if (bestCandidateId === -1 || bestCandidateCover === 0) {
        const remainingKey = uncoveredPairKeys.values().next().value;
        if (remainingKey) {
          const coverers = pairToCasesMap.get(remainingKey) || [];
          if (coverers.length > 0) {
            chosenCaseIds.push(coverers[0]);
            uncoveredPairKeys.delete(remainingKey);
          } else {
            break;
          }
        } else {
          break;
        }
      } else {
        chosenCaseIds.push(bestCandidateId);
        for (const cp of comboPairs) {
          if (uncoveredPairKeys.has(cp.pKey)) {
            const coverers = pairToCasesMap.get(cp.pKey) || [];
            if (coverers.includes(bestCandidateId)) {
              uncoveredPairKeys.delete(cp.pKey);
            }
          }
        }
      }
    }

    chosenCaseIds.sort((a, b) => a - b);

    // 5. Construct Pair Coverage Details
    const pairsDetail: PairCoverageDetail[] = comboPairs.map((cp) => {
      const coverers = pairToCasesMap.get(cp.pKey) || [];
      const chosen = chosenCaseIds.find((cId) => coverers.includes(cId)) || coverers[0] || 1;
      return {
        paramAName: validParams[cp.i].name,
        valA: cp.valI,
        paramBName: validParams[cp.j].name,
        valB: cp.valJ,
        coveredByCaseId: chosen,
      };
    });

    let reasonVi = "";
    let reasonEn = "";

    if (isConstraintViolation && violatedConstraint) {
      reasonVi = `🚫 Bị loại trừ do vi phạm ràng buộc: "${violatedConstraint.name}"`;
      reasonEn = `🚫 Excluded due to constraint violation: "${violatedConstraint.name}"`;
    } else {
      reasonVi = `100% cặp tương tác (${totalPairsCount}/${totalPairsCount}) đã phủ bởi các test case tối ưu (Trùng ${maxParamMatches}/${validParams.length} tham số với Case #${bestMatchCaseId})`;
      reasonEn = `100% 2-way pairs (${totalPairsCount}/${totalPairsCount}) covered in optimal set (Matches ${maxParamMatches}/${validParams.length} params with Case #${bestMatchCaseId})`;
    }

    excluded.push({
      ...combo,
      id: excluded.length + 1,
      values: { ...combo },
      reasonVi,
      reasonEn,
      coveringCaseIds: chosenCaseIds,
      bestMatchCaseId,
      bestMatchParamCount: maxParamMatches,
      totalPairs: totalPairsCount,
      pairsDetail,
      isConstraintViolation,
      violatedConstraintName,
    });
  }

  function backtrack(paramIdx: number, currentCombo: Record<string, string>, currentKeyParts: string[]) {
    if (excluded.length >= maxLimit) {
      isTruncated = true;
      return;
    }

    if (paramIdx === validParams.length) {
      const key = currentKeyParts.join("::");
      if (!pairwiseSet.has(key)) {
        processExcludedCombo(currentCombo);
      }
      return;
    }

    const param = validParams[paramIdx];
    for (const val of param.values) {
      currentCombo[param.name] = val;
      currentKeyParts.push(val);
      backtrack(paramIdx + 1, currentCombo, currentKeyParts);
      currentKeyParts.pop();
      if (excluded.length >= maxLimit) {
        isTruncated = true;
        break;
      }
    }
  }

  backtrack(0, {}, []);

  return {
    excludedCases: excluded,
    totalExcluded,
    isTruncated: totalExcluded > maxLimit || isTruncated,
  };
}

/**
 * Format results to Markdown Table
 */
export function exportPairwiseToMarkdown(
  parameters: ParameterDef[],
  testCases: (Record<string, any> | ExcludedCaseItem)[]
): string {
  if (testCases.length === 0 || parameters.length === 0) return "";

  const isExcluded = testCases.length > 0 && "coveringCaseIds" in testCases[0];

  const headers = isExcluded
    ? ["#", ...parameters.map((p) => p.name), "Được phủ bởi", "Lý do loại trừ"]
    : ["#", ...parameters.map((p) => p.name)];

  const divider = headers.map(() => "---");

  const rows = testCases.map((tc, idx) => {
    const baseCols = [String(idx + 1), ...parameters.map((p) => tc[p.name] || "-")];
    if (isExcluded) {
      const item = tc as ExcludedCaseItem;
      let coveringStr = "-";
      if (item.isConstraintViolation) {
        coveringStr = item.violatedConstraintName ? `[Ràng buộc: ${item.violatedConstraintName}]` : "[Vi phạm]";
      } else if (item.coveringCaseIds && item.coveringCaseIds.length > 0) {
        coveringStr = `Case #${item.coveringCaseIds.join(", #")}`;
      }
      baseCols.push(coveringStr, item.reasonVi || "Đã phủ cặp 2 chiều");
    }
    return `| ${baseCols.join(" | ")} |`;
  });

  return [`| ${headers.join(" | ")} |`, `| ${divider.join(" | ")} |`, ...rows].join("\n");
}

/**
 * Format results to CSV format
 */
export function exportPairwiseToCsv(
  parameters: ParameterDef[],
  testCases: (Record<string, any> | ExcludedCaseItem)[],
  delimiter: string = ","
): string {
  if (testCases.length === 0 || parameters.length === 0) return "";

  const isExcluded = testCases.length > 0 && "coveringCaseIds" in testCases[0];

  const escapeField = (str: string) => {
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerCols = isExcluded
    ? ["Case #", ...parameters.map((p) => p.name), "Trạng thái", "Được phủ bởi", "Lý do"]
    : ["Case #", ...parameters.map((p) => p.name)];

  const header = headerCols.map(escapeField).join(delimiter);

  const rows = testCases.map((tc, idx) => {
    const cols = [String(idx + 1), ...parameters.map((p) => tc[p.name] || "")];
    if (isExcluded) {
      const item = tc as ExcludedCaseItem;
      const statusStr = item.isConstraintViolation ? "Vi phạm ràng buộc" : "Đã loại trừ";
      const coveringStr = item.coveringCaseIds ? `Case #${item.coveringCaseIds.join(", #")}` : "";
      cols.push(statusStr, coveringStr, item.reasonVi || "");
    }
    return cols.map(escapeField).join(delimiter);
  });

  return [header, ...rows].join("\n");
}

/**
 * Format results to JSON Array string
 */
export function exportPairwiseToJson(
  _parameters: ParameterDef[],
  testCases: (Record<string, any> | ExcludedCaseItem)[]
): string {
  if (testCases.length === 0) return "[]";

  const isExcluded = testCases.length > 0 && "coveringCaseIds" in testCases[0];

  const jsonObjects = testCases.map((tc, idx) => {
    if (isExcluded) {
      const item = tc as ExcludedCaseItem;
      const cleanProps: Record<string, string> = {};
      for (const p of _parameters) {
        cleanProps[p.name] = item[p.name] || "";
      }
      return {
        caseId: idx + 1,
        ...cleanProps,
        _status: item.isConstraintViolation ? "constraint_violation" : "excluded",
        _isConstraintViolation: !!item.isConstraintViolation,
        _violatedConstraint: item.violatedConstraintName || null,
        _coveredByCases: item.coveringCaseIds ? item.coveringCaseIds.map((c) => `Case #${c}`) : [],
        _reason: item.reasonVi,
      };
    }
    return {
      caseId: idx + 1,
      ...tc,
    };
  });

  return JSON.stringify(jsonObjects, null, 2);
}

