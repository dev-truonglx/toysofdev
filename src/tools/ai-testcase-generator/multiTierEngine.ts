import { AIConfig } from "../../services/storeService";
import { generateAIJson } from "../../services/aiService";
import {
  TestCase,
  DeconstructionResult,
  GeneratorPreferences,
  AgentProgress,
  TestPriority,
} from "./types";
import { isVietnameseText } from "./specAnalystEngine";

const MULTI_TIER_SYSTEM_PROMPT = `You are a Principal Test Automation & QA Architect leading a multi-tier ISTQB-compliant test generation crew.
Your crew consists of 4 specialist agents:
1. Functional QA Agent: Validates end-to-end user journeys, UI rendering, database persistence, and success confirmations.
2. Boundary & Equivalence Agent: Designs 2-point and 3-point Boundary Value Analysis (Min-1, Min, Min+1, Max-1, Max, Max+1), Equivalence Partitioning (Valid / Invalid), empty/whitespace strings, Unicode/Emoji, and invalid date formats.
   CRITICAL: ALWAYS output CONCRETE TEST DATA VALUES (e.g. "9999", "-1", "admin@domain.com", "2024-02-31"). NEVER use abstract placeholders like "maximum value" or "invalid string".
3. Negative & Edge Case Agent: Focuses on user error and chaos engineering: double-clicking submit buttons, clicking browser back during transactions, opening duplicate sessions across tabs, sudden network drops, and oversized payloads.
4. Security & RBAC Agent: Role-Based Access Control matrix (Admin, Manager, Staff, Guest permissions), deep-link URL/API bypass, and input injection vectors (SQLi: "' OR 1=1 --", XSS: "<script>alert(1)</script>").

CRITICAL LANGUAGE REQUIREMENT:
- You MUST detect the primary language of the deconstructed specification (check moduleName, summary, acceptance criteria).
- IF THE SPECIFICATION IS IN VIETNAMESE (tiếng Việt), ALL TEST CASE TITLES, PRECONDITIONS, TEST DATA DESCRIPTIONS, STEPS, AND EXPECTED RESULTS MUST BE OUTPUT IN 100% NATURAL, ACCURATE VIETNAMESE!
- If the specification is in English, output in English.

OUTPUT FORMAT:
Return a JSON array of test case objects adhering to this schema:
[
  {
    "id": "TC_AUTH_001",
    "module": "string",
    "category": "functional" | "boundary" | "negative" | "security" | "rbac",
    "priority": "P1" | "P2" | "P3" | "P4",
    "reqId": "REQ_001",
    "title": "string",
    "preconditions": "string",
    "testData": "string (CONCRETE VALUE REQUIRED)",
    "steps": [
      "1. Step one with specific action",
      "2. Step two with inputs",
      "3. Step three with trigger"
    ],
    "expectedResult": "string (specific verifiable assertion)",
    "bvaPoint": "min-1" | "min" | "min+1" | "max-1" | "max" | "max+1" | "custom" (optional for boundary),
    "role": "Admin" | "Manager" | "Staff" | "Guest" (optional for rbac)
  }
]

RULES:
- Priority guideline: P1 (Critical business blocker / Auth / Core Money), P2 (High / Primary Happy Paths), P3 (Medium / Boundary & Negative), P4 (Low / Cosmetic & Minor edge).
- Map EVERY test case to a valid Requirement ID (REQ_xxx) from the deconstructed specification.
- Every REQ_xxx must have at least 1 functional/happy path and at least 1 negative/boundary test case for RTM coverage >= 95%.
- Output pure JSON only.`;

/**
 * Deterministic offline test generator that creates a robust, concrete test suite
 * matching ISTQB standards when running offline or without an API key.
 * Automatically adapts between Vietnamese and English.
 */
