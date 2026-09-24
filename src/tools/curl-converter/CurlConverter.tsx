import React, { useState, useEffect } from "react";
import { Globe, Sparkles } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import { convertCurlToCode, CurlTargetLanguage } from "./curlParserEngine";

const SAMPLE_CURL = `curl --location 'https://api.example.com/v1/users' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer my_secret_token_123' \\
--data-raw '{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "admin"
}'`;

export const CurlConverter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState(SAMPLE_CURL);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<CurlTargetLanguage>("playwright-test");

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      const code = convertCurlToCode(input, language);
      setOutput(code);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to convert cURL command");
      setOutput("");
    }
  }, [input, language]);

  const handleLoadSample = () => {
    setInput(SAMPLE_CURL);
  };

  const config = (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <label className="text-slate-600 dark:text-slate-400 font-medium">{t.curlConverter.targetFramework}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as CurlTargetLanguage)}
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-sm"
        >
          <optgroup label={t.curlConverter.groupQA}>
            <option value="playwright-test">Playwright (API Test)</option>
            <option value="cypress-cy-request">Cypress (cy.request)</option>
            <option value="postman-collection">Postman Collection (v2.1 JSON)</option>
            <option value="k6-load-test">Grafana k6 (Load Test)</option>
            <option value="java-restassured">Java (RestAssured)</option>
          </optgroup>
          <optgroup label={t.curlConverter.groupSDK}>
            <option value="javascript-fetch">JavaScript (Fetch)</option>
            <option value="javascript-axios">JavaScript (Axios)</option>
            <option value="nodejs-native">Node.js (Fetch / Native)</option>
            <option value="python-requests">Python (Requests)</option>
            <option value="python-httpx">Python (HTTPX)</option>
            <option value="golang-nethttp">Go (net/http)</option>
            <option value="rust-reqwest">Rust (Reqwest)</option>
            <option value="php-curl">PHP (cURL)</option>
          </optgroup>
          <optgroup label={t.curlConverter.groupShell}>
            <option value="curl-formatted">cURL (Formatted Multiline)</option>
          </optgroup>
        </select>
      </div>

      <button
        onClick={handleLoadSample}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ml-auto cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>{t.ui.sample}</span>
      </button>
    </div>
  );

  return (
    <ToolLayout
      id="curl-converter"
      title={t.tools["curl-converter"]?.title || "cURL to Automation & Code Converter"}
      description={t.tools["curl-converter"]?.description || "Convert cURL commands into Playwright, Cypress, Postman, k6, RestAssured, Fetch, Axios, and Python scripts"}
      icon={Globe}
      categoryName="Converters"
      configuration={config}
      inputLabel={t.curlConverter.curlCommand}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder="Paste curl command here (e.g. curl https://api.example.com -H 'Auth: ...')..."
      outputLabel={t.curlConverter.generatedCode.replace("{language}", language)}
      outputValue={output}
      outputPlaceholder="Generated code will appear here..."
      error={error}
    />
  );
};
