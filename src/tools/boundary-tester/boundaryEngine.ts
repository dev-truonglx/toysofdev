export type BoundaryType = "string-length" | "number-range" | "email-format" | "custom-limits";

export interface BoundaryCase {
  id: string;
  category: string;
  type: string;
  title: string;
  description: string;
  testValue: string;
  expectedResult: string;
}

export interface StringConfig {
  minLength: number;
  maxLength: number;
  charset: "alphanumeric" | "alphabetic" | "numeric" | "unicode" | "all";
}

export interface NumberConfig {
  minValue: number;
  maxValue: number;
  allowDecimals: boolean;
  decimalPlaces: number;
}

export interface SecurityPayloadItem {
  id: string;
  group: "XSS" | "SQL Injection" | "NoSQL Injection" | "Command Injection" | "Path Traversal" | "String Breakers";
  name: string;
  payload: string;
  description: string;
  exampleScenario: string;
  expectedBehavior: string;
}

export const SECURITY_PAYLOADS_EN: SecurityPayloadItem[] = [
  // XSS
  {
    id: "xss-script-tag",
    group: "XSS",
    name: "Classic Script Tag",
    payload: `<script>alert('XSS')</script>`,
    description: "Basic reflected/stored XSS script execution.",
    exampleScenario: "Comment box or username rendered directly as HTML: <div>Welcome, {username}</div> without escaping.",
    expectedBehavior: "Must be escaped / sanitized as plain text",
  },
  {
    id: "xss-img-onerror",
    group: "XSS",
    name: "Image OnError Event",
    payload: `<img src=x onerror=alert(1)>`,
    description: "Inline event handler executed on broken image link.",
    exampleScenario: "Rich text bio or message post: browser attempts loading broken image 'x' and immediately triggers onerror JS handler.",
    expectedBehavior: "Must be stripped or HTML-entity encoded",
  },
  {
    id: "xss-svg-onload",
    group: "XSS",
    name: "SVG OnLoad Event",
    payload: `<svg/onload=alert('XSS')>`,
    description: "SVG vector payload bypassing weak tag filters.",
    exampleScenario: "Wysiwyg editor filtering <script> tags but allowing <svg> elements: script runs as soon as DOM parses the SVG.",
    expectedBehavior: "Must be sanitized by stripping inline event handlers",
  },
  {
    id: "xss-quote-breakout",
    group: "XSS",
    name: "Attribute Breakout",
    payload: `"><script>alert(document.cookie)</script>`,
    description: "Breaks out of HTML tag input attributes.",
    exampleScenario: "Search box reflecting keyword: <input type='text' value='USER_INPUT'>. The quote closes the value attribute and executes the injected script.",
    expectedBehavior: "Quotes must be HTML-entity encoded (&quot;)",
  },
  {
    id: "xss-javascript-pseudo",
    group: "XSS",
    name: "Javascript Pseudo-protocol",
    payload: `javascript:alert('XSS')`,
    description: "Tests href / src attribute URL injection.",
    exampleScenario: "User profile website link: <a href='USER_URL'>Website</a>. Clicking the link triggers arbitrary JavaScript in the victim's session.",
    expectedBehavior: "Reject non-http/https URL schemes",
  },

  // SQL Injection
  {
    id: "sqli-auth-bypass-1",
    group: "SQL Injection",
    name: "Classic Auth Bypass",
    payload: `' OR '1'='1`,
    description: "Forces WHERE clause to evaluate to true.",
    exampleScenario: "Login query: SELECT * FROM users WHERE username = 'INPUT' AND password = '...'. The condition evaluates to TRUE, granting admin access without password.",
    expectedBehavior: "Must use parameterized queries / prepared statements",
  },
  {
    id: "sqli-comment-dash",
    group: "SQL Injection",
    name: "Comment Line Bypass",
    payload: `admin' --`,
    description: "Trims password check with SQL comment characters.",
    exampleScenario: "Login form: SELECT * FROM users WHERE user = 'admin' --' AND pass = '...'. Truncates password validation entirely.",
    expectedBehavior: "Parameterized query prevents query syntax tampering",
  },
  {
    id: "sqli-union-select",
    group: "SQL Injection",
    name: "Union-based Extraction",
    payload: `' UNION SELECT NULL, username, password FROM users --`,
    description: "Attempts schema or table enumeration via UNION.",
    exampleScenario: "Product catalog filter: GET /products?category=INPUT. Extracts sensitive columns from the database and displays them in product list.",
    expectedBehavior: "Blocked, sanitized, and logged as suspicious query",
  },
  {
    id: "sqli-time-delay",
    group: "SQL Injection",
    name: "Time-based Blind Injection",
    payload: `1; WAITFOR DELAY '0:0:5'--`,
    description: "Tests asynchronous delay vulnerability in SQL server.",
    exampleScenario: "API endpoint GET /api/user?id=1; WAITFOR DELAY '0:0:5'--. If the response takes 5 seconds, it confirms SQL injection even without error messages.",
    expectedBehavior: "Query returns immediately without sleep execution",
  },

  // NoSQL Injection
  {
    id: "nosqli-gt-empty",
    group: "NoSQL Injection",
    name: "MongoDB $gt Operator",
    payload: `{"$gt": ""}`,
    description: "JSON query operator injection to bypass string equality.",
    exampleScenario: "JSON Login: {\"username\": {\"$gt\": \"\"}, \"password\": {\"$gt\": \"\"}}. Matches any non-empty user in MongoDB db.users.findOne().",
    expectedBehavior: "Schema validation must enforce string type only",
  },
  {
    id: "nosqli-ne-null",
    group: "NoSQL Injection",
    name: "MongoDB $ne Operator",
    payload: `{"$ne": null}`,
    description: "Matches any non-null record in MongoDB.",
    exampleScenario: "Password reset endpoint POST /reset with {\"token\": {\"$ne\": null}}. Matches any record with a valid reset token without guessing it.",
    expectedBehavior: "Rejects object inputs for scalar fields",
  },

  // Command Injection
  {
    id: "cmd-pipe-id",
    group: "Command Injection",
    name: "Pipe OS Command (| id)",
    payload: `| id`,
    description: "Tests unescaped shell exec or system() invocation.",
    exampleScenario: "Network ping utility: system('ping -c 1 ' + host). Passing 8.8.8.8 | id executes the 'id' binary and returns server OS permissions.",
    expectedBehavior: "Sanitized or passed directly to safe child_process API",
  },
  {
    id: "cmd-semicolon-whoami",
    group: "Command Injection",
    name: "Semicolon Command Chaining",
    payload: `; whoami`,
    description: "Executes secondary command in Unix/Linux shell.",
    exampleScenario: "File converter backend: exec('ffmpeg -i ' + filename + ' out.mp4'). Passing video.mp4; whoami chains and executes the whoami command.",
    expectedBehavior: "Input treated as literal argument, not shell string",
  },
  {
    id: "cmd-subshell",
    group: "Command Injection",
    name: "Subshell Evaluation $(...)",
    payload: `$(cat /etc/passwd)`,
    description: "Evaluates bash command inside subshell substitution.",
    exampleScenario: "PDF report generator passing title to script: ./make-pdf.sh \"TITLE\". Injected $(cat /etc/passwd) reads password file and embeds it into the PDF.",
    expectedBehavior: "No shell evaluation occurs",
  },

  // Path Traversal
  {
    id: "lfi-unix-passwd",
    group: "Path Traversal",
    name: "Unix Path Traversal (../)",
    payload: `../../../../etc/passwd`,
    description: "Attempts arbitrary file read on Linux/Unix hosts.",
    exampleScenario: "File download endpoint: GET /download?file=../../../../etc/passwd. Path concatenation '/var/www/files/' + file exposes the system password file.",
    expectedBehavior: "Path normalization and sandbox containment",
  },
  {
    id: "lfi-windows-winini",
    group: "Path Traversal",
    name: "Windows Traversal (..\\)",
    payload: `..\\..\\..\\..\\windows\\win.ini`,
    description: "Attempts arbitrary file read on Windows servers.",
    exampleScenario: "Config reader: GET /view?path=..\\..\\..\\..\\windows\\win.ini. Bypasses forward-slash filters and exposes Windows system files.",
    expectedBehavior: "Path normalization and forbidden directory escape",
  },
  {
    id: "lfi-url-encoded",
    group: "Path Traversal",
    name: "URL Encoded Traversal (%2e%2e%2f)",
    payload: `%2e%2e%2f%2e%2e%2fetc%2fpasswd`,
    description: "Double decoding vulnerability test.",
    exampleScenario: "Image proxy: GET /img?url=%2e%2e%2f%2e%2e%2fetc%2fpasswd. Reverse proxy and backend both decode once, bypassing single-decode WAF filters.",
    expectedBehavior: "Safely decoded and rejected",
  },

  // String Breakers
  {
    id: "breaker-null-byte",
    group: "String Breakers",
    name: "Null Byte Injection (%00 / \\0)",
    payload: `test_file.png\x00.exe`,
    description: "Tests C-string null termination truncation in file validators.",
    exampleScenario: "Avatar upload checking extension: filename validator stops at \\0 and sees .png, but Windows/Unix creates an executable .exe payload file.",
    expectedBehavior: "Full string checked or null byte stripped",
  },
  {
    id: "breaker-crlf-header",
    group: "String Breakers",
    name: "CRLF Injection (\\r\\n)",
    payload: `user\r\nSet-Cookie: admin=true`,
    description: "Tests HTTP header splitting and response corruption.",
    exampleScenario: "Redirect parameter: GET /redirect?url=google.com%0d%0aSet-Cookie:%20admin=true. Injects extra header line setting unauthorized admin session cookie.",
    expectedBehavior: "Disallow newlines in single-line headers",
  },
  {
    id: "breaker-rtl-trojan",
    group: "String Breakers",
    name: "RTL Override Char (\\u202E)",
    payload: `document\u202Egpj.exe`,
    description: "Visual disguise flipping extension display direction.",
    exampleScenario: "Attachment named invoice\\u202Egpj.exe. Displays visually as invoiceexe.jpg in file explorer, tricking users into executing malware.",
    expectedBehavior: "Normalized or flagged as suspicious character",
  },
  {
    id: "breaker-zalgo-text",
    group: "String Breakers",
    name: "Zalgo / Glitch Combining Marks",
    payload: `T̶̖̆e̵̖̋s̷̺͊ṯ̶̈`,
    description: "Tests rendering crash or DB unicode collation issues.",
    exampleScenario: "User profile name with stacked Unicode combining marks: causes UI layout overflow, browser freezing, or database encoding errors.",
    expectedBehavior: "Rendered safely or stripped to normalized text",
  },
  {
    id: "breaker-emojis-multibyte",
    group: "String Breakers",
    name: "4-Byte UTF-8 Emojis (utf8mb4)",
    payload: `🚀🔥💯🎉✨`,
    description: "Tests database support for 4-byte UTF-8 without crashing.",
    exampleScenario: "Entering 4-byte emojis into MySQL tables configured with legacy utf8 (3-byte limit) instead of utf8mb4 causes 500 error or silent text truncation.",
    expectedBehavior: "Stored and retrieved without ? replacement or error",
  },
];

