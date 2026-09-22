import React, { useState, useEffect } from "react";
import { FileCode } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type IndentMode = "2" | "4" | "tab" | "minified";

export const XmlFormatter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    `<note><to>Tove</to><from>Jani</from><heading>Reminder</heading><body>Don't forget me this weekend!</body></note>`,
  );
  const [indent, setIndent] = useState<IndentMode>("2");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const formatXml = (xmlStr: string, indentMode: IndentMode): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "text/xml");

    const parserError = doc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error(parserError[0].textContent || "XML Syntax Error");
    }

    if (indentMode === "minified") {
      return xmlStr
        .replace(/>\s+</g, "><")
        .replace(/\s+/g, " ")
        .trim();
    }

    const indentStr = indentMode === "tab" ? "\t" : " ".repeat(parseInt(indentMode, 10));
    let formatted = "";
    let pad = 0;

    // Normalize whitespace between tags
    const cleanXml = xmlStr.replace(/>\s*</g, "><");
    const reg = /(>)(<)(\/*)/g;
    const xmlWithBreaks = cleanXml.replace(reg, "$1\r\n$2$3");

    xmlWithBreaks.split("\r\n").forEach((node) => {
      let indentMod = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indentMod = 0;
      } else if (node.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
        indentMod = 1;
      } else {
        indentMod = 0;
      }

      formatted += indentStr.repeat(pad) + node + "\r\n";
      pad += indentMod;
    });

    return formatted.trim();
  };

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      const result = formatXml(input, indent);
      setOutput(result);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${t.ui.invalid} XML`);
      setOutput("");
    }
  }, [input, indent, t]);

  const config = (
    <div className="flex items-center gap-2">
      <label htmlFor="xml-indent" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
        {t.ui.indentation}:
      </label>
      <select
        id="xml-indent"
        value={indent}
        onChange={(e) => setIndent(e.target.value as IndentMode)}
        className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="2">{t.ui.spaces2}</option>
        <option value="4">{t.ui.spaces4}</option>
        <option value="tab">{t.ui.tab1}</option>
        <option value="minified">{t.ui.minified0}</option>
      </select>
    </div>
  );

  return (
    <ToolLayout
      id="xml-formatter"
      title="XML Formatter & Minifier"
      description="Format, indent, or minify XML / SVG text with syntax validation"
      icon={FileCode}
      categoryName="Formatters"
      configuration={config}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder="Paste raw XML here..."
      outputValue={output}
      error={error}
    />
  );
};
