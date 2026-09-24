import React, { useState, useMemo } from "react";
import { FileText, Eye } from "lucide-react";
import { marked } from "marked";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";
import "./markdown-preview.css";

// Configure marked with GFM support
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const MarkdownPreview: React.FC = () => {
  const { t } = useTranslation();
  const [markdown, setMarkdown] = useState(`# Toys of Dev
A modern **offline developer toolbox**.

## Features
- [x] 100% Offline & Stateless
- [x] Clean Dark & Light Theme
- [x] Fast In-Memory Processing

### Code Example
\`\`\`typescript
const greeting = "Hello, Toys of Dev!";
console.log(greeting);
\`\`\`

> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra
`);

  const parsedHtml = useMemo(() => {
    try {
      return (marked.parse(markdown, { async: false }) as string) || "";
    } catch {
      return "";
    }
  }, [markdown]);

  return (
    <ToolLayout
      id="markdown-preview"
      title="Markdown Live Preview"
      description="Edit and render GitHub Flavored Markdown with real-time live preview"
      icon={FileText}
      categoryName="Text Utilities"
      customPanes={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[460px]">
          {/* Left: Editor */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.markdownEditor}</span>
              <button
                onClick={() => setMarkdown("")}
                disabled={!markdown}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
              >
                {t.common.clear}
              </button>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={t.ui.typeMarkdownPlaceholder}
              spellCheck={false}
              className="flex-1 w-full p-4 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>

          {/* Right: Live Preview */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t.ui.preview}</span>
            </div>
            <div
              className="flex-1 overflow-y-auto p-6 markdown-preview-body"
              dangerouslySetInnerHTML={{ __html: parsedHtml }}
            />
          </div>
        </div>
      }
    />
  );
};