export const SECURITY_PAYLOADS_VI: SecurityPayloadItem[] = [
  // XSS
  {
    id: "xss-script-tag",
    group: "XSS",
    name: "Thẻ Script Cổ Điển",
    payload: `<script>alert('XSS')</script>`,
    description: "Mã khai thác XSS Reflected / Stored cơ bản chèn script thực thi.",
    exampleScenario: "Ô bình luận hoặc tên người dùng hiển thị trực tiếp ra HTML: <div>Xin chào, {username}</div>. Khi không escape, script sẽ tự động chạy trong phiên của người xem.",
    expectedBehavior: "Phải được escape / sanitize dưới dạng văn bản an toàn",
  },
  {
    id: "xss-img-onerror",
    group: "XSS",
    name: "Sự Kiện OnError Của Thẻ Img",
    payload: `<img src=x onerror=alert(1)>`,
    description: "Thực thi JavaScript qua trình xử lý sự kiện khi ảnh tải lỗi.",
    exampleScenario: "Ô tiểu sử hoặc bài viết dạng rich text: trình duyệt tải ảnh từ nguồn 'x' bị lỗi sẽ lập tức kích hoạt sự kiện onerror thực thi JavaScript độc hại.",
    expectedBehavior: "Phải loại bỏ hoặc mã hóa các ký tự HTML nguy hiểm",
  },
  {
    id: "xss-svg-onload",
    group: "XSS",
    name: "Sự Kiện OnLoad Của Thẻ SVG",
    payload: `<svg/onload=alert('XSS')>`,
    description: "Vector tấn công SVG vượt qua bộ lọc thẻ HTML thông thường.",
    exampleScenario: "Bộ soạn thảo chỉ lọc thẻ <script> nhưng cho phép nhúng <svg>: trình duyệt phân tích thẻ SVG sẽ kích hoạt sự kiện onload thực thi mã độc.",
    expectedBehavior: "Phải được làm sạch và lọc bỏ các sự kiện inline độc hại",
  },
  {
    id: "xss-quote-breakout",
    group: "XSS",
    name: "Thoát Khỏi Thuộc Tính HTML (Breakout)",
    payload: `"><script>alert(document.cookie)</script>`,
    description: "Dùng dấu ngoặc kép thoát khỏi giá trị thuộc tính HTML để chèn script.",
    exampleScenario: "Ô tìm kiếm hiển thị lại từ khóa: <input type='text' value='USER_INPUT'>. Dấu ngoặc kép sẽ đóng thẻ input và khởi chạy thẻ script lấy cắp cookie.",
    expectedBehavior: "Dấu ngoặc kép phải được mã hóa thành thực thể HTML (&quot;)",
  },
  {
    id: "xss-javascript-pseudo",
    group: "XSS",
    name: "Giao Thức Giả Lập javascript:",
    payload: `javascript:alert('XSS')`,
    description: "Kiểm tra chèn mã script vào thuộc tính URL (href / src).",
    exampleScenario: "Ô nhập link website cá nhân: <a href='USER_URL'>Website</a>. Người dùng khác nhấp vào liên kết sẽ kích hoạt mã JavaScript trái phép.",
    expectedBehavior: "Chỉ chấp nhận các giao thức URL an toàn (http, https)",
  },

  // SQL Injection
  {
    id: "sqli-auth-bypass-1",
    group: "SQL Injection",
    name: "Vượt Xác Thực Cổ Điển (Auth Bypass)",
    payload: `' OR '1'='1`,
    description: "Ép mệnh đề WHERE luôn nhận kết quả TRUE để bỏ qua bước đăng nhập.",
    exampleScenario: "Form đăng nhập với câu truy vấn: SELECT * FROM users WHERE user = 'INPUT' AND pass = '...'. Mệnh đề OR '1'='1' luôn đúng giúp đăng nhập mà không cần mật khẩu.",
    expectedBehavior: "Bắt buộc sử dụng Parameterized Queries / Prepared Statements",
  },
  {
    id: "sqli-comment-dash",
    group: "SQL Injection",
    name: "Cắt Đuôi Câu Truy Vấn (--)",
    payload: `admin' --`,
    description: "Dùng ký tự comment để bỏ qua phần kiểm tra mật khẩu phía sau.",
    exampleScenario: "Form đăng nhập: SELECT * FROM users WHERE user = 'admin' --' AND pass = '...'. Dấu -- biến toàn bộ đoạn kiểm tra mật khẩu thành chú thích và bỏ qua.",
    expectedBehavior: "Parameterized Query ngăn chặn thay đổi cú pháp câu lệnh SQL",
  },
  {
    id: "sqli-union-select",
    group: "SQL Injection",
    name: "Trích Xuất Dữ Liệu Qua UNION SELECT",
    payload: `' UNION SELECT NULL, username, password FROM users --`,
    description: "Ghép câu truy vấn UNION để lấy thông tin bảng và cấu trúc schema.",
    exampleScenario: "Tìm kiếm sản phẩm: GET /products?category=INPUT. Ghép thêm câu lệnh UNION để trích xuất danh sách tài khoản mật khẩu người dùng vào danh sách hiển thị.",
    expectedBehavior: "Bị hệ thống chặn và ghi nhận log truy vấn bất thường",
  },
  {
    id: "sqli-time-delay",
    group: "SQL Injection",
    name: "Tấn Công Mù Theo Thời Gian (Time-based Blind)",
    payload: `1; WAITFOR DELAY '0:0:5'--`,
    description: "Thử nghiệm làm trễ phản hồi máy chủ để kiểm tra lỗ hổng SQL Server.",
    exampleScenario: "Gọi API: GET /api/user?id=1; WAITFOR DELAY '0:0:5'--. Nếu máy chủ phản hồi chậm đúng 5 giây, chứng tỏ hệ thống dính lỗ hổng dù không hiển thị lỗi database.",
    expectedBehavior: "Truy vấn trả về ngay lập tức, không thực thi lệnh sleep/delay",
  },

  // NoSQL Injection
  {
    id: "nosqli-gt-empty",
    group: "NoSQL Injection",
    name: "Toán Tử $gt Trong NoSQL / MongoDB",
    payload: `{"$gt": ""}`,
    description: "Chèn toán tử so sánh lớn hơn để vượt qua kiểm tra bằng chuỗi.",
    exampleScenario: "Request đăng nhập dạng JSON: {\"username\": {\"$gt\": \"\"}, \"password\": {\"$gt\": \"\"}}. Trong MongoDB câu lệnh findOne() sẽ khớp với bất kỳ tài khoản nào.",
    expectedBehavior: "Schema validation chỉ chấp nhận kiểu chuỗi, chặn Object",
  },
  {
    id: "nosqli-ne-null",
    group: "NoSQL Injection",
    name: "Toán Tử $ne Trong NoSQL / MongoDB",
    payload: `{"$ne": null}`,
    description: "Khớp với bất kỳ bản ghi nào khác null trong cơ sở dữ liệu MongoDB.",
    exampleScenario: "API đặt lại mật khẩu: POST /api/reset với {\"token\": {\"$ne\": null}}. Hệ thống tìm thấy bản ghi có token hợp lệ bất kỳ và cho phép đổi mật khẩu trái phép.",
    expectedBehavior: "Từ chối đầu vào dạng Object cho các trường dữ liệu đơn giản",
  },

  // Command Injection
  {
    id: "cmd-pipe-id",
    group: "Command Injection",
    name: "Nối Lệnh Hệ Thống Bằng Pipe (| id)",
    payload: `| id`,
    description: "Kiểm tra thực thi trái phép lệnh hệ điều hành qua shell exec.",
    exampleScenario: "Tính năng Ping / kiểm tra mạng: system('ping -c 1 ' + host). Truyền 8.8.8.8 | id sẽ ép máy chủ chạy lệnh 'id' và in ra quyền hạn user hệ thống.",
    expectedBehavior: "Làm sạch ký tự pipe hoặc truyền đối số an toàn qua API child_process",
  },
  {
    id: "cmd-semicolon-whoami",
    group: "Command Injection",
    name: "Chuỗi Lệnh Dấu Chấm Phẩy (; whoami)",
    payload: `; whoami`,
    description: "Nối lệnh thứ hai trong môi trường shell Unix/Linux.",
    exampleScenario: "Tính năng xử lý file / nén video: exec('ffmpeg -i ' + filename + ' out.mp4'). Truyền video.mp4; whoami sẽ chạy tiếp lệnh whoami trong shell.",
    expectedBehavior: "Đầu vào được xử lý dưới dạng chuỗi thuần túy, không thông qua shell",
  },
  {
    id: "cmd-subshell",
    group: "Command Injection",
    name: "Thực Thi Lệnh Trong Subshell $(...)",
    payload: `$(cat /etc/passwd)`,
    description: "Kiểm tra thay thế lệnh ngầm bên trong subshell của bash.",
    exampleScenario: "Tính năng tạo file PDF truyền tiêu đề vào script: sh make-pdf.sh \"TITLE\". Chuỗi $(cat /etc/passwd) sẽ đọc trộm file mật khẩu rồi nhúng vào nội dung PDF.",
    expectedBehavior: "Không diễn dịch cú pháp subshell",
  },

  // Path Traversal
  {
    id: "lfi-unix-passwd",
    group: "Path Traversal",
    name: "Duyệt Đường Dẫn Linux/Unix (../)",
    payload: `../../../../etc/passwd`,
    description: "Thử đọc file nhạy cảm /etc/passwd trên máy chủ Linux/Unix.",
    exampleScenario: "API tải tài liệu: GET /download?file=../../../../etc/passwd. Khi code ghép đường dẫn '/var/www/files/' + file, sẽ bị nhảy về thư mục gốc đọc file nhạy cảm.",
    expectedBehavior: "Chuẩn hóa đường dẫn (Path Normalization) và giới hạn trong thư mục an toàn",
  },
  {
    id: "lfi-windows-winini",
    group: "Path Traversal",
    name: "Duyệt Đường Dẫn Windows (..\\)",
    payload: `..\\..\\..\\..\\windows\\win.ini`,
    description: "Thử đọc file cấu hình hệ thống win.ini trên máy chủ Windows.",
    exampleScenario: "API xem file: GET /view?path=..\\..\\..\\..\\windows\\win.ini. Vượt qua bộ lọc chỉ chặn dấu / để đọc file cấu hình hệ thống trên máy chủ Windows.",
    expectedBehavior: "Chặn thoát khỏi thư mục gốc và chuẩn hóa dấu phân cách đường dẫn",
  },
  {
    id: "lfi-url-encoded",
    group: "Path Traversal",
    name: "Duyệt Thư Mục Mã Hóa URL (%2e%2e%2f)",
    payload: `%2e%2e%2f%2e%2e%2fetc%2fpasswd`,
    description: "Kiểm tra lỗi giải mã hai lần (Double Decoding Vulnerability).",
    exampleScenario: "Proxy tải ảnh: GET /img?url=%2e%2e%2f%2e%2e%2fetc%2fpasswd. Reverse Proxy và Backend cùng decode 1 lần, vượt qua tường lửa WAF chỉ chặn ../ thông thường.",
    expectedBehavior: "Giải mã an toàn và từ chối các đường dẫn vượt cấp",
  },

  // String Breakers
  {
    id: "breaker-null-byte",
    group: "String Breakers",
    name: "Ký Tự Byte Rỗng (Null Byte Injection %00)",
    payload: `test_file.png\x00.exe`,
    description: "Kiểm tra lỗi cắt ngắn chuỗi theo chuẩn C-string trong trình kiểm tra file.",
    exampleScenario: "Upload ảnh đại diện chỉ cho phép đuôi .png: gửi tên avatar.png\\x00.exe. Trình kiểm tra C-string gặp \\0 dừng lại tưởng là .png, nhưng hệ thống lưu file .exe.",
    expectedBehavior: "Kiểm tra toàn bộ chuỗi hoặc loại bỏ byte null",
  },
  {
    id: "breaker-crlf-header",
    group: "String Breakers",
    name: "Chèn Ký Tự Xuống Dòng CRLF (\\r\\n)",
    payload: `user\r\nSet-Cookie: admin=true`,
    description: "Kiểm tra lỗi tách Header HTTP (HTTP Response Splitting).",
    exampleScenario: "Chuyển hướng trang: GET /redirect?url=google.com%0d%0aSet-Cookie:%20admin=true. Xuống dòng CRLF tạo Header HTTP mới lừa trình duyệt lưu cookie admin giả mạo.",
    expectedBehavior: "Cấm các ký tự xuống dòng trong header đơn dòng",
  },
  {
    id: "breaker-rtl-trojan",
    group: "String Breakers",
    name: "Ký Tự Đảo Chiều Chữ Viết RTL (\\u202E)",
    payload: `document\u202Egpj.exe`,
    description: "Đánh lừa thị giác đảo ngược đuôi file thực thi (.exe -> .gpj).",
    exampleScenario: "File đính kèm có tên invoice\\u202Egpj.exe. Ký tự RTL đảo chiều khiến Windows hiển thị thành invoiceexe.jpg, lừa người dùng mở file virus.",
    expectedBehavior: "Chuẩn hóa hoặc cảnh báo ký tự điều khiển Unicode đáng ngờ",
  },
  {
    id: "breaker-zalgo-text",
    group: "String Breakers",
    name: "Văn Bản Zalgo / Dấu Kết Hợp Quá Mức",
    payload: `T̶̖̆e̵̖̋s̷̺͊ṯ̶̈`,
    description: "Kiểm tra lỗi crash hiển thị giao diện hoặc lỗi collation database.",
    exampleScenario: "Tên tài khoản chứa quá nhiều ký tự dấu Unicode kết hợp: T̶̖̆e̵̖̋s̷̺͊ṯ̶̈. Làm tràn vỡ giao diện web, đơ trình duyệt hoặc gây lỗi bảng mã cơ sở dữ liệu.",
    expectedBehavior: "Render an toàn hoặc chuẩn hóa bỏ các dấu kết hợp thừa",
  },
  {
    id: "breaker-emojis-multibyte",
    group: "String Breakers",
    name: "Ký Tự Emoji 4-Byte UTF-8 (utf8mb4)",
    payload: `🚀🔥💯🎉✨`,
    description: "Kiểm tra cơ sở dữ liệu hỗ trợ bảng mã utf8mb4 mà không bị lỗi crash.",
    exampleScenario: "Nhập emoji 4-byte 🚀🔥 vào bảng MySQL cấu hình utf8 cũ (giới hạn 3 byte). Gây lỗi sập database 500 Internal Error hoặc làm mất nội dung phía sau.",
    expectedBehavior: "Lưu trữ và trích xuất nguyên vẹn, không bị đổi thành dấu hỏi (?)",
  },
];

