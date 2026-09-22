import React, { useState, useEffect } from "react";
import { KeyRound, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

interface JwtMeta {
  issuer?: string;
  subject?: string;
  audience?: string;
  issuedAt?: string;
  expiresAt?: string;
  isExpired?: boolean;
}

export const JwtDecoder: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [headerJson, setHeaderJson] = useState("");
  const [payloadJson, setPayloadJson] = useState("");
  const [signatureRaw, setSignatureRaw] = useState("");
  const [meta, setMeta] = useState<JwtMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base64UrlDecode = (str: string): string => {
    let output = str.replace(/-/g, "+").replace(/_/g, "/");
    while (output.length % 4) {
      output += "=";
    }
    const bin = atob(output);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setHeaderJson("");
      setPayloadJson("");
      setSignatureRaw("");
      setMeta(null);
      setError(null);
      return;
    }

    const parts = trimmed.split(".");
    if (parts.length !== 3) {
      setError(`${t.ui.invalid} JWT format (header.payload.signature)`);
      setHeaderJson("");
      setPayloadJson("");
      setSignatureRaw("");
      setMeta(null);
      return;
    }

    try {
      const [headerB64, payloadB64, sigB64] = parts;

      // Decode Header
      const headerStr = base64UrlDecode(headerB64);
      const parsedHeader = JSON.parse(headerStr);
      setHeaderJson(JSON.stringify(parsedHeader, null, 2));

      // Decode Payload
      const payloadStr = base64UrlDecode(payloadB64);
      const parsedPayload = JSON.parse(payloadStr);
      setPayloadJson(JSON.stringify(parsedPayload, null, 2));

      // Signature
      setSignatureRaw(sigB64);

      // Analyze Claims
      const metadata: JwtMeta = {};
      if (parsedPayload.iss) metadata.issuer = String(parsedPayload.iss);
      if (parsedPayload.sub) metadata.subject = String(parsedPayload.sub);
      if (parsedPayload.aud) metadata.audience = String(parsedPayload.aud);

      if (typeof parsedPayload.iat === "number") {
        metadata.issuedAt = new Date(parsedPayload.iat * 1000).toLocaleString();
      }

      if (typeof parsedPayload.exp === "number") {
        const expDate = new Date(parsedPayload.exp * 1000);
        metadata.expiresAt = expDate.toLocaleString();
        metadata.isExpired = Date.now() > expDate.getTime();
      }

      setMeta(metadata);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? `Failed to decode JWT: ${err.message}` : "Failed to decode JWT");
      setHeaderJson("");
      setPayloadJson("");
      setMeta(null);
    }
  }, [input, t]);

  const outputCombined =
    headerJson || payloadJson
      ? `// HEADER: ALGORITHM & TOKEN TYPE\n${headerJson}\n\n// PAYLOAD: DATA & CLAIMS\n${payloadJson}\n\n// SIGNATURE (Offline - Not verified)\n${signatureRaw}`
      : "";

  return (
    <ToolLayout
      id="jwt-decoder"
      title="JWT (JSON Web Token) Decoder"
      description="Decode and inspect Header, Payload claims and expiration timestamps without external verification"
      icon={KeyRound}
      categoryName="Encoders / Decoders"
      inputLabel="Encoded JWT Token"
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder="Paste encoded JWT here (e.g. eyJhbGciOi...)"
      outputLabel="Decoded JSON Token"
      outputValue={outputCombined}
      error={error}
      customPanes={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[420px]">
          {/* Left: Input */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.rawJwtToken}</span>
              <button
                onClick={() => setInput("")}
                disabled={!input}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
              >
                {t.common.clear}
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.ui.pasteJwtPlaceholder}
              spellCheck={false}
              className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>

          {/* Right: Inspection details */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.decodedTokenInspection}</span>
              {meta && meta.expiresAt && (
                <div className="flex items-center gap-1.5">
                  {meta.isExpired ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      <ShieldAlert className="w-3 h-3" /> {t.ui.expired}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-3 h-3" /> {t.ui.valid}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
              {meta && (meta.expiresAt || meta.issuedAt || meta.issuer || meta.subject) && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 font-sans space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" /> {t.ui.tokenSummary}
                  </div>
                  {meta.issuer && <div>{t.ui.issuer} <span className="font-mono text-slate-800 dark:text-slate-100">{meta.issuer}</span></div>}
                  {meta.subject && <div>{t.ui.subject} <span className="font-mono text-slate-800 dark:text-slate-100">{meta.subject}</span></div>}
                  {meta.issuedAt && <div>{t.ui.issuedAt} <span className="font-mono text-slate-800 dark:text-slate-100">{meta.issuedAt}</span></div>}
                  {meta.expiresAt && (
                    <div>
                      Expires At:{" "}
                      <span className={`font-mono font-medium ${meta.isExpired ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {meta.expiresAt}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {headerJson && (
                <div>
                  <div className="font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] mb-1">
                    Header (Algorithm & Type)
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-x-auto">
                    {headerJson}
                  </pre>
                </div>
              )}

              {payloadJson && (
                <div>
                  <div className="font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] mb-1">
                    Payload (Claims & Data)
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-x-auto">
                    {payloadJson}
                  </pre>
                </div>
              )}

              {!headerJson && !payloadJson && (
                <div className="h-full flex items-center justify-center text-slate-400 font-sans italic">
                  {t.ui.pasteJwtPrompt}
                </div>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
};
