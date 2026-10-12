import { describe, it, expect } from "vitest";
import {
  flattenJson,
  getAllCollapsiblePaths,
  searchKeysInJson,
} from "../../../components/common/JsonFoldableViewer";

describe("JsonFoldableViewer Logic", () => {
  const sampleJson = {
    name: "DevToys",
    version: 1,
    active: true,
    tags: ["developer", "offline", "tool"],
    config: {
      theme: "dark",
      editor: {
        fontSize: 14,
        lineNumbers: true,
      },
    },
    emptyList: [],
    emptyObj: {},
    nullVal: null,
  };

  it("flattens JSON into visible lines when fully expanded", () => {
    const collapsed = new Set<string>();
    const lines = flattenJson(sampleJson, collapsed);

    expect(lines.length).toBeGreaterThan(0);
    // Root opening line {
    expect(lines[0].prefix).toBe("{");
    expect(lines[0].canFold).toBe(true);
    expect(lines[0].isFolded).toBe(false);

    // Root closing line }
    expect(lines[lines.length - 1].prefix).toBe("}");
    expect(lines[lines.length - 1].isClosingBracket).toBe(true);

    // Check key presence
    const keysInLines = lines.map((l) => l.key).filter(Boolean);
    expect(keysInLines).toContain("name");
    expect(keysInLines).toContain("version");
    expect(keysInLines).toContain("tags");
    expect(keysInLines).toContain("config");
    expect(keysInLines).toContain("fontSize");
  });

  it("identifies all collapsible object and array paths", () => {
    const paths = getAllCollapsiblePaths(sampleJson);
    expect(paths).toContain("$");
    expect(paths).toContain("$.tags");
    expect(paths).toContain("$.config");
    expect(paths).toContain("$.config.editor");
  });

  it("collapses an array and reduces line count while showing item summary", () => {
    const fullyExpanded = flattenJson(sampleJson, new Set());

    // Collapse $.tags
    const collapsed = new Set(["$.tags"]);
    const withCollapsedTags = flattenJson(sampleJson, collapsed);

    expect(withCollapsedTags.length).toBeLessThan(fullyExpanded.length);

    const tagsLine = withCollapsedTags.find((l) => l.path === "$.tags");
    expect(tagsLine).toBeDefined();
    expect(tagsLine?.isFolded).toBe(true);
    expect(tagsLine?.collapsedSummary).toBe("[ 3 items ]");
  });

  it("collapses a nested object and replaces children with key count summary", () => {
    const collapsed = new Set(["$.config.editor"]);
    const lines = flattenJson(sampleJson, collapsed);

    const editorLine = lines.find((l) => l.path === "$.config.editor");
    expect(editorLine).toBeDefined();
    expect(editorLine?.isFolded).toBe(true);
    expect(editorLine?.collapsedSummary).toBe("{ 2 keys }");

    // Children of editor should not appear in visible lines
    expect(lines.find((l) => l.key === "fontSize")).toBeUndefined();
    expect(lines.find((l) => l.key === "lineNumbers")).toBeUndefined();
  });

  it("collapses root object down to a single line", () => {
    const collapsed = new Set(["$"]);
    const lines = flattenJson(sampleJson, collapsed);

    expect(lines.length).toBe(1);
    expect(lines[0].isFolded).toBe(true);
    expect(lines[0].collapsedSummary).toContain("keys");
  });

  describe("Quick Key Search in JSON", () => {
    it("searches and finds exact and partial key matches", () => {
      const matches = searchKeysInJson(sampleJson, "font");
      expect(matches.length).toBe(1);
      expect(matches[0].key).toBe("fontSize");
      expect(matches[0].value).toBe(14);
      expect(matches[0].path).toBe("$.config.editor.fontSize");
      expect(matches[0].ancestorPaths).toContain("$");
      expect(matches[0].ancestorPaths).toContain("$.config");
      expect(matches[0].ancestorPaths).toContain("$.config.editor");
    });

    it("is case-insensitive when searching keys", () => {
      const matches = searchKeysInJson(sampleJson, "THEME");
      expect(matches.length).toBe(1);
      expect(matches[0].key).toBe("theme");
      expect(matches[0].path).toBe("$.config.theme");
    });

    it("finds multiple matching keys across different depths", () => {
      const data = {
        id: 1,
        title: "Test",
        items: [
          { id: 101, name: "Sub 1" },
          { id: 102, name: "Sub 2" },
        ],
        meta: { id: "meta-99" },
      };

      const matches = searchKeysInJson(data, "id");
      expect(matches.length).toBe(4);
      expect(matches.map((m) => m.path)).toEqual([
        "$.id",
        "$.items[0].id",
        "$.items[1].id",
        "$.meta.id",
      ]);
    });

    it("returns empty array when no keys match", () => {
      const matches = searchKeysInJson(sampleJson, "nonexistentKey123");
      expect(matches.length).toBe(0);
    });

    it("ensures ancestors of matching keys can be uncollapsed to expose matches", () => {
      // Start with everything collapsed
      const allPaths = getAllCollapsiblePaths(sampleJson);
      const collapsed = new Set(allPaths);

      // Search for fontSize
      const matches = searchKeysInJson(sampleJson, "fontSize");
      expect(matches.length).toBe(1);

      // Unfold required ancestors
      matches[0].ancestorPaths.forEach((p) => collapsed.delete(p));

      // Flatten
      const lines = flattenJson(sampleJson, collapsed);
      const targetLine = lines.find((l) => l.key === "fontSize");
      expect(targetLine).toBeDefined();
    });

    it("respects maxMatches limit to prevent freezing on large collections", () => {
      const largeArray = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      const matches = searchKeysInJson(largeArray, "id", "$", [], [], 10);
      expect(matches.length).toBe(10);
    });
  });

  describe("Empty structures & Primitives", () => {
    it("handles empty objects and arrays gracefully", () => {
      const linesObj = flattenJson({}, new Set());
      expect(linesObj.length).toBe(1);
      expect(linesObj[0].prefix).toBe("{}");

      const linesArr = flattenJson([], new Set());
      expect(linesArr.length).toBe(1);
      expect(linesArr[0].prefix).toBe("[]");
    });

    it("handles primitive root values", () => {
      const linesStr = flattenJson("hello world", new Set());
      expect(linesStr.length).toBe(1);
      expect(linesStr[0].primitiveValue).toBe("hello world");

      const linesNum = flattenJson(42, new Set());
      expect(linesNum.length).toBe(1);
      expect(linesNum[0].primitiveValue).toBe(42);

      const linesNull = flattenJson(null, new Set());
      expect(linesNull.length).toBe(1);
      expect(linesNull[0].valueType).toBe("null");
    });
  });
});
