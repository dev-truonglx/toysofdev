import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Hash,
  Search,
  X,
  ChevronUp,
  Code2,
  ListTree,
  Copy,
  Check,
  ListFilter,
  Loader2,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "../../i18n";
import { parseXmlAttributes } from "../../tools/xml-formatter/XmlFormatter";

export interface XmlAttribute {
  name: string;
  value: string;
  quote?: string;
}

export interface XmlNodeItem {
  id: string;
  type: "element" | "text" | "comment" | "cdata" | "declaration";
  name: string;
  attributes: XmlAttribute[];
  children: XmlNodeItem[];
  textContent?: string;
  isSelfClosing?: boolean;
}

export interface XmlLine {
  id: string;
  depth: number;
  path: string;
  canFold: boolean;
  isFolded: boolean;
  kind:
    | "open-tag"
    | "close-tag"
    | "self-closing"
    | "inline-element"
    | "folded-element"
    | "text"
    | "comment"
    | "cdata"
    | "declaration";
  tagName?: string;
  attributes?: XmlAttribute[];
  text?: string;
}

export interface XmlMatch {
  path: string;
  kind: "tag" | "attr-name" | "attr-val" | "text";
  target: string;
  node: XmlNodeItem;
  ancestorPaths: string[];
}

/**
 * Robust XML Tree Parser: parses standard XML string into a hierarchal XmlNodeItem tree.
 */
export function parseXmlToTree(xmlStr: string): { nodes: XmlNodeItem[]; error?: string } {
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, "application/xml");

      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        return { nodes: [], error: parserError.textContent || "XML parsing error" };
      }

      let idCounter = 0;
      const convertNode = (node: Node, path: string): XmlNodeItem | null => {
        if (node.nodeType === 1) {
          // Element
          const el = node as Element;
          const attrs: XmlAttribute[] = [];
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            attrs.push({ name: attr.name, value: attr.value, quote: '"' });
          }

          const children: XmlNodeItem[] = [];
          let onlyText: string | undefined = undefined;

          const nonWhitespaceChildren = Array.from(el.childNodes).filter((c) => {
            if (c.nodeType === 3) return (c.textContent || "").trim().length > 0;
            return true;
          });

          if (
            nonWhitespaceChildren.length === 1 &&
            nonWhitespaceChildren[0].nodeType === 3
          ) {
            onlyText = nonWhitespaceChildren[0].textContent || "";
          } else {
            for (let i = 0; i < el.childNodes.length; i++) {
              const child = el.childNodes[i];
              if (child.nodeType === 3 && !(child.textContent || "").trim()) continue;
              const converted = convertNode(child, `${path}.${idCounter++}`);
              if (converted) children.push(converted);
            }
          }

          return {
            id: path,
            type: "element",
            name: el.tagName,
            attributes: attrs,
            children,
            textContent: onlyText,
            isSelfClosing: children.length === 0 && onlyText === undefined,
          };
        } else if (node.nodeType === 3) {
          // Text
          const text = (node.textContent || "").trim();
          if (!text) return null;
          return {
            id: path,
            type: "text",
            name: "",
            attributes: [],
            children: [],
            textContent: text,
          };
        } else if (node.nodeType === 8) {
          // Comment
          return {
            id: path,
            type: "comment",
            name: "",
            attributes: [],
            children: [],
            textContent: node.textContent || "",
          };
        } else if (node.nodeType === 4) {
          // CDATA
          return {
            id: path,
            type: "cdata",
            name: "",
            attributes: [],
            children: [],
            textContent: node.textContent || "",
          };
        } else if (node.nodeType === 7) {
          // Processing Instruction <?xml ... ?>
          return {
            id: path,
            type: "declaration",
            name: node.nodeName,
            attributes: [],
            children: [],
            textContent: (node as ProcessingInstruction).data || "",
          };
        }
        return null;
      };

      const nodes: XmlNodeItem[] = [];
      for (let i = 0; i < doc.childNodes.length; i++) {
        const item = convertNode(doc.childNodes[i], String(i));
        if (item) nodes.push(item);
      }
      return { nodes };
    } catch (e: unknown) {
      return { nodes: [], error: e instanceof Error ? e.message : "XML parse error" };
    }
  }

  // Token-based fallback for Node.js / unit tests
  return parseXmlTokensFallback(xmlStr);
}

