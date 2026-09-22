import React, { useState, useEffect } from "react";
import { CheckCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

interface XmlStats {
  elementsCount: number;
  attributesCount: number;
  rootTag: string;
}

export const XmlValidator: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    `<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <book id="bk101">\n    <author>Gambardella, Matthew</author>\n    <title>XML Developer's Guide</title>\n    <price>44.95</price>\n  </book>\n</catalog>`,
  );
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<XmlStats | null>(null);

  useEffect(() => {
    if (!input.trim()) {
      setIsValid(null);
      setErrorMessage(null);
      setStats(null);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(input, "text/xml");
      const parseError = doc.getElementsByTagName("parsererror");

      if (parseError.length > 0) {
        setIsValid(false);
        setErrorMessage(parseError[0].textContent || "Syntax Error in XML document");
        setStats(null);
      } else {
        setIsValid(true);
        setErrorMessage(null);

        // Count elements and attributes
        const allElements = doc.getElementsByTagName("*");
        let attrCount = 0;
        for (let i = 0; i < allElements.length; i++) {
          attrCount += allElements[i].attributes.length;
        }

        setStats({
          elementsCount: allElements.length,
          attributesCount: attrCount,
          rootTag: doc.documentElement.tagName,
        });
      }
    } catch (err: unknown) {
      setIsValid(false);
      setErrorMessage(err instanceof Error ? err.message : "XML parsing error");
      setStats(null);
    }
  }, [input]);

  return (
    <ToolLayout
      id="xml-validator"
      title="XML Validator"
      description="Validate XML documents against syntax specifications and inspect structure"
      icon={CheckCheck}
      categoryName="Graphic & Testing"
      customPanes={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[460px]">
          {/* Left: Input Textarea */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.xmlInputContent}</span>
              <button
                onClick={() => setInput("")}
                disabled={!input}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
              >
                {t.common.clear}
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.ui.pasteXmlPlaceholder}
              spellCheck={false}
              className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>

          {/* Right: Validation Status */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm p-6 justify-between gap-6">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.ui.status}
              </div>

              {isValid === true && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">{t.ui.valid} XML Document</div>
                    <div className="text-xs opacity-90 mt-0.5">
                      {t.ui.xmlWellFormed}
                    </div>
                  </div>
                </div>
              )}

              {isValid === false && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">{t.ui.invalid} XML Document</div>
                    <div className="text-xs opacity-90 mt-0.5 break-all font-mono">
                      {errorMessage}
                    </div>
                  </div>
                </div>
              )}

              {stats && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">{t.ui.rootElement}</div>
                    <div className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                      &lt;{stats.rootTag}&gt;
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">{t.ui.totalElements}</div>
                    <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                      {stats.elementsCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">{t.ui.totalAttributes}</div>
                    <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                      {stats.attributesCount}
                    </div>
                  </div>
                </div>
              )}

              {isValid === null && (
                <div className="text-sm text-slate-400 italic text-center py-12">
                  {t.ui.pasteXmlPrompt}
                </div>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
};