export const SECURITY_PAYLOADS = SECURITY_PAYLOADS_EN;

export function getSecurityPayloads(lang: "en" | "vi" = "en"): SecurityPayloadItem[] {
  return lang === "vi" ? SECURITY_PAYLOADS_VI : SECURITY_PAYLOADS_EN;
}

function generateCharString(length: number, char: string = "a"): string {
  if (length <= 0) return "";
  return char.repeat(length);
}

export function generateStringBoundaryCases(config: StringConfig, lang: "en" | "vi" = "en"): BoundaryCase[] {
  const { minLength, maxLength } = config;
  const cases: BoundaryCase[] = [];
  const isVi = lang === "vi";

  const catBoundary = isVi ? "Giá trị biên" : "Boundary";
  const catEquivalence = isVi ? "Phân vùng tương đương" : "Equivalence Class";
  const catEdge = isVi ? "Trường hợp biên / Ngoại lệ" : "Edge Case";

  const typeValid = isVi ? "Hợp lệ" : "Valid";
  const typeInvalid = isVi ? "Không hợp lệ" : "Invalid";
  const typeEdge = isVi ? "Cảnh báo / Biên" : "Edge / Warning";

  const expAccept = isVi ? "Chấp nhận / Thành công" : "Accept / Success";
  const expReject = isVi ? "Từ chối / Báo lỗi validation" : "Reject with Validation Error";
  const expSanitize = isVi ? "Làm sạch / Escape ký tự" : "Sanitize / Escape";

  const min = Math.max(0, minLength);
  const max = Math.max(min, maxLength);
  const mid = Math.floor((min + max) / 2);

  // 1. Boundary Values
  if (min > 0) {
    cases.push({
      id: "bva-below-min",
      category: catBoundary,
      type: typeInvalid,
      title: isVi ? `Dưới ngưỡng tối thiểu (${min - 1} ký tự)` : `Below Min Boundary (${min - 1} chars)`,
      description: isVi
        ? `Độ dài dữ liệu ít hơn 1 ký tự so với yêu cầu tối thiểu (${min})`
        : `Input length just 1 character below the required minimum (${min})`,
      testValue: generateCharString(min - 1, "a"),
      expectedResult: expReject,
    });
  }

  cases.push({
    id: "bva-at-min",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Đúng ngưỡng tối thiểu (${min} ký tự)` : `Exact Minimum Boundary (${min} chars)`,
    description: isVi
      ? `Độ dài dữ liệu bằng chính xác mức tối thiểu (${min})`
      : `Input length exactly equal to minimum requirement (${min})`,
    testValue: generateCharString(min, "a"),
    expectedResult: expAccept,
  });

  if (min + 1 <= max) {
    cases.push({
      id: "bva-above-min",
      category: catBoundary,
      type: typeValid,
      title: isVi ? `Vừa trên ngưỡng tối thiểu (${min + 1} ký tự)` : `Just Above Minimum (${min + 1} chars)`,
      description: isVi ? `Độ dài lớn hơn mức tối thiểu đúng 1 ký tự` : `Input length 1 character above minimum`,
      testValue: generateCharString(min + 1, "a"),
      expectedResult: expAccept,
    });
  }

  if (mid > min && mid < max) {
    cases.push({
      id: "bva-nominal-mid",
      category: catBoundary,
      type: typeValid,
      title: isVi ? `Trường hợp điển hình / Trung vị (${mid} ký tự)` : `Nominal / Typical Case (${mid} chars)`,
      description: isVi
        ? `Giá trị lý tưởng nằm chính giữa khoảng hợp lệ cho phép`
        : `Ideal input value right in the middle of allowed range`,
      testValue: generateCharString(mid, "a"),
      expectedResult: expAccept,
    });
  }

  if (max - 1 >= min && max - 1 !== min + 1) {
    cases.push({
      id: "bva-below-max",
      category: catBoundary,
      type: typeValid,
      title: isVi ? `Vừa dưới ngưỡng tối đa (${max - 1} ký tự)` : `Just Below Maximum (${max - 1} chars)`,
      description: isVi
        ? `Độ dài ít hơn mức tối đa cho phép đúng 1 ký tự (${max})`
        : `Input length 1 character below maximum allowed (${max})`,
      testValue: generateCharString(max - 1, "a"),
      expectedResult: expAccept,
    });
  }

  cases.push({
    id: "bva-at-max",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Đúng ngưỡng tối đa (${max} ký tự)` : `Exact Maximum Boundary (${max} chars)`,
    description: isVi
      ? `Độ dài dữ liệu chạm đúng ngưỡng giới hạn tối đa (${max})`
      : `Input length exactly equal to maximum boundary (${max})`,
    testValue: generateCharString(max, "a"),
    expectedResult: expAccept,
  });

  cases.push({
    id: "bva-above-max",
    category: catBoundary,
    type: typeInvalid,
    title: isVi ? `Vượt quá ngưỡng tối đa (${max + 1} ký tự)` : `Exceeding Maximum (${max + 1} chars)`,
    description: isVi
      ? `Độ dài dữ liệu vượt quá giới hạn tối đa 1 ký tự (${max})`
      : `Input length 1 character over maximum allowed limit (${max})`,
    testValue: generateCharString(max + 1, "a"),
    expectedResult: expReject,
  });

  // 2. Equivalence Classes
  cases.push({
    id: "ep-valid-partition",
    category: catEquivalence,
    type: typeValid,
    title: isVi ? "Phân vùng hợp lệ (Ký tự chuẩn Alphanumeric)" : "Valid Class (Standard Characters)",
    description: isVi ? "Đại diện dữ liệu chữ và số hợp lệ" : "Representative valid alphanumeric value",
    testValue: `User_${generateCharString(Math.max(1, mid - 5), "x")}`,
    expectedResult: expAccept,
  });

  // 3. Edge Cases
  cases.push({
    id: "edge-empty-string",
    category: catEdge,
    type: min === 0 ? typeValid : typeInvalid,
    title: isVi ? "Chuỗi rỗng (0 ký tự)" : "Empty String (0 Chars)",
    description: isVi ? "Người dùng không nhập gì / để trống trường" : "Completely blank input field",
    testValue: `""`,
    expectedResult: min === 0 ? expAccept : expReject,
  });

  cases.push({
    id: "edge-whitespace-only",
    category: catEdge,
    type: typeInvalid,
    title: isVi ? "Toàn bộ là khoảng trắng (Spaces Only)" : "Whitespace / Spaces Only",
    description: isVi
      ? "Kiểm tra hệ thống có tự động cắt bỏ khoảng trắng (trim) trước khi validate"
      : "Tests if system properly trims whitespace before length validation",
    testValue: "     ",
    expectedResult: expReject,
  });

  cases.push({
    id: "edge-leading-trailing-space",
    category: catEdge,
    type: typeEdge,
    title: isVi ? "Khoảng trắng ở đầu & cuối chuỗi" : "Leading & Trailing Whitespace",
    description: isVi ? "Dữ liệu có dấu cách thừa ở đầu hoặc cuối (' hello ')" : "Input with spaces at start and end (' hello ')",
    testValue: `  ${generateCharString(Math.max(1, min), "b")}  `,
    expectedResult: expSanitize,
  });

  cases.push({
    id: "edge-vietnamese-accents",
    category: catEdge,
    type: typeValid,
    title: isVi ? "Ký tự tiếng Việt có dấu (UTF-8)" : "Vietnamese Accents & Diacritics",
    description: isVi ? "Kiểm tra xử lý font chữ tiếng Việt, độ dài chuỗi UTF-8" : "Verifies proper UTF-8 handling and collation",
    testValue: "Nguyễn Văn Đạt - Công Cụ Kiểm Thử",
    expectedResult: expAccept,
  });

  cases.push({
    id: "edge-super-long",
    category: catEdge,
    type: typeInvalid,
    title: isVi ? "Tràn bộ đệm dữ liệu lớn (1.000 ký tự)" : "Super Long Buffer (1,000 chars)",
    description: isVi
      ? "Kiểm tra khả năng chịu tải trước chuỗi dữ liệu cực lớn (Buffer Overflow test)"
      : "Tests system against extreme payload buffer overflows",
    testValue: generateCharString(1000, "X"),
    expectedResult: expReject,
  });

  return cases;
}

