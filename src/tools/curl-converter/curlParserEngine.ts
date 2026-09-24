export type CurlTargetLanguage =
  | "javascript-fetch"
  | "javascript-axios"
  | "python-requests"
  | "python-httpx"
  | "playwright-test"
  | "cypress-cy-request"
  | "postman-collection"
  | "k6-load-test"
  | "java-restassured"
  | "golang-nethttp"
  | "rust-reqwest"
  | "php-curl"
  | "nodejs-native"
  | "curl-formatted";

export interface ParsedCurl {
  rawUrl: string;
  method: string;
  headers: Record<string, string>;
  data?: string;
  auth?: { username: string; password?: string };
}

// Tokenize bash command line supporting quotes and backslash escapes
export function tokenizeCommandLine(cmd: string): string[] {
  const cleanCmd = cmd.replace(/\\\r?\n/g, " ").trim();
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < cleanCmd.length; i++) {
    const char = cleanCmd[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (/\s/.test(char) && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export function parseCurlCommand(curlInput: string): ParsedCurl {
  const tokens = tokenizeCommandLine(curlInput);
  if (tokens.length === 0 || tokens[0] !== "curl") {
    if (!tokens.length) {
      throw new Error("Empty cURL command");
    }
  }

  let url = "";
  let method = "";
  const headers: Record<string, string> = {};
  let data: string | undefined = undefined;
  let auth: { username: string; password?: string } | undefined = undefined;

  let i = tokens[0] === "curl" ? 1 : 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === "-X" || token === "--request") {
      method = (tokens[i + 1] || "GET").toUpperCase();
      i += 2;
    } else if (token === "-H" || token === "--header") {
      const headerStr = tokens[i + 1] || "";
      const colonIdx = headerStr.indexOf(":");
      if (colonIdx > 0) {
        const key = headerStr.slice(0, colonIdx).trim();
        const val = headerStr.slice(colonIdx + 1).trim();
        headers[key] = val;
      }
      i += 2;
    } else if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary" ||
      token === "--data-ascii"
    ) {
      data = tokens[i + 1] || "";
      if (!method) method = "POST";
      i += 2;
    } else if (token === "-u" || token === "--user") {
      const authStr = tokens[i + 1] || "";
      const colonIdx = authStr.indexOf(":");
      if (colonIdx >= 0) {
        auth = {
          username: authStr.slice(0, colonIdx),
          password: authStr.slice(colonIdx + 1),
        };
      } else {
        auth = { username: authStr, password: "" };
      }
      i += 2;
    } else if (token === "--location" || token === "-L" || token === "-k" || token === "--insecure" || token === "-s" || token === "--silent") {
      // Common flags to ignore for parsing
      i += 1;
    } else if (!token.startsWith("-") && !url) {
      url = token;
      i += 1;
    } else {
      // Unrecognized flag or argument
      i += 1;
    }
  }

  if (!url) {
    throw new Error("Could not parse target URL from cURL command");
  }

  // Clean surrounding quotes from URL if any
  url = url.replace(/^['"]|['"]$/g, "");

  if (!method) {
    method = data !== undefined ? "POST" : "GET";
  }

  return {
    rawUrl: url,
    method,
    headers,
    data,
    auth,
  };
}

export function convertCurlToCode(curlInput: string, language: CurlTargetLanguage): string {
  const trimmed = curlInput.trim();
  if (!trimmed) return "";

  const parsed = parseCurlCommand(trimmed);

  switch (language) {
    case "javascript-fetch":
      return generateJsFetch(parsed);
    case "javascript-axios":
      return generateJsAxios(parsed);
    case "playwright-test":
      return generatePlaywrightTest(parsed);
    case "cypress-cy-request":
      return generateCypressRequest(parsed);
    case "postman-collection":
      return generatePostmanCollection(parsed);
    case "k6-load-test":
      return generateK6LoadTest(parsed);
    case "java-restassured":
      return generateJavaRestAssured(parsed);
    case "python-requests":
      return generatePythonRequests(parsed);
    case "python-httpx":
      return generatePythonHttpx(parsed);
    case "golang-nethttp":
      return generateGolangNetHttp(parsed);
    case "rust-reqwest":
      return generateRustReqwest(parsed);
    case "php-curl":
      return generatePhpCurl(parsed);
    case "nodejs-native":
      return generateNodeJsNative(parsed);
    case "curl-formatted":
      return generateFormattedCurl(parsed);
    default:
      return generateJsFetch(parsed);
  }
}

// ---------------- JS Fetch ----------------
function generateJsFetch(req: ParsedCurl): string {
  const headers = { ...req.headers };
  if (req.auth) {
    const creds = btoa(`${req.auth.username}:${req.auth.password || ""}`);
    headers["Authorization"] = `Basic ${creds}`;
  }

  let isJsonBody = false;
  let parsedBodyObj: unknown = null;
  if (req.data) {
    try {
      parsedBodyObj = JSON.parse(req.data);
      isJsonBody = true;
    } catch {
      isJsonBody = false;
    }
  }

  let code = `const url = ${JSON.stringify(req.rawUrl)};\n`;
  code += `const options = {\n  method: ${JSON.stringify(req.method)},\n`;

  if (Object.keys(headers).length > 0) {
    code += `  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, "\n  ")},\n`;
  }

  if (req.data !== undefined) {
    if (isJsonBody) {
      code += `  body: JSON.stringify(${JSON.stringify(parsedBodyObj, null, 4).replace(/\n/g, "\n  ")}),\n`;
    } else {
      code += `  body: ${JSON.stringify(req.data)},\n`;
    }
  }

  code += `};\n\ntry {\n  const response = await fetch(url, options);\n  const data = await response.json();\n  console.log(data);\n} catch (error) {\n  console.error(error);\n}`;
  return code;
}

// ---------------- Playwright API Test ----------------
function generatePlaywrightTest(req: ParsedCurl): string {
  const headers = { ...req.headers };
  if (req.auth) {
    const creds = btoa(`${req.auth.username}:${req.auth.password || ""}`);
    headers["Authorization"] = `Basic ${creds}`;
  }

  let isJson = false;
  let jsonParsed: unknown = null;
  if (req.data) {
    try {
      jsonParsed = JSON.parse(req.data);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

  let code = `import { test, expect } from '@playwright/test';\n\n`;
  code += `test('API Test: ${req.method} ${req.rawUrl}', async ({ request }) => {\n`;
  code += `  const response = await request.fetch(${JSON.stringify(req.rawUrl)}, {\n`;
  code += `    method: ${JSON.stringify(req.method)},\n`;

  if (Object.keys(headers).length > 0) {
    code += `    headers: ${JSON.stringify(headers, null, 6).replace(/\n/g, "\n    ")},\n`;
  }

  if (req.data !== undefined) {
    if (isJson) {
      code += `    data: ${JSON.stringify(jsonParsed, null, 6).replace(/\n/g, "\n    ")},\n`;
    } else {
      code += `    data: ${JSON.stringify(req.data)},\n`;
    }
  }

  code += `  });\n\n`;
  code += `  // Status and assertion checks\n`;
  code += `  expect(response.ok()).toBeTruthy();\n`;
  code += `  expect([200, 201, 204]).toContain(response.status());\n\n`;
  code += `  const body = await response.json();\n`;
  code += `  console.log('Response body:', body);\n`;
  code += `});\n`;
  return code;
}

// ---------------- Cypress API Test ----------------
function generateCypressRequest(req: ParsedCurl): string {
  const headers = { ...req.headers };
  if (req.auth) {
    headers["auth"] = `${req.auth.username}:${req.auth.password || ""}`;
  }

  let isJson = false;
  let jsonParsed: unknown = null;
  if (req.data) {
    try {
      jsonParsed = JSON.parse(req.data);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

  let code = `describe('API Test Suite', () => {\n`;
  code += `  it('verifies ${req.method} request to ${req.rawUrl}', () => {\n`;
  code += `    cy.request({\n`;
  code += `      method: ${JSON.stringify(req.method)},\n`;
  code += `      url: ${JSON.stringify(req.rawUrl)},\n`;

  if (Object.keys(headers).length > 0) {
    code += `      headers: ${JSON.stringify(headers, null, 6).replace(/\n/g, "\n      ")},\n`;
  }

  if (req.data !== undefined) {
    if (isJson) {
      code += `      body: ${JSON.stringify(jsonParsed, null, 6).replace(/\n/g, "\n      ")},\n`;
    } else {
      code += `      body: ${JSON.stringify(req.data)},\n`;
    }
  }

  code += `      failOnStatusCode: false,\n`;
  code += `    }).then((response) => {\n`;
  code += `      expect(response.status).to.be.oneOf([200, 201, 204]);\n`;
  code += `      cy.log('Response:', JSON.stringify(response.body));\n`;
  code += `    });\n`;
  code += `  });\n`;
  code += `});\n`;
  return code;
}

// ---------------- Postman Collection JSON ----------------
function generatePostmanCollection(req: ParsedCurl): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.rawUrl);
  } catch {
    parsedUrl = new URL("https://api.example.com");
  }

  const headerList = Object.entries(req.headers).map(([key, value]) => ({
    key,
    value,
    type: "text",
  }));

  if (req.auth) {
    const creds = btoa(`${req.auth.username}:${req.auth.password || ""}`);
    headerList.push({
      key: "Authorization",
      value: `Basic ${creds}`,
      type: "text",
    });
  }

  const postmanRequest: Record<string, unknown> = {
    method: req.method,
    header: headerList,
    url: {
      raw: req.rawUrl,
      protocol: parsedUrl.protocol.replace(":", ""),
      host: parsedUrl.hostname.split("."),
      path: parsedUrl.pathname.split("/").filter(Boolean),
    },
  };

  if (req.data !== undefined) {
    postmanRequest.body = {
      mode: "raw",
      raw: req.data,
      options: {
        raw: {
          language: "json",
        },
      },
    };
  }

  const collection = {
    info: {
      name: "Exported cURL Collection",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: `${req.method} ${parsedUrl.pathname || "/"}`,
        request: postmanRequest,
        response: [],
      },
    ],
  };

  return JSON.stringify(collection, null, 2);
}

// ---------------- Grafana k6 Load Test ----------------
function generateK6LoadTest(req: ParsedCurl): string {
  const headers = { ...req.headers };
  if (req.auth) {
    const creds = btoa(`${req.auth.username}:${req.auth.password || ""}`);
    headers["Authorization"] = `Basic ${creds}`;
  }

  let code = `import http from 'k6/http';\nimport { check, sleep } from 'k6';\n\n`;
  code += `export const options = {\n  vus: 10,\n  duration: '30s',\n};\n\n`;
  code += `export default function () {\n`;
  code += `  const url = ${JSON.stringify(req.rawUrl)};\n`;

  if (req.data !== undefined) {
    code += `  const payload = ${JSON.stringify(req.data)};\n`;
  }

  code += `  const params = {\n`;
  code += `    headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, "\n    ")},\n`;
  code += `  };\n\n`;

  if (req.data !== undefined) {
    code += `  const res = http.request(${JSON.stringify(req.method)}, url, payload, params);\n`;
  } else {
    code += `  const res = http.request(${JSON.stringify(req.method)}, url, null, params);\n`;
  }

  code += `  check(res, {\n`;
  code += `    'status is 200': (r) => r.status === 200,\n`;
  code += `    'response time < 500ms': (r) => r.timings.duration < 500,\n`;
  code += `  });\n\n`;
  code += `  sleep(1);\n`;
  code += `}\n`;
  return code;
}

// ---------------- Java RestAssured ----------------
function generateJavaRestAssured(req: ParsedCurl): string {
  let code = `import io.restassured.RestAssured;\nimport io.restassured.response.Response;\nimport static io.restassured.RestAssured.given;\nimport static org.hamcrest.Matchers.*;\n\n`;
  code += `public class ApiTest {\n    public static void main(String[] args) {\n`;
  code += `        Response response = given()\n`;

  for (const [k, v] of Object.entries(req.headers)) {
    code += `            .header("${k}", "${v}")\n`;
  }

  if (req.auth) {
    code += `            .auth().basic("${req.auth.username}", "${req.auth.password || ""}")\n`;
  }

  if (req.data !== undefined) {
    code += `            .body(${JSON.stringify(req.data)})\n`;
  }

  const methodLower = req.method.toLowerCase();
  code += `            .when()\n`;
  code += `            .${methodLower}("${req.rawUrl}")\n`;
  code += `            .then()\n`;
  code += `            .statusCode(200)\n`;
  code += `            .extract().response();\n\n`;
  code += `        System.out.println(response.asPrettyString());\n`;
  code += `    }\n}\n`;
  return code;
}

// ---------------- JS Axios ----------------
function generateJsAxios(req: ParsedCurl): string {
  const headers = { ...req.headers };
  let isJsonBody = false;
  let parsedBodyObj: unknown = null;
  if (req.data) {
    try {
      parsedBodyObj = JSON.parse(req.data);
      isJsonBody = true;
    } catch {
      isJsonBody = false;
    }
  }

  let code = `import axios from 'axios';\n\n`;
  code += `const config = {\n  method: ${JSON.stringify(req.method.toLowerCase())},\n`;
  code += `  url: ${JSON.stringify(req.rawUrl)},\n`;

  if (Object.keys(headers).length > 0) {
    code += `  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, "\n  ")},\n`;
  }

  if (req.auth) {
    code += `  auth: {\n    username: ${JSON.stringify(req.auth.username)},\n    password: ${JSON.stringify(req.auth.password || "")}\n  },\n`;
  }

  if (req.data !== undefined) {
    if (isJsonBody) {
      code += `  data: ${JSON.stringify(parsedBodyObj, null, 4).replace(/\n/g, "\n  ")},\n`;
    } else {
      code += `  data: ${JSON.stringify(req.data)},\n`;
    }
  }

  code += `};\n\ntry {\n  const response = await axios(config);\n  console.log(response.data);\n} catch (error) {\n  console.error(error);\n}`;
  return code;
}

// ---------------- Python Requests ----------------
function generatePythonRequests(req: ParsedCurl): string {
  let isJson = false;
  let jsonParsed: unknown = null;
  if (req.data) {
    try {
      jsonParsed = JSON.parse(req.data);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

  let code = `import requests\n\n`;
  code += `url = ${JSON.stringify(req.rawUrl)}\n`;

  if (Object.keys(req.headers).length > 0) {
    code += `headers = {\n`;
    for (const [k, v] of Object.entries(req.headers)) {
      code += `    ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`;
    }
    code += `}\n`;
  }

  if (req.auth) {
    code += `auth = (${JSON.stringify(req.auth.username)}, ${JSON.stringify(req.auth.password || "")})\n`;
  }

  if (req.data !== undefined) {
    if (isJson) {
      code += `payload = ${JSON.stringify(jsonParsed, null, 4)}\n`;
    } else {
      code += `data = ${JSON.stringify(req.data)}\n`;
    }
  }

  const args: string[] = ["url"];
  if (Object.keys(req.headers).length > 0) args.push("headers=headers");
  if (req.auth) args.push("auth=auth");
  if (req.data !== undefined) {
    if (isJson) args.push("json=payload");
    else args.push("data=data");
  }

  const pyMethod = req.method.toLowerCase();
  code += `\nresponse = requests.${pyMethod}(${args.join(", ")})\nprint(response.status_code)\nprint(response.text)\n`;
  return code;
}

// ---------------- Python HTTPX ----------------
function generatePythonHttpx(req: ParsedCurl): string {
  const code = generatePythonRequests(req);
  return code.replace(/import requests/g, "import httpx").replace(/requests\./g, "httpx.");
}

// ---------------- Go net/http ----------------
function generateGolangNetHttp(req: ParsedCurl): string {
  let code = `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"\n`;
  if (req.data !== undefined) {
    code += `\t"strings"\n`;
  }
  code += `)\n\nfunc main() {\n\turl := "${req.rawUrl}"\n`;

  if (req.data !== undefined) {
    code += `\tpayload := strings.NewReader(\`${req.data.replace(/`/g, '` + "`" + `')}\`)\n`;
    code += `\treq, err := http.NewRequest("${req.method}", url, payload)\n`;
  } else {
    code += `\treq, err := http.NewRequest("${req.method}", url, nil)\n`;
  }

  code += `\tif err != nil {\n\t\tpanic(err)\n\t}\n\n`;

  for (const [k, v] of Object.entries(req.headers)) {
    code += `\treq.Header.Add("${k}", "${v}")\n`;
  }

  if (req.auth) {
    code += `\treq.SetBasicAuth("${req.auth.username}", "${req.auth.password || ""}")\n`;
  }

  code += `\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tbody, err := io.ReadAll(res.Body)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n\tfmt.Println(string(body))\n}`;
  return code;
}

// ---------------- Rust Reqwest ----------------
function generateRustReqwest(req: ParsedCurl): string {
  let code = `use reqwest::Client;\nuse std::error::Error;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn Error>> {\n    let client = Client::new();\n`;
  const m = req.method.toLowerCase();
  code += `    let mut req = client.${m}("${req.rawUrl}");\n`;

  for (const [k, v] of Object.entries(req.headers)) {
    code += `    req = req.header("${k}", "${v}");\n`;
  }

  if (req.auth) {
    code += `    req = req.basic_auth("${req.auth.username}", Some("${req.auth.password || ""}"));\n`;
  }

  if (req.data !== undefined) {
    try {
      JSON.parse(req.data);
      code += `    req = req.header("Content-Type", "application/json");\n`;
      code += `    req = req.body(r#"${req.data}"#);\n`;
    } catch {
      code += `    req = req.body("${req.data}");\n`;
    }
  }

  code += `\n    let res = req.send().await?;\n    let body = res.text().await?;\n    println!("{}", body);\n    Ok(())\n}`;
  return code;
}

// ---------------- PHP cURL ----------------
function generatePhpCurl(req: ParsedCurl): string {
  let code = `<?php\n\n$curl = curl_init();\n\n$headers = [\n`;
  for (const [k, v] of Object.entries(req.headers)) {
    code += `    "${k}: ${v}",\n`;
  }
  code += `];\n\n`;

  code += `curl_setopt_array($curl, [\n`;
  code += `    CURLOPT_URL => "${req.rawUrl}",\n`;
  code += `    CURLOPT_RETURNTRANSFER => true,\n`;
  code += `    CURLOPT_CUSTOMREQUEST => "${req.method}",\n`;

  if (Object.keys(req.headers).length > 0) {
    code += `    CURLOPT_HTTPHEADER => $headers,\n`;
  }

  if (req.auth) {
    code += `    CURLOPT_USERPWD => "${req.auth.username}:${req.auth.password || ""}",\n`;
  }

  if (req.data !== undefined) {
    code += `    CURLOPT_POSTFIELDS => ${JSON.stringify(req.data)},\n`;
  }

  code += `]);\n\n$response = curl_exec($curl);\n$err = curl_error($curl);\ncurl_close($curl);\n\nif ($err) {\n    echo "cURL Error #: " . $err;\n} else {\n    echo $response;\n}\n`;
  return code;
}

// ---------------- Node.js Native ----------------
function generateNodeJsNative(req: ParsedCurl): string {
  return generateJsFetch(req);
}

// ---------------- Formatted cURL ----------------
function generateFormattedCurl(req: ParsedCurl): string {
  const parts: string[] = [`curl --location '${req.rawUrl}'`];

  if (req.method !== "GET") {
    parts.push(`--request ${req.method}`);
  }

  for (const [k, v] of Object.entries(req.headers)) {
    parts.push(`--header '${k}: ${v}'`);
  }

  if (req.auth) {
    parts.push(`--user '${req.auth.username}:${req.auth.password || ""}'`);
  }

  if (req.data !== undefined) {
    parts.push(`--data-raw '${req.data.replace(/'/g, "\\'")}'`);
  }

  return parts.join(" \\\n  ");
}
