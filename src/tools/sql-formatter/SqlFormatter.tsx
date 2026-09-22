import React, { useState, useEffect } from "react";
import { Database } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

export const SqlFormatter: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    "select u.id, u.username, p.title from users u left join posts p on u.id = p.user_id where u.active = 1 and p.published_at is not null group by u.id order by u.created_at desc limit 10;",
  );
  const [uppercaseKeywords, setUppercaseKeywords] = useState(true);
  const [output, setOutput] = useState("");

  const formatSql = (query: string): string => {
    if (!query.trim()) return "";

    const keywords = [
      "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
      "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "DELETE",
      "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "CROSS JOIN", "JOIN", "ON",
      "UNION ALL", "UNION", "AND", "OR", "IN", "NOT IN", "EXISTS", "BETWEEN", "LIKE",
      "IS NULL", "IS NOT NULL", "CREATE TABLE", "ALTER TABLE", "DROP TABLE", "AS",
      "CASE", "WHEN", "THEN", "ELSE", "END", "DISTINCT",
    ];

    let result = query.replace(/\s+/g, " ");

    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      result = result.replace(regex, uppercaseKeywords ? kw : kw.toLowerCase());
    });

    const majorClauses = [
      "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
      "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "JOIN", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM",
    ];

    majorClauses.forEach((clause) => {
      const target = uppercaseKeywords ? clause : clause.toLowerCase();
      const regex = new RegExp(`\\s+(${target})\\b`, "gi");
      result = result.replace(regex, `\n$1`);
    });

    // Indent sub-items after SELECT
    const lines = result.split("\n").map((line) => {
      const trimmed = line.trim();
      if (majorClauses.some((c) => trimmed.toUpperCase().startsWith(c))) {
        return trimmed;
      }
      return `  ${trimmed}`;
    });

    return lines.join("\n");
  };

  useEffect(() => {
    setOutput(formatSql(input));
  }, [input, uppercaseKeywords]);

  const config = (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
      <input
        type="checkbox"
        checked={uppercaseKeywords}
        onChange={(e) => setUppercaseKeywords(e.target.checked)}
        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
      />
      <span>{t.ui.uppercase} SQL Keywords</span>
    </label>
  );

  return (
    <ToolLayout
      id="sql-formatter"
      title="SQL Formatter & Beautifier"
      description="Format and beautify standard SQL queries with uppercase keywords and clause indentation"
      icon={Database}
      categoryName="Formatters"
      configuration={config}
      inputValue={input}
      onInputChange={setInput}
      inputPlaceholder="Paste raw SQL query here..."
      outputValue={output}
      outputPlaceholder="Formatted SQL query will appear here..."
    />
  );
};
