import React, { useState, useEffect } from "react";
import { FileCode } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export type IndentMode = "2" | "4" | "tab" | "minified";
export type AttributeLayout = "inline" | "multiline";

export interface XmlAttribute {
  name: string;
  value: string;
  quote: string;
}

export function parseXmlAttributes(tagContent: string): { tagName: string; attributes: XmlAttribute[] } {
  const match = tagContent.match(/^([^\s/>]+)/);
  if (!match) return { tagName: "", attributes: [] };
  const tagName = match[1];
  const rest = tagContent.slice(tagName.length);

  const attributes: XmlAttribute[] = [];
  const attrRegex = /([^\s=/>]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(rest)) !== null) {
    attributes.push({
      name: attrMatch[1],
      value: attrMatch[3],
      quote: attrMatch[2],
    });
  }

  return { tagName, attributes };
}

export const formatXml = (
  xmlStr: string,
  indentMode: IndentMode,
  attributeLayout: AttributeLayout = "inline",
): string => {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "text/xml");

    const parserError = doc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error(parserError[0].textContent || "XML Syntax Error");
    }
  }

  if (indentMode === "minified") {
    let min = xmlStr.replace(/<!--[\s\S]*?-->/g, "");
    min = min.replace(/>\s+</g, "><");
    return min.trim();
  }

  const indentStr = indentMode === "tab" ? "\t" : " ".repeat(parseInt(indentMode, 10));
  const lines: string[] = [];
  let depth = 0;

  const tokenRegex =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<\/[^\s>]+>|<[^\s>]+(?:\s+[^=/>]+(?:\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^\s>]+))?)*\s*\/?>|[^<]+/g;

  const rawTokens = xmlStr.match(tokenRegex) || [];
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (t.startsWith("<")) {
      tokens.push(t.trim());
    } else {
      const trimmed = t.trim();
      if (trimmed.length > 0) {
        tokens.push(trimmed);
      }
    }
  }

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith("<?") || token.startsWith("<!DOCTYPE")) {
      lines.push(token);
      i++;
    } else if (token.startsWith("<!--") || token.startsWith("<![CDATA[")) {
      lines.push(indentStr.repeat(depth) + token);
      i++;
    } else if (token.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr.repeat(depth) + token);
      i++;
    } else if (token.startsWith("<")) {
      const isSelfClosing = token.endsWith("/>");
      const inner = token.slice(1, isSelfClosing ? -2 : -1).trim();
      const { tagName, attributes } = parseXmlAttributes(inner);

      // Check if next token is simple text and token after that is closing tag </tagName>
      const nextToken = tokens[i + 1];
      const afterNextToken = tokens[i + 2];
      const isInlineElement =
        !isSelfClosing &&
        nextToken &&
        !nextToken.startsWith("<") &&
        afterNextToken === `</${tagName}>`;

      if (isInlineElement) {
        if (attributes.length <= 1 || attributeLayout === "inline") {
          const attrsStr =
            attributes.length > 0
              ? " " + attributes.map((a) => `${a.name}=${a.quote}${a.value}${a.quote}`).join(" ")
              : "";
          lines.push(`${indentStr.repeat(depth)}<${tagName}${attrsStr}>${nextToken}</${tagName}>`);
        } else {
          const currentIndent = indentStr.repeat(depth);
          const attrIndent = indentStr.repeat(depth + 1);
          lines.push(`${currentIndent}<${tagName}`);
          for (const attr of attributes) {
            lines.push(`${attrIndent}${attr.name}=${attr.quote}${attr.value}${attr.quote}`);
          }
          lines.push(`${currentIndent}>${nextToken}</${tagName}>`);
        }
        i += 3;
        continue;
      }

      if (attributes.length === 0) {
        lines.push(indentStr.repeat(depth) + (isSelfClosing ? `<${tagName} />` : `<${tagName}>`));
      } else if (attributeLayout === "inline" || attributes.length <= 1) {
        const attrsStr = attributes
          .map((a) => `${a.name}=${a.quote}${a.value}${a.quote}`)
          .join(" ");
        lines.push(
          indentStr.repeat(depth) +
            (isSelfClosing ? `<${tagName} ${attrsStr} />` : `<${tagName} ${attrsStr}>`),
        );
      } else {
        const currentIndent = indentStr.repeat(depth);
        const attrIndent = indentStr.repeat(depth + 1);
        lines.push(`${currentIndent}<${tagName}`);
        for (const attr of attributes) {
          lines.push(`${attrIndent}${attr.name}=${attr.quote}${attr.value}${attr.quote}`);
        }
        lines.push(currentIndent + (isSelfClosing ? "/>" : ">"));
      }

      if (!isSelfClosing) {
        depth++;
      }
      i++;
    } else {
      lines.push(indentStr.repeat(depth) + token);
      i++;
    }
  }

  return lines.join("\n");
};

export const XmlFormatter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    `<note><to>Tove</to><from>Jani</from><heading>Reminder</heading><body>Don't forget me this weekend!</body></note>`,
  );
  const [indent, setIndent] = useState<IndentMode>("2");
  const [attributeLayout, setAttributeLayout] = useState<AttributeLayout>("inline");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      const result = formatXml(input, indent, attributeLayout);
      setOutput(result);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${t.ui.invalid} XML`);
      setOutput("");
    }
  }, [input, indent, attributeLayout, t]);

  const config = (
    <div className="flex flex-wrap items-center gap-4">
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

      {indent !== "minified" && (
        <div className="flex items-center gap-2">
          <label htmlFor="xml-attribute-layout" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            {t.ui.attributeLayout}:
          </label>
          <select
            id="xml-attribute-layout"
            value={attributeLayout}
            onChange={(e) => setAttributeLayout(e.target.value as AttributeLayout)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="inline">{t.ui.inlineAttributes}</option>
            <option value="multiline">{t.ui.multilineAttributes}</option>
          </select>
        </div>
      )}
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