function parseXmlTokensFallback(xmlStr: string): { nodes: XmlNodeItem[]; error?: string } {
  const tokenRegex =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<\/[^\s>]+>|<[^\s>]+(?:\s+[^=/>]+(?:\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^\s>]+))?)*\s*\/?>|[^<]+/g;
  const rawTokens = xmlStr.match(tokenRegex) || [];
  const tokens = rawTokens.map((t) => t.trim()).filter((t) => t.length > 0);

  const rootNodes: XmlNodeItem[] = [];
  const stack: { node: XmlNodeItem; path: string }[] = [];

  let counter = 0;
  for (const token of tokens) {
    const currentPath = stack.length > 0 ? `${stack[stack.length - 1].path}.${counter++}` : String(counter++);

    if (token.startsWith("<?") || token.startsWith("<!DOCTYPE")) {
      const declNode: XmlNodeItem = {
        id: currentPath,
        type: "declaration",
        name: token.replace(/[<>?]/g, "").split(" ")[0],
        attributes: [],
        children: [],
        textContent: token,
      };
      if (stack.length > 0) stack[stack.length - 1].node.children.push(declNode);
      else rootNodes.push(declNode);
    } else if (token.startsWith("<!--")) {
      const commentNode: XmlNodeItem = {
        id: currentPath,
        type: "comment",
        name: "",
        attributes: [],
        children: [],
        textContent: token.replace(/^<!--|-->$/g, "").trim(),
      };
      if (stack.length > 0) stack[stack.length - 1].node.children.push(commentNode);
      else rootNodes.push(commentNode);
    } else if (token.startsWith("<![CDATA[")) {
      const cdataNode: XmlNodeItem = {
        id: currentPath,
        type: "cdata",
        name: "",
        attributes: [],
        children: [],
        textContent: token.replace(/^<!\[CDATA\[|\]\]>$/g, ""),
      };
      if (stack.length > 0) stack[stack.length - 1].node.children.push(cdataNode);
      else rootNodes.push(cdataNode);
    } else if (token.startsWith("</")) {
      if (stack.length > 0) {
        stack.pop();
      }
    } else if (token.startsWith("<")) {
      const isSelfClosing = token.endsWith("/>");
      const inner = token.slice(1, isSelfClosing ? -2 : -1).trim();
      const { tagName, attributes } = parseXmlAttributes(inner);

      const elNode: XmlNodeItem = {
        id: currentPath,
        type: "element",
        name: tagName,
        attributes: attributes.map((a) => ({ name: a.name, value: a.value, quote: a.quote || '"' })),
        children: [],
        isSelfClosing,
      };

      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(elNode);
      } else {
        rootNodes.push(elNode);
      }

      if (!isSelfClosing) {
        stack.push({ node: elNode, path: currentPath });
      }
    } else {
      // Text node
      if (stack.length > 0) {
        const parent = stack[stack.length - 1].node;
        if (parent.children.length === 0 && !parent.textContent) {
          parent.textContent = token;
        } else {
          parent.children.push({
            id: currentPath,
            type: "text",
            name: "",
            attributes: [],
            children: [],
            textContent: token,
          });
        }
      }
    }
  }

  return { nodes: rootNodes };
}

/**
 * Collect all collapsible element paths in the XML tree.
 */
export function getAllCollapsibleXmlPaths(nodes: XmlNodeItem[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "element" && n.children.length > 0) {
      acc.push(n.id);
      getAllCollapsibleXmlPaths(n.children, acc);
    }
  }
  return acc;
}

/**
 * Search tags, attributes and text in the XML tree.
 * Optimized with maxMatches to prevent main thread freezing.
 */