export function generateNumberBoundaryCases(config: NumberConfig, lang: "en" | "vi" = "en"): BoundaryCase[] {
  const { minValue, maxValue, allowDecimals, decimalPlaces } = config;
  const cases: BoundaryCase[] = [];
  const isVi = lang === "vi";

  const catBoundary = isVi ? "Giá trị biên" : "Boundary";
  const catEdge = isVi ? "Trường hợp biên / Ngoại lệ" : "Edge Case";

  const typeValid = isVi ? "Hợp lệ" : "Valid";
  const typeInvalid = isVi ? "Không hợp lệ" : "Invalid";
  const typeEdge = isVi ? "Cảnh báo / Biên" : "Edge / Warning";

  const expAccept = isVi ? "Chấp nhận / Thành công" : "Accept / Success";
  const expReject = isVi ? "Từ chối / Báo lỗi validation" : "Reject with Validation Error";
  const expSanitize = isVi ? "Làm sạch / Escape ký tự" : "Sanitize / Escape";

  const min = minValue;
  const max = Math.max(min, maxValue);
  const mid = Math.round((min + max) / 2);
  const step = allowDecimals ? Math.pow(10, -decimalPlaces) : 1;

  // Boundary
  cases.push({
    id: "num-below-min",
    category: catBoundary,
    type: typeInvalid,
    title: isVi ? `Dưới cận dưới (${min - step})` : `Below Min (${min - step})`,
    description: isVi ? `Giá trị nhỏ hơn 1 bước so với ngưỡng tối thiểu (${min})` : `Value just 1 step below minimum threshold (${min})`,
    testValue: String(min - step),
    expectedResult: expReject,
  });

  cases.push({
    id: "num-at-min",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Đúng cận dưới tối thiểu (${min})` : `Exact Minimum (${min})`,
    description: isVi ? `Giá trị đúng tại ngưỡng biên dưới` : `Value exactly at the lower boundary`,
    testValue: String(min),
    expectedResult: expAccept,
  });

  cases.push({
    id: "num-above-min",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Vừa trên cận dưới (${min + step})` : `Just Above Minimum (${min + step})`,
    description: isVi ? `Giá trị lớn hơn 1 bước so với ngưỡng biên dưới` : `Value 1 step above lower boundary`,
    testValue: String(min + step),
    expectedResult: expAccept,
  });

  cases.push({
    id: "num-nominal-mid",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Giá trị trung vị chuẩn (${mid})` : `Nominal / Median (${mid})`,
    description: isVi ? `Giá trị số hợp lệ nằm ở khoảng giữa` : `Standard valid number in middle of range`,
    testValue: String(mid),
    expectedResult: expAccept,
  });

  cases.push({
    id: "num-below-max",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Vừa dưới cận trên (${max - step})` : `Just Below Maximum (${max - step})`,
    description: isVi ? `Giá trị nhỏ hơn 1 bước so với ngưỡng tối đa (${max})` : `Value 1 step below upper boundary (${max})`,
    testValue: String(max - step),
    expectedResult: expAccept,
  });

  cases.push({
    id: "num-at-max",
    category: catBoundary,
    type: typeValid,
    title: isVi ? `Đúng cận trên tối đa (${max})` : `Exact Maximum (${max})`,
    description: isVi ? `Giá trị đúng tại ngưỡng biên trên` : `Value exactly at the upper boundary`,
    testValue: String(max),
    expectedResult: expAccept,
  });

  cases.push({
    id: "num-above-max",
    category: catBoundary,
    type: typeInvalid,
    title: isVi ? `Vượt quá cận trên (${max + step})` : `Exceeding Maximum (${max + step})`,
    description: isVi ? `Giá trị vượt quá ngưỡng tối đa 1 bước (${max})` : `Value 1 step over maximum threshold (${max})`,
    testValue: String(max + step),
    expectedResult: expReject,
  });

  // Edge Cases
  cases.push({
    id: "num-zero",
    category: catEdge,
    type: min <= 0 && max >= 0 ? typeValid : typeInvalid,
    title: isVi ? "Giá trị số 0 (Zero)" : "Zero Value (0)",
    description: isVi ? "Kiểm tra lỗi chia cho 0 hoặc lỗi xử lý điều kiện falsy" : "Tests zero division and falsy condition bugs",
    testValue: "0",
    expectedResult: min <= 0 && max >= 0 ? expAccept : expReject,
  });

  cases.push({
    id: "num-negative",
    category: catEdge,
    type: min < 0 ? typeValid : typeInvalid,
    title: isVi ? "Số âm (-1)" : "Negative Value (-1)",
    description: isVi ? "Kiểm tra validation đối với số âm" : "Tests negative number validation",
    testValue: "-1",
    expectedResult: min < 0 ? expAccept : expReject,
  });

  if (!allowDecimals) {
    cases.push({
      id: "num-float-rejected",
      category: catEdge,
      type: typeInvalid,
      title: isVi ? `Số thập phân trên trường số nguyên (${mid}.5)` : `Decimal Float on Integer Field (${mid}.5)`,
      description: isVi ? "Kiểm tra xem trường số nguyên có từ chối số thập phân hay không" : "Tests whether decimal input is properly rejected for integer fields",
      testValue: `${mid}.5`,
      expectedResult: expReject,
    });
  }

  cases.push({
    id: "num-scientific-notation",
    category: catEdge,
    type: typeEdge,
    title: isVi ? "Ký hiệu khoa học E (1e5)" : "Scientific Notation (1e5)",
    description: isVi ? "Kiểm tra khả năng parse dạng số mũ / khoa học" : "Tests exponential representation parsing",
    testValue: "1e5",
    expectedResult: expSanitize,
  });

  cases.push({
    id: "num-nan-string",
    category: catEdge,
    type: typeInvalid,
    title: isVi ? "Ký tự chữ không phải số ('abc123')" : "Non-numeric String Input ('abc123')",
    description: isVi ? "Kiểm tra xử lý lỗi khi ép kiểu (Type Casting)" : "Tests type casting error handling",
    testValue: "abc123",
    expectedResult: expReject,
  });

  return cases;
}