export function generateOfflineTestSuite(
  deconstruction: DeconstructionResult,
  preferences: GeneratorPreferences
): TestCase[] {
  const isVi = isVietnameseText(`${deconstruction.moduleName} ${deconstruction.summary}`);
  const cases: TestCase[] = [];
  const moduleName = deconstruction.moduleName || (isVi ? "Mô-đun Hệ Thống" : "Core Module");
  const acList = deconstruction.acceptanceCriteria;
  const rules = deconstruction.businessRules;

  let counter = 1;
  const nextId = (cat: string) =>
    `TC_${cat.slice(0, 3).toUpperCase()}_${String(counter++).padStart(3, "0")}`;

  // 1. Functional QA Agent
  if (preferences.enabledCategories.functional) {
    acList.forEach((ac, idx) => {
      cases.push({
        id: nextId("FUN"),
        module: moduleName,
        category: "functional",
        priority: idx === 0 ? "P1" : "P2",
        reqId: ac.id,
        title: isVi ? `Kiểm tra ${ac.title} - Luồng chính (Happy Path)` : `Verify ${ac.title} - Main Happy Path`,
        preconditions: isVi
          ? "Người dùng đã đăng nhập hợp lệ và hệ thống ở trạng thái hoạt động bình thường."
          : "User is authenticated and system is in normal operational state.",
        testData: isVi
          ? "Bộ dữ liệu đầu vào hợp lệ thỏa mãn tất cả tiêu chí nghiệp vụ."
          : "Valid input payload matching all business criteria.",
        steps: isVi
          ? [
              "1. Truy cập vào màn hình chức năng của mô-đun.",
              "2. Nhập đầy đủ dữ liệu thử nghiệm hợp lệ cho các trường bắt buộc.",
              "3. Nhấn nút Gửi / Xác nhận giao dịch.",
              "4. Quan sát phản hồi của hệ thống và kiểm tra thông báo trạng thái.",
            ]
          : [
              "1. Navigate to the module screen or endpoint.",
              "2. Enter valid test data for all required fields.",
              "3. Click the primary submission or confirmation button.",
              "4. Observe system response and verify visual indicators.",
            ],
        expectedResult: isVi
          ? "Hệ thống xử lý giao dịch thành công, lưu vết dữ liệu vào cơ sở dữ liệu và hiển thị thông báo thành công."
          : "System processes request successfully, persists data into storage, and displays a success toast/message.",
      });
    });
  }

  // 2. Boundary & Equivalence Agent
  if (preferences.enabledCategories.boundary) {
    rules
      .filter((r) => r.category === "data-constraint" || r.min !== undefined || r.max !== undefined)
      .forEach((rule, idx) => {
        const minVal = typeof rule.min === "number" ? rule.min : 6;
        const maxVal = typeof rule.max === "number" ? rule.max : 30;
        const targetReq = acList[idx % acList.length]?.id || "REQ_001";

        // Boundary Min-1 (Invalid)
        cases.push({
          id: nextId("BOU"),
          module: moduleName,
          category: "boundary",
          priority: "P3",
          reqId: targetReq,
          title: isVi
            ? `Kiểm tra giá trị biên dưới vi phạm (Min - 1) cho '${rule.name}'`
            : `Boundary Min-1 Check for ${rule.name}`,
          preconditions: isVi ? "Biểu mẫu nhập liệu đang mở và sẵn sàng nhận dữ liệu." : "Target input form is open and ready for data entry.",
          testData: `String of length ${Math.max(0, minVal - 1)}: "${"a".repeat(Math.max(0, minVal - 1))}"`,
          steps: isVi
            ? [
                `1. Trỏ con trỏ vào trường '${rule.field || rule.name}'.`,
                `2. Nhập chuỗi ký tự có độ dài ${Math.max(0, minVal - 1)} (dưới ngưỡng tối thiểu).`,
                "3. Kích hoạt sự kiện blur hoặc nhấn nút Gửi.",
              ]
            : [
                `1. Focus on field '${rule.field || rule.name}'.`,
                `2. Input string of length ${Math.max(0, minVal - 1)}.`,
                "3. Trigger blur or click submit.",
              ],
          expectedResult: isVi
            ? `Hệ thống hiển thị lỗi xác thực: 'Độ dài tối thiểu yêu cầu là ${minVal} ký tự'. Thao tác gửi bị chặn.`
            : `Validation error is displayed indicating minimum required length is ${minVal}. Form submission is prevented.`,
          bvaPoint: "min-1",
        });

        // Boundary Min (Valid)
        cases.push({
          id: nextId("BOU"),
          module: moduleName,
          category: "boundary",
          priority: "P2",
          reqId: targetReq,
          title: isVi
            ? `Kiểm tra giá trị biên chuẩn xác (Exact Min) cho '${rule.name}'`
            : `Boundary Exact Min Check for ${rule.name}`,
          preconditions: isVi ? "Biểu mẫu nhập liệu đang mở và sẵn sàng nhận dữ liệu." : "Target input form is open and ready for data entry.",
          testData: `String of exact length ${minVal}: "${"a".repeat(minVal)}"`,
          steps: isVi
            ? [
                `1. Trỏ con trỏ vào trường '${rule.field || rule.name}'.`,
                `2. Nhập chuỗi ký tự có độ dài chính xác bằng ${minVal}.`,
                "3. Kích hoạt sự kiện blur hoặc nhấn nút Gửi.",
              ]
            : [
                `1. Focus on field '${rule.field || rule.name}'.`,
                `2. Input string of exact length ${minVal}.`,
                "3. Trigger blur or click submit.",
              ],
          expectedResult: isVi
            ? "Hệ thống chấp nhận dữ liệu hợp lệ, không hiển thị bất kỳ cảnh báo lỗi nào."
            : "Input is accepted as valid without validation warnings.",
          bvaPoint: "min",
        });

        // Boundary Max (Valid)
        cases.push({
          id: nextId("BOU"),
          module: moduleName,
          category: "boundary",
          priority: "P2",
          reqId: targetReq,
          title: isVi
            ? `Kiểm tra giá trị biên tối đa hợp lệ (Exact Max) cho '${rule.name}'`
            : `Boundary Exact Max Check for ${rule.name}`,
          preconditions: isVi ? "Biểu mẫu nhập liệu đang mở và sẵn sàng nhận dữ liệu." : "Target input form is open and ready for data entry.",
          testData: `String of exact length ${maxVal}: "${"x".repeat(maxVal)}"`,
          steps: isVi
            ? [
                `1. Trỏ con trỏ vào trường '${rule.field || rule.name}'.`,
                `2. Nhập chuỗi ký tự có độ dài chính xác bằng ${maxVal}.`,
                "3. Kích hoạt sự kiện blur hoặc nhấn nút Gửi.",
              ]
            : [
                `1. Focus on field '${rule.field || rule.name}'.`,
                `2. Input string of exact length ${maxVal}.`,
                "3. Trigger blur or click submit.",
              ],
          expectedResult: isVi
            ? "Dữ liệu được chấp nhận hợp lệ mà không bị cắt ngắn (truncation) hoặc báo lỗi."
            : "Input is accepted as valid without truncation or errors.",
          bvaPoint: "max",
        });

        // Boundary Max+1 (Invalid)
        cases.push({
          id: nextId("BOU"),
          module: moduleName,
          category: "boundary",
          priority: "P3",
          reqId: targetReq,
          title: isVi
            ? `Kiểm tra vượt ngưỡng tối đa (Max + 1 Overflow) cho '${rule.name}'`
            : `Boundary Max+1 Overflow Check for ${rule.name}`,
          preconditions: isVi ? "Biểu mẫu nhập liệu đang mở và sẵn sàng nhận dữ liệu." : "Target input form is open and ready for data entry.",
          testData: `String of length ${maxVal + 1}: "${"x".repeat(maxVal + 1)}"`,
          steps: isVi
            ? [
                `1. Trỏ con trỏ vào trường '${rule.field || rule.name}'.`,
                `2. Nhập chuỗi ký tự có độ dài ${maxVal + 1} (vượt ngưỡng cho phép).`,
                "3. Kích hoạt sự kiện blur hoặc nhấn nút Gửi.",
              ]
            : [
                `1. Focus on field '${rule.field || rule.name}'.`,
                `2. Input string of length ${maxVal + 1}.`,
                "3. Trigger blur or click submit.",
              ],
          expectedResult: isVi
            ? `Hệ thống hiển thị lỗi: 'Độ dài tối đa không được vượt quá ${maxVal} ký tự'. Thao tác gửi bị chặn.`
            : `Validation error is displayed indicating maximum allowed length is ${maxVal}. Submission blocked.`,
          bvaPoint: "max+1",
        });
      });

    // Special Format Boundaries (Empty, whitespace, special unicode)
    const fallbackReq = acList[0]?.id || "REQ_001";
    cases.push({
      id: nextId("BOU"),
      module: moduleName,
      category: "boundary",
      priority: "P3",
      reqId: fallbackReq,
      title: isVi ? "Kiểm tra xử lý chuỗi rỗng và chuỗi toàn khoảng trắng" : "Verify Empty String and Whitespace Handling",
      preconditions: isVi ? "Biểu mẫu hiển thị với các giá trị mặc định." : "Form loaded with default values.",
      testData: `"   " (ba khoảng trắng)`,
      steps: isVi
        ? [
            "1. Nhập khoảng trắng vào các trường thông tin bắt buộc.",
            "2. Nhấn nút Gửi / Lưu.",
          ]
        : [
            "1. Enter three spaces into mandatory fields.",
            "2. Click Submit.",
          ],
      expectedResult: isVi
        ? "Hệ thống tự động cắt tỉa (trim) khoảng trắng và báo lỗi 'Trường này là bắt buộc'."
        : "System trims input and displays 'Field is required' error.",
      bvaPoint: "custom",
    });

    cases.push({
      id: nextId("BOU"),
      module: moduleName,
      category: "boundary",
      priority: "P4",
      reqId: fallbackReq,
      title: isVi ? "Kiểm tra nhập liệu Unicode tiếng Việt có dấu và Emoji" : "Verify Multilingual Unicode and Emoji Input",
      preconditions: isVi ? "Biểu mẫu đang mở trong phiên làm việc." : "Form loaded in active browser session.",
      testData: `"Tiếng Việt có dấu 🚀 và kí tự đặc biệt &%$#@"`,
      steps: isVi
        ? [
            "1. Nhập chuỗi UTF-8 đa byte và emoji vào các ô văn bản.",
            "2. Nhấn lưu và kiểm tra bản ghi được hiển thị trên giao diện cũng như trong CSDL.",
          ]
        : [
            "1. Enter UTF-8 multi-byte characters and emojis into text fields.",
            "2. Submit form and view saved record.",
          ],
      expectedResult: isVi
        ? "Dữ liệu được mã hóa đúng UTF-8, không bị lỗi font (mojibake) hay mất dữ liệu khi lưu."
        : "Data is encoded properly without character corruption (mojibake) in UI and DB.",
      bvaPoint: "custom",
    });
  }

  // 3. Negative & Edge Case Agent
  if (preferences.enabledCategories.negative) {
    const primaryReq = acList[0]?.id || "REQ_001";
    cases.push({
      id: nextId("NEG"),
      module: moduleName,
      category: "negative",
      priority: "P2",
      reqId: primaryReq,
      title: isVi
        ? "Chống thao tác bấm đúp liên tiếp (Double-Click Submit Debounce & Idempotency)"
        : "Prevent Double-Click Rapid Submit (Debounce & Idempotency)",
      preconditions: isVi ? "Đã điền đầy đủ dữ liệu hợp lệ vào biểu mẫu." : "Valid form data filled.",
      testData: isVi ? "Hành động nhấn đúp chuột liên tiếp (2 click trong vòng 80ms)." : "Rapid click event (two clicks within 80ms).",
      steps: isVi
        ? [
            "1. Điền thông tin hợp lệ vào form.",
            "2. Nhấn nút Gửi liên tục 2 lần thật nhanh.",
          ]
        : [
            "1. Fill valid data in all required fields.",
            "2. Click the Submit button twice in rapid succession.",
          ],
      expectedResult: isVi
        ? "Nút Gửi lập tức bị vô hiệu hóa (disabled) ngay từ cú click đầu tiên. Chỉ có duy nhất 1 request gửi đi máy chủ; không tạo đơn/dữ liệu trùng lặp."
        : "Submit button is immediately disabled upon first click. Only 1 backend request is dispatched; no duplicate records are created.",
    });

    cases.push({
      id: nextId("NEG"),
      module: moduleName,
      category: "negative",
      priority: "P2",
      reqId: primaryReq,
      title: isVi
        ? "Bấm nút Back trình duyệt khi giao dịch đang được xử lý (In-Flight Processing)"
        : "Browser Back Navigation During In-Flight Processing",
      preconditions: isVi ? "Người dùng đang trong quá trình thực hiện một giao dịch thanh toán hoặc gửi form." : "User is in the middle of a transaction.",
      testData: isVi ? "Hành động điều hướng Back của trình duyệt (Alt+Left hoặc nút Back)." : "Browser back navigation triggered via Alt+Left or back button.",
      steps: isVi
        ? [
            "1. Nhấn nút gửi giao dịch.",
            "2. Ngay lập tức bấm nút Back trên trình duyệt trước khi có phản hồi từ máy chủ.",
          ]
        : [
            "1. Submit a multi-step or transaction process.",
            "2. Immediately click the browser Back button before server response arrives.",
          ],
      expectedResult: isVi
        ? "Hệ thống cảnh báo người dùng an toàn hoặc hoàn tất giao dịch ngầm mà không gây ra trạng thái xung đột dữ liệu."
        : "System gracefully warns user or completes transaction in background without inconsistent database state.",
    });

    cases.push({
      id: nextId("NEG"),
      module: moduleName,
      category: "negative",
      priority: "P3",
      reqId: primaryReq,
      title: isVi ? "Hết hạn phiên đăng nhập trong lúc đang điền biểu mẫu" : "Session Expiry During Form Completion",
      preconditions: isVi ? "Người dùng mở biểu mẫu và để quá thời gian hết hạn phiên làm việc." : "User leaves form open until auth session expires.",
      testData: isVi ? "Header phiên làm việc hoặc JWT token đã hết hạn." : "Expired JWT / Auth token header.",
      steps: isVi
        ? [
            "1. Mở biểu mẫu và để phiên đăng nhập hết hạn.",
            "2. Điền thông tin và bấm nút Lưu.",
          ]
        : [
            "1. Open form and let auth token expire (or invalidate cookie).",
            "2. Fill form and submit.",
          ],
      expectedResult: isVi
        ? "Hệ thống bắt mã lỗi 401 Unauthorized, tự động lưu bản nháp vào bộ nhớ tạm và hiển thị modal đăng nhập lại mà không làm mất dữ liệu đã nhập."
        : "System intercepts 401 Unauthorized, preserves form draft state in local cache, and prompts login modal without data loss.",
    });
  }

  // 4. Security & RBAC Agent
  if (preferences.enabledCategories.security) {
    const secReq = acList[0]?.id || "REQ_001";
    cases.push({
      id: nextId("SEC"),
      module: moduleName,
      category: "security",
      priority: "P1",
      reqId: secReq,
      title: isVi
        ? "Kiểm thử khả năng phòng chống tấn công SQL Injection trên các ô nhập liệu"
        : "SQL Injection Payload Resistance on Input Fields",
      preconditions: isVi ? "Biểu mẫu tìm kiếm hoặc nhập liệu đang truy cập được." : "Target input form is accessible.",
      testData: `' OR '1'='1' -- and admin' --`,
      steps: isVi
        ? [
            "1. Nhập payload SQL injection vào các ô tìm kiếm hoặc dữ liệu đầu vào.",
            "2. Nhấn nút Tìm kiếm hoặc Gửi biểu mẫu.",
          ]
        : [
            "1. Insert SQL injection payload into search and filter fields.",
            "2. Submit query.",
          ],
      expectedResult: isVi
        ? "Hệ thống làm sạch dữ liệu đầu vào, sử dụng Parameterized Query. Không lộ lỗi cú pháp CSDL thô hoặc rò rỉ bản ghi trái phép."
        : "System sanitizes inputs and uses parameterized queries. No raw database syntax errors or unauthorized records leaked.",
    });

    cases.push({
      id: nextId("SEC"),
      module: moduleName,
      category: "security",
      priority: "P1",
      reqId: secReq,
      title: isVi
        ? "Kiểm thử phòng chống tấn công mã độc Cross-Site Scripting (XSS)"
        : "Cross-Site Scripting (Stored & Reflected XSS) Defense",
      preconditions: isVi ? "Biểu mẫu nhập liệu hiển thị trên giao diện người dùng." : "Target input form is accessible.",
      testData: `<script>alert(document.cookie)</script><img src=x onerror=alert(1)>`,
      steps: isVi
        ? [
            "1. Chèn các thẻ script HTML và payload mã độc JavaScript vào các ô văn bản.",
            "2. Nhấn lưu và mở trang xem lại kết quả đã lưu.",
          ]
        : [
            "1. Input HTML and JavaScript injection payloads into text fields.",
            "2. Submit and view the rendered result on the output view.",
          ],
      expectedResult: isVi
        ? "Payload được mã hóa thực thể HTML an toàn (&lt;script&gt;), script độc hại hoàn toàn không bị thực thi trên trình duyệt của người dùng."
        : "Payload is escaped as safe text entities (&lt;script&gt;). Script execution does not trigger in user browser.",
    });
  }

  // 5. RBAC Agent
  if (preferences.enabledCategories.rbac) {
    const rbacReq = acList[0]?.id || "REQ_001";
    const roles: Array<{ role: string; canEdit: boolean; priority: TestPriority }> = [
      { role: "Admin", canEdit: true, priority: "P1" },
      { role: "Manager", canEdit: true, priority: "P2" },
      { role: "Staff", canEdit: false, priority: "P2" },
      { role: "Guest", canEdit: false, priority: "P1" },
    ];

    roles.forEach((r) => {
      cases.push({
        id: nextId("RBA"),
        module: moduleName,
        category: "rbac",
        priority: r.priority,
        reqId: rbacReq,
        title: isVi
          ? `Kiểm tra ma trận phân quyền RBAC cho vai trò: ${r.role}`
          : `RBAC Access Control Verification for Role: ${r.role}`,
        preconditions: isVi ? `Đăng nhập hệ thống với quyền vai trò '${r.role}'.` : `Authenticated with role '${r.role}'.`,
        testData: `User role claim = ${r.role}`,
        steps: isVi
          ? [
              `1. Đăng nhập với tài khoản có quyền '${r.role}'.`,
              "2. Thử nghiệm thực hiện các quyền Thêm (Create), Xem (Read), Sửa (Update), Xóa (Delete).",
            ]
          : [
              `1. Log in with user having '${r.role}' role privileges.`,
              "2. Attempt to perform Create, Read, Update, and Delete operations.",
            ],
        expectedResult: r.canEdit
          ? (isVi ? `Người dùng với vai trò '${r.role}' thực hiện thành công các thao tác được phép.` : `User '${r.role}' successfully performs authorized operations.`)
          : (isVi ? `Hệ thống trả về mã lỗi 403 Forbidden. Các nút thao tác chỉnh sửa/xóa bị ẩn hoặc vô hiệu hóa cho '${r.role}'.` : `System displays 403 Forbidden. Action buttons are hidden or disabled for '${r.role}'.`),
        role: r.role,
      });
    });
  }

  return cases;
}