export function searchXmlTree(
  nodes: XmlNodeItem[],
  query: string,
  ancestors: string[] = [],
  results: XmlMatch[] = [],
  maxMatches = 1000,
): XmlMatch[] {
  if (!query || results.length >= maxMatches) return results;
  const q = query.toLowerCase().trim();

  for (const node of nodes) {
    if (results.length >= maxMatches) break;
    const nextAncestors = [...ancestors, node.id];

    if (node.type === "element") {
      if (node.name.toLowerCase().includes(q)) {
        results.push({ path: node.id, kind: "tag", target: node.name, node, ancestorPaths: ancestors });
      }
      for (const attr of node.attributes) {
        if (results.length >= maxMatches) break;
        if (attr.name.toLowerCase().includes(q)) {
          results.push({ path: node.id, kind: "attr-name", target: attr.name, node, ancestorPaths: ancestors });
        }
        if (attr.value.toLowerCase().includes(q)) {
          results.push({ path: node.id, kind: "attr-val", target: attr.value, node, ancestorPaths: ancestors });
        }
      }
      if (results.length < maxMatches && node.textContent && node.textContent.toLowerCase().includes(q)) {
        results.push({ path: node.id, kind: "text", target: node.textContent, node, ancestorPaths: ancestors });
      }
      if (results.length < maxMatches) {
        searchXmlTree(node.children, q, nextAncestors, results, maxMatches);
      }
    } else if (node.textContent && node.textContent.toLowerCase().includes(q)) {
      results.push({ path: node.id, kind: "text", target: node.textContent, node, ancestorPaths: ancestors });
    }
  }

  return results;
}

/**
 * Flatten XML node tree into lines with folding support.
 */
export function flattenXmlTree(
  nodes: XmlNodeItem[],
  collapsedPaths: Set<string>,
  depth = 0,
  t?: { ui?: { nodesCount?: string } },
): XmlLine[] {
  const lines: XmlLine[] = [];

  const formatNodesCount = (n: number) =>
    t?.ui?.nodesCount ? t.ui.nodesCount.replace("{count}", String(n)) : `${n} nodes`;

  for (const node of nodes) {
    if (node.type === "declaration") {
      lines.push({
        id: node.id,
        depth,
        path: node.id,
        canFold: false,
        isFolded: false,
        kind: "declaration",
        text: node.textContent,
      });
    } else if (node.type === "comment") {
      lines.push({
        id: node.id,
        depth,
        path: node.id,
        canFold: false,
        isFolded: false,
        kind: "comment",
        text: node.textContent,
      });
    } else if (node.type === "cdata") {
      lines.push({
        id: node.id,
        depth,
        path: node.id,
        canFold: false,
        isFolded: false,
        kind: "cdata",
        text: node.textContent,
      });
    } else if (node.type === "text") {
      lines.push({
        id: node.id,
        depth,
        path: node.id,
        canFold: false,
        isFolded: false,
        kind: "text",
        text: node.textContent,
      });
    } else if (node.type === "element") {
      if (node.isSelfClosing) {
        lines.push({
          id: node.id,
          depth,
          path: node.id,
          canFold: false,
          isFolded: false,
          kind: "self-closing",
          tagName: node.name,
          attributes: node.attributes,
        });
      } else if (node.textContent !== undefined && node.children.length === 0) {
        lines.push({
          id: node.id,
          depth,
          path: node.id,
          canFold: false,
          isFolded: false,
          kind: "inline-element",
          tagName: node.name,
          attributes: node.attributes,
          text: node.textContent,
        });
      } else {
        const isFolded = collapsedPaths.has(node.id);
        const childrenCount = node.children.length;

        if (isFolded) {
          lines.push({
            id: node.id,
            depth,
            path: node.id,
            canFold: true,
            isFolded: true,
            kind: "folded-element",
            tagName: node.name,
            attributes: node.attributes,
            text: formatNodesCount(childrenCount),
          });
        } else {
          // Open tag
          lines.push({
            id: node.id,
            depth,
            path: node.id,
            canFold: true,
            isFolded: false,
            kind: "open-tag",
            tagName: node.name,
            attributes: node.attributes,
          });

          // Children
          lines.push(...flattenXmlTree(node.children, collapsedPaths, depth + 1, t));

          // Close tag
          lines.push({
            id: `${node.id}:close`,
            depth,
            path: node.id,
            canFold: false,
            isFolded: false,
            kind: "close-tag",
            tagName: node.name,
          });
        }
      }
    }
  }

  return lines;
}

