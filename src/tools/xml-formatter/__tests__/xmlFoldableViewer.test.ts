import { describe, it, expect } from "vitest";
import {
  parseXmlToTree,
  getAllCollapsibleXmlPaths,
  flattenXmlTree,
  searchXmlTree,
} from "../../../components/common/XmlFoldableViewer";

describe("XmlFoldableViewer Logic", () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog name="main">
  <!-- bookstore catalog -->
  <book id="bk101" price="44.95">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
  </book>
  <book id="bk102" price="5.95">
    <author>Ralls, Kim</author>
    <title>Midnight Rain</title>
  </book>
  <meta status="active" />
</catalog>`;

  it("parses XML string into a hierarchical node tree", () => {
    const { nodes, error } = parseXmlToTree(sampleXml);
    expect(error).toBeUndefined();
    expect(nodes.length).toBeGreaterThan(0);

    const catalogNode = nodes.find((n) => n.name === "catalog");
    expect(catalogNode).toBeDefined();
    expect(catalogNode?.attributes.find((a) => a.name === "name")?.value).toBe("main");
    expect(catalogNode?.children.length).toBeGreaterThan(0);
  });

  it("identifies all collapsible element paths in the XML tree", () => {
    const { nodes } = parseXmlToTree(sampleXml);
    const collapsiblePaths = getAllCollapsibleXmlPaths(nodes);

    expect(collapsiblePaths.length).toBeGreaterThan(0);
  });

  it("flattens XML tree into visible lines when fully expanded", () => {
    const { nodes } = parseXmlToTree(sampleXml);
    const lines = flattenXmlTree(nodes, new Set());

    expect(lines.length).toBeGreaterThan(0);
    const tagNames = lines.map((l) => l.tagName).filter(Boolean);
    expect(tagNames).toContain("catalog");
    expect(tagNames).toContain("book");
  });

  it("collapses an element and replaces its children with a summary pill", () => {
    const { nodes } = parseXmlToTree(sampleXml);
    const catalogNode = nodes.find((n) => n.name === "catalog");
    expect(catalogNode).toBeDefined();

    const fullyExpanded = flattenXmlTree(nodes, new Set());

    // Collapse catalog node
    const collapsed = new Set([catalogNode!.id]);
    const withCollapsed = flattenXmlTree(nodes, collapsed);

    expect(withCollapsed.length).toBeLessThan(fullyExpanded.length);
    const collapsedLine = withCollapsed.find((l) => l.path === catalogNode!.id);
    expect(collapsedLine?.isFolded).toBe(true);
    expect(collapsedLine?.kind).toBe("folded-element");
    expect(collapsedLine?.text).toContain("nodes");
  });

  describe("XML Search for Tags, Attributes, and Text", () => {
    it("searches and finds tag name matches", () => {
      const { nodes } = parseXmlToTree(sampleXml);
      const matches = searchXmlTree(nodes, "book");

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.kind === "tag" && m.target === "book")).toBe(true);
      expect(matches[0].node).toBeDefined();
    });

    it("searches and finds attribute name and value matches", () => {
      const { nodes } = parseXmlToTree(sampleXml);
      const nameMatches = searchXmlTree(nodes, "price");
      expect(nameMatches.some((m) => m.kind === "attr-name" && m.target === "price")).toBe(true);

      const valMatches = searchXmlTree(nodes, "bk101");
      expect(valMatches.some((m) => m.kind === "attr-val" && m.target === "bk101")).toBe(true);
    });

    it("searches and finds text content matches", () => {
      const { nodes } = parseXmlToTree(sampleXml);
      const textMatches = searchXmlTree(nodes, "Midnight");
      expect(textMatches.some((m) => m.kind === "text" && m.target.includes("Midnight"))).toBe(true);
    });

    it("returns empty array when nothing matches", () => {
      const { nodes } = parseXmlToTree(sampleXml);
      const matches = searchXmlTree(nodes, "nonexistentXmlQuery999");
      expect(matches.length).toBe(0);
    });

    it("respects maxMatches limit in XML search", () => {
      const { nodes } = parseXmlToTree(sampleXml);
      // "book" matches both the tag and attributes or titles
      const matches = searchXmlTree(nodes, "book", [], [], 1);
      expect(matches.length).toBe(1);
    });
  });

  describe("Comments, CDATA & Self-Closing Tags", () => {
    it("correctly parses and renders self-closing tags", () => {
      const xml = `<root><item id="1" /><item id="2" /></root>`;
      const { nodes } = parseXmlToTree(xml);
      const lines = flattenXmlTree(nodes, new Set());

      const selfClosingLines = lines.filter((l) => l.kind === "self-closing");
      expect(selfClosingLines.length).toBe(2);
      expect(selfClosingLines[0].tagName).toBe("item");
    });

    it("correctly handles CDATA sections", () => {
      const xml = `<root><![CDATA[Some <escaped> content]]></root>`;
      const { nodes } = parseXmlToTree(xml);
      const lines = flattenXmlTree(nodes, new Set());

      expect(lines.some((l) => l.kind === "cdata")).toBe(true);
    });
  });
});