export function generateEmailBoundaryCases(lang: "en" | "vi" = "en"): BoundaryCase[] {
  const isVi = lang === "vi";
  const catEquivalence = isVi ? "Phân vùng tương đương" : "Equivalence Class";
  const catBoundary = isVi ? "Giá trị biên" : "Boundary";
  const catEdge = isVi ? "Trường hợp biên / Ngoại lệ" : "Edge Case";

  const typeValid = isVi ? "Hợp lệ" : "Valid";
  const typeInvalid = isVi ? "Không hợp lệ" : "Invalid";

  const expAccept = isVi ? "Chấp nhận / Thành công" : "Accept / Success";
  const expReject = isVi ? "Từ chối / Báo lỗi validation" : "Reject with Validation Error";

  return [
    {
      id: "email-valid-standard",
      category: catEquivalence,
      type: typeValid,
      title: isVi ? "Email hợp lệ chuẩn RFC 5322" : "Standard Valid Email",
      description: isVi ? "Định dạng email chuẩn RFC 5322 phổ biến" : "Standard RFC 5322 compliant email format",
      testValue: "tester.qa@example.com",
      expectedResult: expAccept,
    },
    {
      id: "email-valid-plus-subaddress",
      category: catEquivalence,
      type: typeValid,
      title: isVi ? "Định dạng Plus Tag hợp lệ (Sub-addressing)" : "Valid Plus Addressing (Sub-addressing)",
      description: isVi ? "Email chứa dấu cộng phân luồng (vd: Gmail sub-addressing)" : "Email with plus sign routing (e.g. Gmail sub-addressing)",
      testValue: "tester+subtag123@company.com.vn",
      expectedResult: expAccept,
    },
    {
      id: "email-valid-hyphen-dots",
      category: catEquivalence,
      type: typeValid,
      title: isVi ? "Domain chứa dấu chấm và gạch nối" : "Valid Dots & Hyphens in Domain",
      description: isVi ? "Tên miền nhiều phân đoạn subdomain và dấu gạch nối" : "Subdomains with multiple segments and hyphens",
      testValue: "qa-team.auto@my-sub.domain.co.uk",
      expectedResult: expAccept,
    },
    {
      id: "email-invalid-missing-at",
      category: catBoundary,
      type: typeInvalid,
      title: isVi ? "Thiếu ký tự '@'" : "Missing '@' Symbol",
      description: isVi ? "Email thiếu ký tự phân tách '@' bắt buộc" : "Email missing required @ separator",
      testValue: "tester.example.com",
      expectedResult: expReject,
    },
    {
      id: "email-invalid-missing-domain",
      category: catBoundary,
      type: typeInvalid,
      title: isVi ? "Thiếu tên miền sau '@'" : "Missing Domain After '@'",
      description: isVi ? "Có phần tên tài khoản nhưng thiếu tên miền phía sau" : "Local part provided but domain is missing",
      testValue: "tester@",
      expectedResult: expReject,
    },
    {
      id: "email-invalid-double-at",
      category: catBoundary,
      type: typeInvalid,
      title: isVi ? "Hai ký tự '@' liên tiếp" : "Double '@' Sign",
      description: isVi ? "Xuất hiện nhiều hơn một ký tự '@' trong chuỗi" : "Multiple @ signs in string",
      testValue: "tester@@example.com",
      expectedResult: expReject,
    },
    {
      id: "email-invalid-double-dot",
      category: catBoundary,
      type: typeInvalid,
      title: isVi ? "Hai dấu chấm liên tiếp (..)" : "Consecutive Double Dots (..)",
      description: isVi ? "Không được phép có hai dấu chấm liền nhau trong phần tên" : "Forbidden consecutive dots in local part",
      testValue: "tester..name@example.com",
      expectedResult: expReject,
    },
    {
      id: "email-invalid-spaces",
      category: catBoundary,
      type: typeInvalid,
      title: isVi ? "Chứa khoảng trắng trong địa chỉ" : "Embedded Spaces in Address",
      description: isVi ? "Có khoảng trắng không hợp lệ bên trong email" : "Unquoted whitespace in email address",
      testValue: "tester qa@example.com",
      expectedResult: expReject,
    },
    {
      id: "email-edge-long-local",
      category: catEdge,
      type: typeValid,
      title: isVi ? "Độ dài tối đa phần tên (64 ký tự)" : "Max Length Local Part (64 Chars)",
      description: isVi ? "Giới hạn chuẩn RFC cho phần tên trước ký tự '@'" : "RFC limit for local part before @ (64 chars)",
      testValue: `${"a".repeat(64)}@example.com`,
      expectedResult: expAccept,
    },
  ];
}

