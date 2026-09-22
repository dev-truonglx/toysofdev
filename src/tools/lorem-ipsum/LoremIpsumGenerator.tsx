import React, { useState, useEffect, useCallback } from "react";
import { AlignLeft, RefreshCw } from "lucide-react";
import { ToolLayout } from "../../components/common/ToolLayout";
import { useTranslation } from "../../i18n";

type LoremType = "paragraphs" | "sentences" | "words";

export const LoremIpsumGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [type, setType] = useState<LoremType>("paragraphs");
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [output, setOutput] = useState("");

  const words = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
    "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
    "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
    "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
    "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate", "velit",
    "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint", "occaecat",
    "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt",
    "mollit", "anim", "id", "est", "laborum",
  ];

  const generateSentence = () => {
    const len = Math.floor(Math.random() * 10) + 8;
    const sWords: string[] = [];
    for (let i = 0; i < len; i++) {
      sWords.push(words[Math.floor(Math.random() * words.length)]);
    }
    const res = sWords.join(" ");
    return res.charAt(0).toUpperCase() + res.slice(1) + ".";
  };

  const generate = useCallback(() => {
    let result = "";
    if (type === "words") {
      const chosen: string[] = [];
      if (startWithLorem && count >= 2) {
        chosen.push("Lorem", "ipsum");
        for (let i = 2; i < count; i++) {
          chosen.push(words[Math.floor(Math.random() * words.length)]);
        }
      } else {
        for (let i = 0; i < count; i++) {
          chosen.push(words[Math.floor(Math.random() * words.length)]);
        }
      }
      result = chosen.join(" ");
    } else if (type === "sentences") {
      const sentences: string[] = [];
      for (let i = 0; i < count; i++) {
        sentences.push(generateSentence());
      }
      if (startWithLorem && sentences.length > 0) {
        sentences[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
      }
      result = sentences.join(" ");
    } else {
      const paragraphs: string[] = [];
      for (let p = 0; p < count; p++) {
        const sentenceCount = Math.floor(Math.random() * 4) + 4;
        const sList: string[] = [];
        for (let s = 0; s < sentenceCount; s++) {
          sList.push(generateSentence());
        }
        paragraphs.push(sList.join(" "));
      }
      if (startWithLorem && paragraphs.length > 0) {
        paragraphs[0] =
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
          paragraphs[0];
      }
      result = paragraphs.join("\n\n");
    }
    setOutput(result);
  }, [type, count, startWithLorem]);

  useEffect(() => {
    generate();
  }, [generate]);

  const config = (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="lorem-type" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.generate}:
        </label>
        <select
          id="lorem-type"
          value={type}
          onChange={(e) => setType(e.target.value as LoremType)}
          className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="paragraphs">{t.ui.paragraphs}</option>
          <option value="sentences">{t.ui.sentences}</option>
          <option value="words">{t.ui.words}</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="lorem-count" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {t.ui.count}:
        </label>
        <input
          id="lorem-count"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
        <input
          type="checkbox"
          checked={startWithLorem}
          onChange={(e) => setStartWithLorem(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>{t.ui.startWithLorem}</span>
      </label>
    </>
  );

  const actionsRight = (
    <button
      onClick={generate}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>{t.ui.generate}</span>
    </button>
  );

  return (
    <ToolLayout
      id="lorem-ipsum-generator"
      title="Lorem Ipsum Generator"
      description="Create placeholder text by paragraphs, sentences, or words"
      icon={AlignLeft}
      categoryName="Generators"
      configuration={config}
      outputValue={output}
      actionsRight={actionsRight}
    />
  );
};