/**
 * Helper to render highlighted search matches in XML strings.
 */
function renderHighlight(text: string, query: string, isCurrent: boolean) {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase().trim();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;

  return (
    <>
      {text.substring(0, idx)}
      <mark
        className={`rounded px-0.5 font-bold ${
          isCurrent
            ? "bg-amber-400 text-slate-900 ring-2 ring-indigo-500 shadow-sm dark:bg-amber-400 dark:text-slate-950"
            : "bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100"
        }`}
      >
        {text.substring(idx, idx + q.length)}
      </mark>
      {text.substring(idx + q.length)}
    </>
  );
}

/**
 * Helper to render XML attributes with highlighting.
 */
function renderAttributes(attrs?: XmlAttribute[], query = "", isCurrentLine = false) {
  if (!attrs || attrs.length === 0) return null;
  return (
    <>
      {attrs.map((attr, i) => (
        <span key={i} className="ml-1.5 shrink-0">
          <span className="text-sky-600 dark:text-sky-400 font-medium">
            {renderHighlight(attr.name, query, isCurrentLine)}
          </span>
          <span className="text-slate-400 dark:text-slate-500">=</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {attr.quote || '"'}
            {renderHighlight(attr.value, query, isCurrentLine)}
            {attr.quote || '"'}
          </span>
        </span>
      ))}
    </>
  );
}

/**
 * Memoized Card for individual XML match results with child element preview limits.
 */
