export type TestCategory =
  | "functional"
  | "boundary"
  | "negative"
  | "security"
  | "rbac";

export type TestPriority = "P1" | "P2" | "P3" | "P4";

export interface SemanticChunk {
  id: string;
  title: string;
  content: string;
  sectionType: "flow" | "rules" | "matrix" | "general";
}

export interface IngestionResult {
  rawContent: string;
  cleanedContent: string;
  metadata: {
    fileName?: string;
    fileType?: string;
    sizeBytes?: number;
    detectedSections: string[];
    tableCount: number;
  };
  chunks: SemanticChunk[];
}

export interface UserFlow {
  id: string;
  title: string;
  type: "main" | "alternative" | "exception";
  description: string;
  steps: string[];
}

export interface BusinessRule {
  id: string;
  name: string;
  category: "data-constraint" | "dependency" | "format";
  description: string;
  field?: string;
  dataType?: string;
  min?: number | string;
  max?: number | string;
  regex?: string;
  dependencyCondition?: string;
}

export interface AcceptanceCriteria {
  id: string; // e.g. REQ_001
  title: string;
  description: string;
  flowType: "main" | "alternative" | "exception";
  relatedRules: string[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  impact: string;
  context: string;
  status: "open" | "answered";
  answer?: string;
}

export interface DeconstructionResult {
  moduleName: string;
  summary: string;
  flows: UserFlow[];
  businessRules: BusinessRule[];
  acceptanceCriteria: AcceptanceCriteria[];
  clarificationQuestions: ClarificationQuestion[];
  usedAI?: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiError?: string;
}

export interface TestCase {
  id: string; // TC_AUTH_001
  module: string;
  category: TestCategory;
  priority: TestPriority;
  reqId: string; // e.g. REQ_001
  title: string;
  preconditions: string;
  testData: string; // Concrete value: "admin@test.com", "9999", etc.
  steps: string[];
  expectedResult: string;
  bvaPoint?: "min-1" | "min" | "min+1" | "max-1" | "max" | "max+1" | "custom";
  role?: string; // Admin, Manager, Staff, Guest
}

export interface RTMEntry {
  reqId: string;
  reqTitle: string;
  hasHappyPath: boolean;
  hasNegative: boolean;
  testCaseIds: string[];
  isCovered: boolean; // true if >= 1 happy path and >= 1 negative
}

export interface AuditResult {
  coveragePercentage: number;
  totalACs: number;
  coveredACs: number;
  rtmMatrix: RTMEntry[];
  deduplicatedCount: number;
  hallucinationWarnings: string[];
}

export interface GeneratorPreferences {
  granularity: "detailed" | "high-level";
  enabledCategories: {
    functional: boolean;
    boundary: boolean;
    negative: boolean;
    security: boolean;
    rbac: boolean;
  };
  humanInTheLoop: boolean; // Pause after Deconstruction for QA review
}

export const DEFAULT_PREFERENCES: GeneratorPreferences = {
  granularity: "detailed",
  enabledCategories: {
    functional: true,
    boundary: true,
    negative: true,
    security: true,
    rbac: true,
  },
  humanInTheLoop: true,
};

export type GenerationStep =
  | "ingestion"
  | "deconstruction"
  | "review_pause"
  | "generation"
  | "complete";

export interface AgentProgress {
  agentName: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  message: string;
  count?: number;
}
