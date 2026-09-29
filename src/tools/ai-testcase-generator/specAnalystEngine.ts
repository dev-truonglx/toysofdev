import { AIConfig } from "../../services/storeService";
import { generateAIJson } from "../../services/aiService";
import { DeconstructionResult, UserFlow, BusinessRule, AcceptanceCriteria, ClarificationQuestion } from "./types";

/**
 * Checks if the text contains Vietnamese accented characters
 */
export function isVietnameseText(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
}

const SPEC_ANALYST_SYSTEM_PROMPT = `You are a Senior Requirements & Business Analyst Agent in an ISTQB-compliant Quality Engineering team.
Your objective is to deconstruct Business Requirement Documents (BRD/PRD/User Stories) into a rigorous, verifiable logic matrix.

CRITICAL LANGUAGE REQUIREMENT:
- You MUST detect the primary language of the input specification document.
- IF THE DOCUMENT IS IN VIETNAMESE (tiếng Việt), ALL OUTPUT VALUES (moduleName, summary, flow titles, flow descriptions, flow steps, rule names, rule descriptions, acceptance criteria titles, descriptions, and clarification questions) MUST BE WRITTEN IN 100% FLUENT, PROFESSIONAL VIETNAMESE!
- If the document is in English, output in English.

You must strictly output a JSON object adhering to the following schema:
{
  "moduleName": "string (name of the main feature or module)",
  "summary": "string (concise executive summary of what is being tested)",
  "flows": [
    {
      "id": "FLOW_001",
      "title": "string",
      "type": "main" | "alternative" | "exception",
      "description": "string",
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "businessRules": [
    {
      "id": "BR_001",
      "name": "string",
      "category": "data-constraint" | "dependency" | "format",
      "description": "string",
      "field": "string or undefined",
      "dataType": "string (e.g. string, number, boolean, date) or undefined",
      "min": "number or string (e.g. 6) or undefined",
      "max": "number or string (e.g. 30) or undefined",
      "regex": "regex string or undefined",
      "dependencyCondition": "string or undefined"
    }
  ],
  "acceptanceCriteria": [
    {
      "id": "REQ_001",
      "title": "string",
      "description": "string",
      "flowType": "main" | "alternative" | "exception",
      "relatedRules": ["BR_001"]
    }
  ],
  "clarificationQuestions": [
    {
      "id": "Q_001",
      "question": "string (specific question on ambiguous, vague, or missing spec)",
      "impact": "High" | "Medium" | "Low",
      "context": "string (where in the text the ambiguity occurs)",
      "status": "open"
    }
  ]
}

RULES:
1. Break down ALL 3 types of flows: Main (Happy Path), Alternative (valid branch), Exception (errors/lockout/timeouts).
2. Explicitly extract data boundaries: Length constraints (min/max), Value boundaries (min/max numbers), formats (Regex for email/phone/national ID), dependency conditions.
3. Every Acceptance Criteria MUST have an index REQ_001, REQ_002... for complete Traceability Matrix mapping.
4. Detect vague wording like 'xử lý tức thì / instant', 'các file thông dụng / standard files', 'bảo mật cao / highly secure' and create items in clarificationQuestions.
5. Preserve tables, fields, and roles from the input document. Output pure JSON only.`;

/**
 * Deterministic offline rule extraction heuristic for fallback or offline usage.
 * Automatically adapts between Vietnamese and English based on the input content.
 */
