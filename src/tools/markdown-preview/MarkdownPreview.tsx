import React, { useState } from "react";
import { FileText, Eye } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

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

  // Basic lightweight GFM-like parser
  const renderMarkdown = (src: string): string => {
    let html = src
      // Escaping HTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold mt-4 mb-2 text-slate-800 dark:text-slate-100">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-5 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold mt-2 mb-3 text-slate-900 dark:text-white">$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-3 my-2 text-slate-600 dark:text-slate-400 italic bg-indigo-50/30 dark:bg-indigo-950/20 py-1 rounded-r">$1</blockquote>')
      // Code blocks
      .replace(/```([a-z]*)\n([\s\S]*?)```/gim, '<pre class="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl overflow-x-auto my-3 text-xs font-mono text-indigo-600 dark:text-indigo-400"><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 text-xs font-mono">$1</code>')
      // Bold & Italic
      .replace(/\*\*([^*]+)\*\*/gim, '<strong class="font-bold text-slate-900 dark:text-slate-100">$1</strong>')
      .replace(/\*([^*]+)\*/gim, '<em class="italic">$1</em>')
      // Checklists
      .replace(/^- \[x\] (.*$)/gim, '<li class="flex items-center gap-2 text-slate-700 dark:text-slate-300 my-1"><input type="checkbox" checked disabled class="rounded text-indigo-600" /> <span>$1</span></li>')
      .replace(/^- \[ \] (.*$)/gim, '<li class="flex items-center gap-2 text-slate-700 dark:text-slate-300 my-1"><input type="checkbox" disabled class="rounded" /> <span>$1</span></li>')
      // Unordered lists
      .replace(/^- (.*$)/gim, '<li class="list-disc ml-5 my-1 text-slate-700 dark:text-slate-300">$1</li>')
      // Paragraph breaks
      .replace(/\n\n/gim, '</p><p class="my-2 leading-relaxed text-slate-700 dark:text-slate-300">');

    return `<p class="leading-relaxed text-slate-700 dark:text-slate-300">${html}</p>`;
  };

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
              className="flex-1 overflow-y-auto p-6 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
            />
          </div>
        </div>
      }
    />
  );
};