interface XmlMatchCardProps {
  match: XmlMatch;
  index: number;
  searchQuery: string;
  showLineNumbers: boolean;
  collapsedPaths: Set<string>;
  toggleFold: (path: string) => void;
  onCopyMatchText: (text: string, id: string) => void;
  isCopied: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

const XmlMatchCard: React.FC<XmlMatchCardProps> = React.memo(
  ({
    match,
    index,
    searchQuery,
    showLineNumbers,
    collapsedPaths,
    toggleFold,
    onCopyMatchText,
    isCopied,
    t,
  }) => {
    const [showAllSubLines, setShowAllSubLines] = useState(false);
    const node = match.node;

    const subLines = useMemo(() => {
      if (node.type !== "element" || node.children.length === 0) return [];
      return flattenXmlTree(node.children, collapsedPaths, 0, t);
    }, [node, collapsedPaths, t]);

    const visibleSubLines = useMemo(() => {
      return showAllSubLines ? subLines : subLines.slice(0, 30);
    }, [showAllSubLines, subLines]);

    const copyTarget = node.name ? `<${node.name}>` : node.textContent || "";
    const cardId = `${match.path}-${index}`;

    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
        {/* Card Header: Match #, Match Type, Copy Button */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 font-sans">
              #{index + 1}
            </span>
            <span className="uppercase text-[10px] font-bold text-slate-400 tracking-wider">
              {match.kind === "tag"
                ? "Tag"
                : match.kind === "attr-name"
                ? "Attribute Name"
                : match.kind === "attr-val"
                ? "Attribute Value"
                : "Text"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCopyMatchText(copyTarget, cardId)}
            title={t.common.copy}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Node Content */}
        <div>
          {node.type === "element" ? (
            <div>
              <div className="flex items-center flex-wrap">
                <span className="text-slate-400">&lt;</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {renderHighlight(node.name, searchQuery, match.kind === "tag")}
                </span>
                {renderAttributes(node.attributes, searchQuery, match.kind.startsWith("attr"))}
                <span className="text-slate-400">
                  {node.isSelfClosing ? " /&gt;" : "&gt;"}
                </span>
              </div>

              {node.textContent && (
                <div className="pl-4 my-1 text-slate-800 dark:text-slate-200">
                  {renderHighlight(node.textContent, searchQuery, match.kind === "text")}
                </div>
              )}

              {node.children.length > 0 && (
                <div className="pl-3 my-1 border-l-2 border-indigo-200 dark:border-indigo-800/80">
                  {visibleSubLines.map((subLine, subIdx) => (
                    <div
                      key={subLine.id}
                      className="flex items-center leading-5 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                    >
                      {showLineNumbers && (
                        <div className="w-8 shrink-0 pr-2 text-right text-[10px] select-none text-slate-400 dark:text-slate-600 font-mono">
                          {subIdx + 1}
                        </div>
                      )}
                      <div
                        className="flex items-center flex-1 overflow-hidden"
                        style={{
                          paddingLeft: `${subLine.depth * 1.25 + 0.5}rem`,
                        }}
                      >
                        {subLine.canFold ? (
                          <button
                            type="button"
                            onClick={() => toggleFold(subLine.path)}
                            className="w-3.5 h-3.5 mr-1 flex items-center justify-center text-slate-400 cursor-pointer"
                          >
                            {subLine.isFolded ? (
                              <ChevronRight className="w-3 h-3 text-indigo-500" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5 mr-1 shrink-0" />
                        )}
                        {subLine.tagName && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            &lt;{subLine.tagName}&gt;
                          </span>
                        )}
                        {subLine.text && (
                          <span className="text-slate-700 dark:text-slate-300 ml-1">
                            {subLine.text}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {subLines.length > 30 && !showAllSubLines && (
                    <button
                      type="button"
                      onClick={() => setShowAllSubLines(true)}
                      className="mt-1.5 text-[11px] font-sans text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      + {subLines.length - 30} lines...
                    </button>
                  )}
                </div>
              )}

              {!node.isSelfClosing && (
                <div className="text-slate-400">
                  &lt;/
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {node.name}
                  </span>
                  &gt;
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-800 dark:text-slate-200">
              {renderHighlight(node.textContent || "", searchQuery, true)}
            </div>
          )}
        </div>
      </div>
    );
  },
);

export interface XmlFoldableViewerProps {
  xmlString: string;
  defaultShowLineNumbers?: boolean;
  className?: string;
}

export const XmlFoldableViewer: React.FC<XmlFoldableViewerProps> = ({
  xmlString,
  defaultShowLineNumbers = true,
  className = "",
}) => {
  const { t } = useTranslation();
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  
  // Real-time input state for instant typing responsiveness
  const [searchInputValue, setSearchInputValue] = useState("");
  // Debounced search query
  const [searchQuery, setSearchQuery] = useState("");

  const [matchIndex, setMatchIndex] = useState(0);
  const [filterOnly, setFilterOnly] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(defaultShowLineNumbers);
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(40);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input by 280ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInputValue.trim());
      setDisplayCount(40);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInputValue]);

  const isSearching = searchInputValue.trim() !== searchQuery;

  // Parse XML tree
  const { nodes, error } = useMemo(() => {
    return parseXmlToTree(xmlString);
  }, [xmlString]);

  // Search matches (capped at 1000 for peak performance)
  const matches = useMemo(() => {
    if (!searchQuery.trim() || nodes.length === 0) return [];
    return searchXmlTree(nodes, searchQuery.trim(), [], [], 1000);
  }, [nodes, searchQuery]);

  // Set of matched paths for O(1) membership check during tree render
  const matchedPathsSet = useMemo(() => {
    return new Set(matches.map((m) => m.path));
  }, [matches]);

  // Auto-expand ancestors of matches
  useEffect(() => {
    if (matches.length > 0) {
      setCollapsedPaths((prev) => {
        let changed = false;
        const next = new Set(prev);
        matches.forEach((m) => {
          m.ancestorPaths.forEach((anc) => {
            if (next.has(anc)) {
              next.delete(anc);
              changed = true;
            }
          });
        });
        return changed ? next : prev;
      });
      setMatchIndex(0);
    } else {
      setMatchIndex(0);
    }
  }, [matches]);

  // Flatten lines based on current collapsed state
  const lines = useMemo(() => {
    if (nodes.length === 0) return [];
    return flattenXmlTree(nodes, collapsedPaths, 0, t);
  }, [nodes, collapsedPaths, t]);

  // Virtualizer for full tree rendering
  const rowVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 24,
    overscan: 25,
  });

  // Scroll active match in full tree mode via virtualizer scrollToIndex
  useEffect(() => {
    if (!filterOnly && matches.length > 0 && matches[matchIndex]) {
      const activePath = matches[matchIndex].path;
      const targetIdx = lines.findIndex((l) => l.path === activePath);
      if (targetIdx !== -1) {
        rowVirtualizer.scrollToIndex(targetIdx, { align: "center", behavior: "smooth" });
      }
    }
  }, [filterOnly, matchIndex, matches, lines, rowVirtualizer]);

  const toggleFold = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedPaths(new Set());
  };

  const handleCollapseAll = () => {
    const all = getAllCollapsibleXmlPaths(nodes);
    setCollapsedPaths(new Set(all));
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    setMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    setMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Flush debounce immediately if input is dirty
      if (searchInputValue.trim() !== searchQuery) {
        setSearchQuery(searchInputValue.trim());
        setDisplayCount(40);
        return;
      }
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === "Escape") {
      setSearchInputValue("");
      setSearchQuery("");
      setDisplayCount(40);
    }
  };

  const handleClearSearch = () => {
    setSearchInputValue("");
    setSearchQuery("");
    setDisplayCount(40);
  };

  const handleCopyTag = async (line: XmlLine) => {
    try {
      const textToCopy = line.tagName ? `<${line.tagName}>` : line.text || "";
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(line.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyMatchText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!xmlString.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-400 italic font-sans">
        {t.toolLayout.outputPlaceholder}
      </div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col p-4 font-mono text-xs text-rose-500">
        <div className="font-bold mb-2">XML Parsing Error:</div>
        <div>{error}</div>
        <div className="mt-4 font-bold text-slate-500">Raw Content:</div>
        <pre className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{xmlString}</pre>
      </div>
    );
  }

  const activeMatchedPath = matches[matchIndex]?.path;
  const isSearchActive = Boolean(searchQuery.trim());
  const visibleMatches = matches.slice(0, displayCount);

  return (
    <div className={`flex flex-col h-full w-full bg-transparent overflow-hidden ${className}`}>
      {/* Controls & Quick Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs shrink-0 select-none">
        {/* Search Box with Debounce & Spinner */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px] max-w-md">
          <div className="relative flex items-center w-full">
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 absolute left-2.5 text-indigo-500 animate-spin pointer-events-none" />
            ) : (
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t.ui.searchXmlPlaceholder}
              className="w-full pl-8 pr-16 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
            />
            {searchInputValue && (
              <div className="absolute right-1.5 flex items-center gap-1">
                {isSearching && (
                  <span className="text-[10px] text-indigo-500 font-sans hidden sm:inline mr-0.5 animate-pulse">
                    {t.ui.searching}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                  title={t.common.clear}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {isSearchActive && (
            <div className="flex items-center gap-1 shrink-0 font-sans">
              {/* Filter Mode Toggle */}
              <button
                type="button"
                onClick={() => setFilterOnly((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all cursor-pointer ${
                  filterOnly
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-700 dark:text-indigo-300 shadow-xs"
                    : "bg-white border-slate-300 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50"
                }`}
                title={filterOnly ? t.ui.showFullTree : t.ui.filterMatchesOnly}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {filterOnly ? t.ui.filterMatchesOnly : t.ui.showFullTree}
                </span>
              </button>

              {!filterOnly && (
                <>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
                    {matches.length > 0
                      ? `${matchIndex + 1}/${matches.length}`
                      : t.ui.noMatches}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matches.length <= 1}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Previous match (Shift+Enter)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matches.length <= 1}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Next match (Enter)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Buttons: Expand/Collapse, Line Numbers, View Mode */}
        <div className="flex items-center gap-1 shrink-0">
          {(!isSearchActive || !filterOnly) && (
            <>
              <button
                type="button"
                onClick={handleExpandAll}
                className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                title={t.ui.expandAll}
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">{t.ui.expandAll}</span>
              </button>

              <button
                type="button"
                onClick={handleCollapseAll}
                className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                title={t.ui.collapseAll}
              >
                <ChevronsDownUp className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">{t.ui.collapseAll}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowLineNumbers((prev) => !prev)}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              showLineNumbers
                ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title={t.ui.toggleLineNumbers}
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* View Mode */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === "tree"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              title={t.ui.treeView}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.ui.treeView}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === "raw"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              title={t.ui.rawView}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.ui.rawView}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      {viewMode === "raw" ? (
        <div className="flex-1 w-full overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 select-text">
          <pre className="whitespace-pre-wrap break-all">{xmlString}</pre>
        </div>
      ) : isSearchActive && filterOnly ? (
        /* Filtered Search Results: Shows ONLY matching XML nodes and contents */
        <div className="flex-1 w-full overflow-auto p-3 space-y-3 font-mono text-xs select-text">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] pb-1 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {t.ui.matchingResults} ({matches.length >= 1000 ? "1000+" : matches.length})
            </span>
            <span className="text-slate-400">"{searchQuery.trim()}"</span>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic font-sans text-xs">
              {t.ui.noMatches}
            </div>
          ) : (
            <>
              {visibleMatches.map((m, idx) => (
                <XmlMatchCard
                  key={`${m.path}-${idx}`}
                  match={m}
                  index={idx}
                  searchQuery={searchQuery}
                  showLineNumbers={showLineNumbers}
                  collapsedPaths={collapsedPaths}
                  toggleFold={toggleFold}
                  onCopyMatchText={handleCopyMatchText}
                  isCopied={copiedId === `${m.path}-${idx}`}
                  t={t}
                />
              ))}

              {matches.length > displayCount && (
                <div className="pt-2 pb-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setDisplayCount((prev) => prev + 40)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors shadow-xs cursor-pointer"
                  >
                    {t.ui.showMoreResults.replace(
                      "{count}",
                      String(Math.min(40, matches.length - displayCount)),
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Full Tree View: Virtualized document with line numbers, fold/unfold & highlights */
        <div
          ref={containerRef}
          className="flex-1 w-full overflow-auto py-2 font-mono text-xs leading-6 select-text"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              minWidth: "max-content",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const line = lines[virtualRow.index];
              if (!line) return null;
              const lineIndex = virtualRow.index;
              const isTargetMatch = activeMatchedPath === line.path;
              const isMatch = matchedPathsSet.has(line.path);

              return (
                <div
                  key={line.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  id={`xml-line-${line.path}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    minWidth: "max-content",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`group flex items-center hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors ${
                    isTargetMatch
                      ? "bg-amber-100/80 dark:bg-amber-950/40 ring-1 ring-amber-400/90"
                      : isMatch
                        ? "bg-amber-50/60 dark:bg-amber-950/20"
                        : ""
                  }`}
                >
                  {/* Line Number Gutter */}
                  {showLineNumbers && (
                    <div className="w-12 shrink-0 pr-3 text-right text-[11px] select-none text-slate-400 dark:text-slate-600 border-r border-slate-200/80 dark:border-slate-800/80 font-mono">
                      {lineIndex + 1}
                    </div>
                  )}

                  {/* Content: paddingLeft 1.5rem prevents chevron from being obscured by line number border */}
                  <div
                    className="flex items-center flex-1 overflow-hidden pr-2 min-w-0"
                    style={{
                      paddingLeft: `${line.depth * 1.25 + 1.5}rem`,
                    }}
                  >
                    {/* Fold toggle */}
                    {line.canFold ? (
                      <button
                        type="button"
                        onClick={() => toggleFold(line.path)}
                        className="w-4 h-4 -ml-5 mr-1 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shrink-0"
                        title={line.isFolded ? t.ui.expandAll : t.ui.collapseAll}
                      >
                        {line.isFolded ? (
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-500 font-bold" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 -ml-5 mr-1 shrink-0" />
                    )}

                    {/* Rendering based on kind */}
                    {line.kind === "declaration" && (
                      <span className="text-slate-400 dark:text-slate-500 italic">
                        {line.text}
                      </span>
                    )}

                    {line.kind === "comment" && (
                      <span className="text-slate-400 dark:text-slate-500 italic">
                        &lt;!-- {renderHighlight(line.text || "", searchQuery, isTargetMatch)} --&gt;
                      </span>
                    )}

                    {line.kind === "cdata" && (
                      <span className="text-teal-600 dark:text-teal-400">
                        &lt;![CDATA[{renderHighlight(line.text || "", searchQuery, isTargetMatch)}]]&gt;
                      </span>
                    )}

                    {line.kind === "text" && (
                      <span className="text-slate-800 dark:text-slate-200">
                        {renderHighlight(line.text || "", searchQuery, isTargetMatch)}
                      </span>
                    )}

                    {line.kind === "self-closing" && (
                      <span className="shrink-0 flex items-center flex-wrap">
                        <span className="text-slate-400 dark:text-slate-500">&lt;</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {renderHighlight(line.tagName || "", searchQuery, isTargetMatch)}
                        </span>
                        {renderAttributes(line.attributes, searchQuery, isTargetMatch)}
                        <span className="text-slate-400 dark:text-slate-500 ml-1">/&gt;</span>
                      </span>
                    )}

                    {line.kind === "inline-element" && (
                      <span className="shrink-0 flex items-center flex-wrap">
                        <span className="text-slate-400 dark:text-slate-500">&lt;</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {renderHighlight(line.tagName || "", searchQuery, isTargetMatch)}
                        </span>
                        {renderAttributes(line.attributes, searchQuery, isTargetMatch)}
                        <span className="text-slate-400 dark:text-slate-500">&gt;</span>
                        <span className="text-slate-800 dark:text-slate-200 px-0.5">
                          {renderHighlight(line.text || "", searchQuery, isTargetMatch)}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">
                          &lt;/
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            {line.tagName}
                          </span>
                          &gt;
                        </span>
                      </span>
                    )}

                    {line.kind === "open-tag" && (
                      <span className="shrink-0 flex items-center flex-wrap">
                        <span className="text-slate-400 dark:text-slate-500">&lt;</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {renderHighlight(line.tagName || "", searchQuery, isTargetMatch)}
                        </span>
                        {renderAttributes(line.attributes, searchQuery, isTargetMatch)}
                        <span className="text-slate-400 dark:text-slate-500">&gt;</span>
                      </span>
                    )}

                    {line.kind === "folded-element" && (
                      <span className="shrink-0 flex items-center gap-1 flex-wrap">
                        <span className="text-slate-400 dark:text-slate-500">&lt;</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {renderHighlight(line.tagName || "", searchQuery, isTargetMatch)}
                        </span>
                        {renderAttributes(line.attributes, searchQuery, isTargetMatch)}
                        <span className="text-slate-400 dark:text-slate-500">&gt;</span>

                        <button
                          type="button"
                          onClick={() => toggleFold(line.path)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-sans font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 transition-colors cursor-pointer select-none"
                        >
                          <span>{line.text}</span>
                        </button>

                        <span className="text-slate-400 dark:text-slate-500">
                          &lt;/
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            {line.tagName}
                          </span>
                          &gt;
                        </span>
                      </span>
                    )}

                    {line.kind === "close-tag" && (
                      <span className="shrink-0 text-slate-400 dark:text-slate-500">
                        &lt;/
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {line.tagName}
                        </span>
                        &gt;
                      </span>
                    )}

                    {/* Copy Action on hover */}
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1 pl-2 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyTag(line)}
                        title={t.common.copy}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedId === line.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