/**
 * Runs Multi-Tier Agent generation crew
 */
export async function runMultiTierGeneratorCrew(
  deconstruction: DeconstructionResult,
  preferences: GeneratorPreferences,
  config?: AIConfig,
  onProgress?: (progress: AgentProgress) => void
): Promise<TestCase[]> {
  const isVi = isVietnameseText(`${deconstruction.moduleName} ${deconstruction.summary}`);
  const hasValidKey =
    config &&
    (config.provider === "local-cli" ||
      (config.provider === "gemini" && config.geminiApiKey?.trim().length > 5) ||
      (config.provider === "claude" && config.claudeApiKey?.trim().length > 5));

  if (!hasValidKey) {
    // Run offline generator with simulated progress updates for smooth UX
    onProgress?.({ agentName: isVi ? "Functional QA Agent" : "Functional QA Agent", status: "running", message: isVi ? "Đang thiết kế kịch bản Happy Path..." : "Designing Happy Path scenarios..." });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ agentName: isVi ? "Boundary & Equivalence Agent" : "Boundary & Equivalence Agent", status: "running", message: isVi ? "Đang tính toán giá trị biên 2-point/3-point cụ thể..." : "Computing concrete 2-point/3-point BVA values..." });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ agentName: isVi ? "Negative & Edge Case Agent" : "Negative & Edge Case Agent", status: "running", message: isVi ? "Đang mô phỏng lỗi người dùng và sự cố gián đoạn..." : "Simulating double-clicks, timeouts & network disruptions..." });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ agentName: isVi ? "Security & RBAC Agent" : "Security & RBAC Agent", status: "running", message: isVi ? "Đang đánh giá ma trận phân quyền và injection..." : "Evaluating injection payloads and permission matrices..." });
    await new Promise((r) => setTimeout(r, 200));

    const suite = generateOfflineTestSuite(deconstruction, preferences);
    onProgress?.({
      agentName: "Multi-Tier QA Crew",
      status: "done",
      message: isVi ? `Đã sinh thành công ${suite.length} test case toàn diện (Offline).` : `Generated ${suite.length} comprehensive test cases.`,
      count: suite.length,
    });
    return suite;
  }

  // Call AI Multi-Agent Prompt
  try {
    onProgress?.({
      agentName: "Multi-Tier QA Crew",
      status: "running",
      message: isVi
        ? `Đang gọi AI (${config!.provider.toUpperCase()}) điều phối dàn Agent Functional, BVA, Negative, Security...`
        : "Orchestrating Functional, Boundary, Negative, and Security agents...",
    });

    const languageInstruction = isVi
      ? "\n\nYÊU CẦU NGÔN NGỮ (BẮT BUỘC): Toàn bộ tiêu đề test case, tiền điều kiện, các bước thực hiện và kết quả mong đợi PHẢI LÀ TIẾNG VIỆT CHUẨN XÁC VÀ TỰ NHIÊN!"
      : "\n\nLANGUAGE DIRECTIVE: Output all test case fields in English.";

    const userPrompt =
      `Generate a multi-tier test case suite based on this deconstructed specification:\n\n` +
      `Module Name: ${deconstruction.moduleName}\n` +
      `Summary: ${deconstruction.summary}\n\n` +
      `Acceptance Criteria:\n${JSON.stringify(deconstruction.acceptanceCriteria, null, 2)}\n\n` +
      `Business Rules:\n${JSON.stringify(deconstruction.businessRules, null, 2)}\n\n` +
      `Enabled Categories: ${JSON.stringify(preferences.enabledCategories)}\n` +
      `Granularity: ${preferences.granularity}${languageInstruction}`;

    const generated = await generateAIJson<TestCase[]>(
      config!,
      {
        systemPrompt: MULTI_TIER_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.2,
      },
      2
    );

    if (Array.isArray(generated) && generated.length > 0) {
      onProgress?.({
        agentName: "Multi-Tier QA Crew",
        status: "done",
        message: isVi
          ? `Dàn AI Agent đã sinh thành công ${generated.length} test case đạt chuẩn!`
          : `Successfully generated ${generated.length} test cases with AI agents.`,
        count: generated.length,
      });
      return generated;
    }

    throw new Error("AI returned empty test case suite");
  } catch (err: any) {
    console.warn("AI generation failed, falling back to deterministic suite:", err);
    onProgress?.({
      agentName: "Multi-Tier QA Crew",
      status: "done",
      message: isVi
        ? `Lỗi gọi AI (${err.message}). Đã chuyển sang sinh test suite bằng Heuristic Offline.`
        : "Generated test suite using deterministic ISTQB heuristics (fallback).",
    });
    return generateOfflineTestSuite(deconstruction, preferences);
  }
}