export function exportToMarkdownTable(cases: BoundaryCase[], lang: "en" | "vi" = "en"): string {
  const isVi = lang === "vi";
  const hCat = isVi ? "Phân loại" : "Category";
  const hType = isVi ? "Kiểu" : "Type";
  const hTitle = isVi ? "Tên Test Case" : "Test Case Title";
  const hVal = isVi ? "Giá trị kiểm thử" : "Test Input Value";
  const hExp = isVi ? "Hành vi kỳ vọng" : "Expected Behavior";

  let md = `| ${hCat} | ${hType} | ${hTitle} | ${hVal} | ${hExp} |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const c of cases) {
    const escapedVal = c.testValue.replace(/\|/g, "\\|").replace(/\n/g, "\\n");
    md += `| ${c.category} | ${c.type} | ${c.title} | \`${escapedVal}\` | ${c.expectedResult} |\n`;
  }
  return md;
}

export function exportToCsv(cases: BoundaryCase[], lang: "en" | "vi" = "en"): string {
  const isVi = lang === "vi";
  const hCat = isVi ? "Phân loại" : "Category";
  const hType = isVi ? "Kiểu" : "Type";
  const hTitle = isVi ? "Tên Test Case" : "Title";
  const hVal = isVi ? "Giá trị kiểm thử" : "Test Value";
  const hExp = isVi ? "Hành vi kỳ vọng" : "Expected Result";
  const hDesc = isVi ? "Mô tả" : "Description";

  let csv = `"${hCat}","${hType}","${hTitle}","${hVal}","${hExp}","${hDesc}"\n`;
  for (const c of cases) {
    const cleanVal = c.testValue.replace(/"/g, '""');
    const cleanTitle = c.title.replace(/"/g, '""');
    const cleanDesc = c.description.replace(/"/g, '""');
    csv += `"${c.category}","${c.type}","${cleanTitle}","${cleanVal}","${c.expectedResult}","${cleanDesc}"\n`;
  }
  return csv;
}
