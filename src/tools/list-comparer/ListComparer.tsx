import React, { useState } from "react";
import { ListFilter, ArrowRight } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type ListOperation = "intersection" | "diff-a-b" | "diff-b-a" | "symmetric-diff" | "union";

export const ListComparer: React.FC = () => {
  const { t } = useTranslation();
  const [listA, setListA] = useState("apple\nbanana\ncherry\ndate");
  const [listB, setListB] = useState("banana\ndate\nfig\ngrape");
  const [op, setOp] = useState<ListOperation>("intersection");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [trimItems, setTrimItems] = useState(true);

  const parseList = (text: string): string[] => {
    return text
      .split("\n")
      .map((item) => (trimItems ? item.trim() : item))
      .filter((item) => item.length > 0);
  };

  const aItems = parseList(listA);
  const bItems = parseList(listB);

  const normalize = (s: string) => (caseSensitive ? s : s.toLowerCase());

  const computeResult = (): string[] => {
    const aNormMap = new Map(aItems.map((item) => [normalize(item), item]));
    const bNormMap = new Map(bItems.map((item) => [normalize(item), item]));

    const aNormSet = new Set(aNormMap.keys());
    const bNormSet = new Set(bNormMap.keys());

    switch (op) {
      case "intersection":
        return Array.from(aNormSet)
          .filter((k) => bNormSet.has(k))
          .map((k) => aNormMap.get(k)!);
      case "diff-a-b":
        return Array.from(aNormSet)
          .filter((k) => !bNormSet.has(k))
          .map((k) => aNormMap.get(k)!);
      case "diff-b-a":
        return Array.from(bNormSet)
          .filter((k) => !aNormSet.has(k))
          .map((k) => bNormMap.get(k)!);
      case "symmetric-diff": {
        const uniqueA = Array.from(aNormSet)
          .filter((k) => !bNormSet.has(k))
          .map((k) => aNormMap.get(k)!);
        const uniqueB = Array.from(bNormSet)
          .filter((k) => !aNormSet.has(k))
          .map((k) => bNormMap.get(k)!);
        return [...uniqueA, ...uniqueB];
      }
      case "union": {
        const unionKeys = new Set([...aNormSet, ...bNormSet]);
        return Array.from(unionKeys).map((k) => aNormMap.get(k) || bNormMap.get(k)!);
      }
      default:
        return [];
    }
  };

  const results = computeResult();

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="list-op" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.operation}
        </label>
        <select
          id="list-op"
          value={op}
          onChange={(e) => setOp(e.target.value as ListOperation)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="intersection">Intersection (A ∩ B)</option>
          <option value="diff-a-b">Difference (A \ B)</option>
          <option value="diff-b-a">Difference (B \ A)</option>
          <option value="symmetric-diff">Symmetric Difference (A △ B)</option>
          <option value="union">Union (A ∪ B)</option>
        </select>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
          className="rounded text-indigo-600 focus:ring-indigo-500"
        />
        <span>{t.ui.caseSensitive}</span>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={trimItems}
          onChange={(e) => setTrimItems(e.target.checked)}
          className="rounded text-indigo-600 focus:ring-indigo-500"
        />
        <span>{t.diff.ignoreWhitespace}</span>
      </label>
    </>
  );

  return (
    <ToolLayout
      id="list-comparer"
      title="List Comparer"
      description="Compare two lists of text line-by-line to find intersection, difference, or union"
      icon={ListFilter}
      categoryName="Text Utilities"
      configuration={config}
      customPanes={
        <div className="flex flex-col gap-4 flex-1 min-h-[500px]">
          {/* Top 2 Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-56">
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.listA}</span>
                <span>{aItems.length} items</span>
              </div>
              <textarea
                value={listA}
                onChange={(e) => setListA(e.target.value)}
                placeholder={t.ui.enterItemsPlaceholder}
                spellCheck={false}
                className="flex-1 w-full p-3 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{t.ui.listB}</span>
                <span>{bItems.length} items</span>
              </div>
              <textarea
                value={listB}
                onChange={(e) => setListB(e.target.value)}
                placeholder={t.ui.enterItemsPlaceholder}
                spellCheck={false}
                className="flex-1 w-full p-3 resize-none bg-transparent font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Bottom Result */}
          <div className="flex-1 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t.toolLayout.output} ({results.length})</span>
              </div>
            </div>
            <textarea
              value={results.join("\n")}
              readOnly
              spellCheck={false}
              placeholder={t.ui.comparisonResultsPlaceholder}
              className="flex-1 w-full p-4 resize-none bg-slate-50/40 dark:bg-slate-950/40 font-mono text-xs leading-relaxed focus:outline-none text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      }
    />
  );
};
