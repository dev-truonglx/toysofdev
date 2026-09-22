import React, { useState, useEffect } from "react";
import { Hash } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import { md5 } from "./md5";

type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-512" | "ALL";

export const HashGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("Hello World");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("ALL");
  const [uppercase, setUppercase] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const digestSha = async (algo: "SHA-1" | "SHA-256" | "SHA-512", text: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest(algo, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  useEffect(() => {
    let isCancelled = false;

    async function calculateHashes() {
      if (!input) {
        setOutput("");
        setError(null);
        return;
      }

      try {
        let result = "";
        const md5Hash = md5(input);

        if (algorithm === "MD5") {
          result = md5Hash;
        } else if (algorithm === "SHA-1") {
          result = await digestSha("SHA-1", input);
        } else if (algorithm === "SHA-256") {
          result = await digestSha("SHA-256", input);
        } else if (algorithm === "SHA-512") {
          result = await digestSha("SHA-512", input);
        } else {
          // ALL
          const sha1Hash = await digestSha("SHA-1", input);
          const sha256Hash = await digestSha("SHA-256", input);
          const sha512Hash = await digestSha("SHA-512", input);

          result = [
            `MD5:    ${uppercase ? md5Hash.toUpperCase() : md5Hash}`,
            `SHA1:   ${uppercase ? sha1Hash.toUpperCase() : sha1Hash}`,
            `SHA256: ${uppercase ? sha256Hash.toUpperCase() : sha256Hash}`,
            `SHA512: ${uppercase ? sha512Hash.toUpperCase() : sha512Hash}`,
          ].join("\n");
        }

        if (!isCancelled) {
          setOutput(algorithm === "ALL" ? result : uppercase ? result.toUpperCase() : result.toLowerCase());
          setError(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to calculate hash");
          setOutput("");
        }
      }
    }

    calculateHashes();

    return () => {
      isCancelled = true;
    };
  }, [input, algorithm, uppercase]);

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="hash-algo" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.algorithm}
        </label>
        <select
          id="hash-algo"
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">All Digests (MD5, SHA-1, SHA-256, SHA-512)</option>
          <option value="MD5">MD5</option>
          <option value="SHA-1">SHA-1</option>
          <option value="SHA-256">SHA-256</option>
          <option value="SHA-512">SHA-512</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={uppercase}
          onChange={(e) => setUppercase(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>{t.ui.uppercase}</span>
      </label>
    </>
  );

  return (
    <ToolLayout
      id="hash-generator"
      title="Hash / Checksum Generator"
      description="Calculate MD5, SHA-1, SHA-256, and SHA-512 hashes using Web Crypto API"
      icon={Hash}
      categoryName="Generators"
      configuration={config}
      inputValue={input}
      onInputChange={setInput}
      outputValue={output}
      error={error}
    />
  );
};