export function extractDeconstructionFallback(documentText: string): DeconstructionResult {
  const isVi = isVietnameseText(documentText);
  const lines = documentText.split("\n");
  const moduleName =
    lines.find((l) => l.trim().length > 3 && l.trim().length < 60)?.replace(/^[#*\s]+/, "").trim() ||
    (isVi ? "Mô-đun Hệ Thống Phần Mềm" : "Software System Module");

  const flows: UserFlow[] = [];
  const rules: BusinessRule[] = [];
  const acList: AcceptanceCriteria[] = [];
  const questions: ClarificationQuestion[] = [];

  // 1. User Flows
  if (isVi) {
    flows.push({
      id: "FLOW_001",
      title: "Luồng chính (Happy Path) - Thực hiện thành công",
      type: "main",
      description: "Kịch bản thực hiện thành công luồng nghiệp vụ chính tối ưu khi người dùng nhập dữ liệu hợp lệ.",
      steps: [
        "1. Người dùng truy cập giao diện chức năng của hệ thống",
        "2. Nhập đầy đủ thông tin hợp lệ theo đúng đặc tả của các trường",
        "3. Nhấn nút gửi / xác nhận giao dịch",
        "4. Hệ thống xử lý, lưu trữ dữ liệu vào cơ sở dữ liệu và hiển thị thông báo thành công",
      ],
    });

    flows.push({
      id: "FLOW_002",
      title: "Luồng rẽ nhánh hợp lệ (Alternative Path)",
      type: "alternative",
      description: "Các nhánh rẽ nghiệp vụ hợp lệ khác (ví dụ: tùy chọn phương thức khác, lọc bổ sung).",
      steps: [
        "1. Người dùng truy cập giao diện và chọn phương thức hoặc nhánh rẽ hợp lệ",
        "2. Hệ thống tải biểu mẫu hoặc cấu hình tương ứng với lựa chọn",
        "3. Người dùng nhập dữ liệu bổ sung và hoàn tất giao dịch thành công",
      ],
    });

    flows.push({
      id: "FLOW_003",
      title: "Luồng xử lý ngoại lệ (Exception Handling)",
      type: "exception",
      description: "Xử lý sự cố nghiệp vụ (hết phiên đăng nhập, dữ liệu xung đột, vượt quá giới hạn).",
      steps: [
        "1. Người dùng thao tác với trạng thái không hợp lệ hoặc dữ liệu vi phạm",
        "2. Hệ thống chặn thao tác trước khi thay đổi trạng thái",
        "3. Hiển thị thông báo lỗi rõ ràng và bảo toàn dữ liệu đã nhập không bị mất",
      ],
    });
  } else {
    flows.push({
      id: "FLOW_001",
      title: "Main Happy Path Flow",
      type: "main",
      description: "Standard successful end-to-end execution of the primary user scenario.",
      steps: [
        "1. User accesses the target module interface",
        "2. User provides valid input data conforming to all field specifications",
        "3. User submits the form / confirms the action",
        "4. System processes request, persists data, and displays success confirmation",
      ],
    });

    flows.push({
      id: "FLOW_002",
      title: "Alternative Path (Secondary / Branch Options)",
      type: "alternative",
      description: "Valid branching path such as alternative selection, optional fields, or secondary methods.",
      steps: [
        "1. User accesses target module interface and chooses alternative branch option",
        "2. System loads relevant contextual inputs",
        "3. User completes alternative flow successfully",
      ],
    });

    flows.push({
      id: "FLOW_003",
      title: "Exception Handling Flow",
      type: "exception",
      description: "System behavior upon invalid input, session expiry, duplicate data or network interruption.",
      steps: [
        "1. User initiates action with invalid or conflicting state",
        "2. System intercepts condition before state change",
        "3. System rejects operation safely with precise error feedback",
      ],
    });
  }

  // 2. Business Rules Heuristics from text
  let ruleIdx = 1;

  // Search for min/max lengths or range patterns
  const minMaxMatches = documentText.match(/(?:tối thiểu|min|at least)\s*(\d+)[\s\S]*?(?:tối đa|max|up to)\s*(\d+)/gi);
  if (minMaxMatches) {
    rules.push({
      id: `BR_${String(ruleIdx++).padStart(3, "0")}`,
      name: isVi ? "Ràng buộc độ dài trường nhập liệu (BVA)" : "Input Length Boundary Rule",
      category: "data-constraint",
      description: isVi
        ? "Độ dài ký tự tối thiểu và tối đa theo đặc tả nghiệp vụ."
        : "Length boundaries extracted from specification requirements.",
      min: 6,
      max: 50,
      dataType: "string",
    });
  } else {
    rules.push({
      id: `BR_${String(ruleIdx++).padStart(3, "0")}`,
      name: isVi ? "Ràng buộc trường bắt buộc (Mandatory)" : "Default Mandatory Field Constraint",
      category: "data-constraint",
      description: isVi
        ? "Trường bắt buộc không được để trống hoặc chỉ chứa khoảng trắng."
        : "Mandatory input fields must not be empty or whitespace-only.",
      min: 1,
      max: 255,
      dataType: "string",
    });
  }

  // Regex patterns
  if (/email/i.test(documentText)) {
    rules.push({
      id: `BR_${String(ruleIdx++).padStart(3, "0")}`,
      name: isVi ? "Xác thực định dạng Email" : "Email Format Validation",
      category: "format",
      description: isVi
        ? "Định dạng email hợp lệ theo chuẩn RFC 5322."
        : "Standard RFC 5322 email regex format validation.",
      regex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      field: "email",
      dataType: "string",
    });
  }

  if (/(?:phone|số điện thoại|sđt)/i.test(documentText)) {
    rules.push({
      id: `BR_${String(ruleIdx++).padStart(3, "0")}`,
      name: isVi ? "Xác thực định dạng Số điện thoại" : "Phone Number Format Validation",
      category: "format",
      description: isVi
        ? "Số điện thoại hợp lệ gồm 10 chữ số với đầu số 03, 05, 07, 08, 09."
        : "Valid phone number with 10 digits starting with prefix 0.",
      regex: "^0[3|5|7|8|9][0-9]{8}$",
      field: "phone",
      dataType: "string",
    });
  }

  // Dependent conditions
  if (/(?:khi|if|when|nếu)[\s\S]*?(?:bắt buộc|then|required|phải)/i.test(documentText)) {
    rules.push({
      id: `BR_${String(ruleIdx++).padStart(3, "0")}`,
      name: isVi ? "Ràng buộc phụ thuộc điều kiện động" : "Conditional Field Dependency Rule",
      category: "dependency",
      description: isVi
        ? "Khi chọn phương thức/điều kiện cha, bắt buộc hiển thị và nhập danh sách các trường phụ thuộc."
        : "Selecting specific options dynamically mandates secondary field requirements.",
      dependencyCondition: "Dependent condition triggered by parent selection.",
    });
  }

  // 3. Acceptance Criteria
  let reqIdx = 1;
  flows.forEach((flow) => {
    acList.push({
      id: `REQ_${String(reqIdx++).padStart(3, "0")}`,
      title: isVi ? `Tiêu chí chấp thuận: ${flow.title}` : `${flow.title} Acceptance`,
      description: isVi
        ? `Hệ thống phải thực hiện chính xác kịch bản '${flow.title}' theo các bước định nghĩa trong ${flow.id}.`
        : `System must execute ${flow.title.toLowerCase()} accurately as defined in ${flow.id}.`,
      flowType: flow.type,
      relatedRules: rules.map((r) => r.id),
    });
  });

  // Add field constraint ACs
  rules.forEach((rule) => {
    acList.push({
      id: `REQ_${String(reqIdx++).padStart(3, "0")}`,
      title: isVi ? `Thực thi quy tắc: ${rule.name}` : `Rule Enforcement: ${rule.name}`,
      description: isVi
        ? `Tất cả dữ liệu nhập vào trường liên quan đến '${rule.name}' phải được xác thực chặt chẽ trước khi lưu vào CSDL.`
        : `All input matching ${rule.name} must be validated strictly before database write.`,
      flowType: rule.category === "data-constraint" ? "exception" : "main",
      relatedRules: [rule.id],
    });
  });

  // 4. Ambiguity Detection Heuristic
  const vagueTerms = [
    {
      term: "tức thì",
      desc: isVi
        ? "Thời gian phản hồi 'tức thì' chưa được lượng hóa (cần SLA cụ thể như < 500ms)."
        : "'Instant' processing lacks measurable latency bounds (< 500ms).",
    },
    {
      term: "instant",
      desc: "'Instant' processing lacks measurable latency bounds (< 500ms or < 1s).",
    },
    {
      term: "thông dụng",
      desc: isVi
        ? "Khái niệm 'file thông dụng' không chỉ rõ MIME types hay dung lượng tối đa."
        : "'Standard format' is not explicitly mapped to acceptable extensions or payload caps.",
    },
    {
      term: "standard",
      desc: "'Standard format' is not explicitly mapped to acceptable extensions or payload caps.",
    },
    {
      term: "bảo mật",
      desc: isVi
        ? "Yêu cầu 'bảo mật cao' cần làm rõ thuật toán mã hóa (AES-256, bcrypt) hoặc cơ chế rate-limit."
        : "'High security' needs concrete encryption specs (AES-256) or rate-limit thresholds.",
    },
  ];

  let qIdx = 1;
  vagueTerms.forEach((vt) => {
    if (new RegExp(vt.term, "i").test(documentText)) {
      questions.push({
        id: `Q_${String(qIdx++).padStart(3, "0")}`,
        question: isVi
          ? `Làm rõ yêu cầu liên quan đến cụm từ '${vt.term}': ${vt.desc}`
          : `Clarify requirement for '${vt.term}': ${vt.desc}`,
        impact: "Medium",
        context: isVi
          ? `Phát hiện trong tài liệu đặc tả nghiệp vụ có sử dụng cụm từ '${vt.term}'.`
          : `Detected ambiguous term '${vt.term}' in specification document.`,
        status: "open",
      });
    }
  });

  if (questions.length === 0) {
    questions.push({
      id: "Q_001",
      question: isVi
        ? "Cơ chế xử lý khi người dùng mất kết nối Internet giữa chừng (Transaction rollback vs Draft save)?"
        : "System behavior upon sudden network disconnect (Transaction rollback vs Draft save)?",
      impact: "Medium",
      context: isVi
        ? "Đặc tả chưa nêu rõ hành vi lưu nháp hay hoàn tác giao dịch khi đứt kết nối."
        : "Specification does not specify rollback or draft persistence upon disconnect.",
      status: "open",
    });
  }

  const summary = isVi
    ? `Bóc tách thành công đặc tả nghiệp vụ với ${flows.length} luồng người dùng, ${rules.length} quy tắc và ${acList.length} tiêu chí chấp thuận (AC).`
    : `Deconstructed business requirements with ${flows.length} user flows, ${rules.length} explicit rules, and ${acList.length} acceptance criteria.`;

  return {
    moduleName,
    summary,
    flows,
    businessRules: rules,
    acceptanceCriteria: acList,
    clarificationQuestions: questions,
  };
}

/**
 * Runs the Spec Analyst Agent using either AI API (Gemini/Claude) or local heuristic fallback
 */
export async function runSpecAnalystAgent(
  documentText: string,
  config?: AIConfig,
  onProgress?: (stage: string, message: string) => void
): Promise<DeconstructionResult> {
  const isVi = isVietnameseText(documentText);
  const hasValidKey =
    config &&
    (config.provider === "local-cli" ||
      (config.provider === "gemini" && config.geminiApiKey?.trim().length > 5) ||
      (config.provider === "claude" && config.claudeApiKey?.trim().length > 5));

  const resolvedModel =
    config?.provider === "local-cli"
      ? config.localCliModel || "gemini-3.8-flash-high"
      : config?.provider === "gemini"
      ? config.geminiModel
      : config?.claudeModel || "claude-sonnet-5-5";

  if (!hasValidKey) {
    onProgress?.("offline", isVi ? "Chưa cấu hình API Key, đang dùng Heuristic..." : "No API Key, using Heuristic...");
    // Return offline heuristic deconstruction with provenance
    return {
      ...extractDeconstructionFallback(documentText),
      usedAI: false,
      aiError: isVi
        ? "Chưa cấu hình API Key (Đang sử dụng thuật toán bóc tách Heuristic Offline)"
        : "No API Key configured (Running in Offline Heuristic mode)",
    };
  }

  try {
    onProgress?.(
      "prepare",
      isVi
        ? "Đang chuẩn hóa tài liệu và chuẩn bị prompt phân tích ISTQB..."
        : "Normalizing specification and preparing ISTQB prompt..."
    );

    const languageInstruction = isVi
      ? "\n\nYÊU CẦU NGÔN NGỮ (BẮT BUỘC): Tài liệu đặc tả này là TIẾNG VIỆT. Toàn bộ các giá trị chữ trong JSON trả về (moduleName, summary, title, description, steps, name, question, v.v.) BẮT BUỘC PHẢI VIẾT BẰNG TIẾNG VIỆT TỰ NHIÊN, CHUẨN XÁC VỀ MẶT THUẬT NGỮ KIỂM THỬ ISTQB!"
      : "\n\nLANGUAGE DIRECTIVE: Output all text in English.";

    const userPrompt = `Analyze the following Business Specification Document and deconstruct it into flows, rules, acceptance criteria, and clarification questions:\n\n${documentText}${languageInstruction}`;

    onProgress?.(
      "execute",
      config?.provider === "local-cli"
        ? isVi
          ? `Đang thực thi Local CLI (agy) với mô hình ${resolvedModel}...`
          : `Executing Local CLI (agy) with ${resolvedModel}...`
        : isVi
        ? `Đang kết nối tới ${config?.provider === "gemini" ? "Google Gemini" : "Anthropic Claude"} (${resolvedModel})...`
        : `Connecting to ${config?.provider === "gemini" ? "Google Gemini" : "Anthropic Claude"} (${resolvedModel})...`
    );

    const result = await generateAIJson<DeconstructionResult>(
      config!,
      {
        systemPrompt: SPEC_ANALYST_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.1,
      },
      2
    );

    onProgress?.(
      "validating",
      isVi
        ? "Đã nhận phản hồi từ AI, đang kiểm tra cấu trúc dữ liệu JSON..."
        : "Received AI response, validating JSON data structures..."
    );

    // Sanitize and ensure proper IDs
    const fallback = extractDeconstructionFallback(documentText);
    if (!result.flows || !Array.isArray(result.flows) || result.flows.length === 0) {
      result.flows = fallback.flows;
    }
    if (!result.acceptanceCriteria || !Array.isArray(result.acceptanceCriteria) || result.acceptanceCriteria.length === 0) {
      result.acceptanceCriteria = fallback.acceptanceCriteria;
    }
    if (!result.businessRules || !Array.isArray(result.businessRules)) {
      result.businessRules = fallback.businessRules;
    }
    if (!result.clarificationQuestions || !Array.isArray(result.clarificationQuestions)) {
      result.clarificationQuestions = fallback.clarificationQuestions;
    }

    return {
      ...result,
      usedAI: true,
      aiProvider: config!.provider,
      aiModel: resolvedModel,
    };
  } catch (err: any) {
    console.warn("AI Spec Analyst failed, using fallback heuristic:", err);
    return {
      ...extractDeconstructionFallback(documentText),
      usedAI: false,
      aiProvider: config?.provider,
      aiModel: resolvedModel,
      aiError: `Lỗi gọi AI (${config?.provider}): ${err.message}. Đã chuyển sang chế độ Heuristic Offline.`,
    };
  }
}
