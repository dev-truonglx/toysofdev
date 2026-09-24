export type TargetLanguage =
  | "typescript-interface"
  | "typescript-type"
  | "golang"
  | "python-pydantic"
  | "python-dataclass"
  | "rust-serde"
  | "java-record"
  | "csharp-record";

export interface JsonToCodeOptions {
  rootName: string;
  language: TargetLanguage;
  optionalFields: boolean;
  separateNested: boolean;
}

function toPascalCase(str: string): string {
  if (!str) return "Item";
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, (chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
}

function sanitizeIdentifier(name: string, lang: TargetLanguage): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return name;
  }
  if (lang.startsWith("typescript")) {
    return JSON.stringify(name);
  }
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

type InferredType =
  | { kind: "primitive"; typeName: string }
  | { kind: "array"; element: InferredType }
  | { kind: "object"; name: string; fields: Record<string, InferredType> }
  | { kind: "union"; types: InferredType[] }
  | { kind: "null" }
  | { kind: "unknown" };

function inferType(value: unknown, nameHint: string): InferredType {
  if (value === null) {
    return { kind: "null" };
  }
  if (value === undefined) {
    return { kind: "unknown" };
  }
  if (typeof value === "string") {
    return { kind: "primitive", typeName: "string" };
  }
  if (typeof value === "number") {
    return { kind: "primitive", typeName: Number.isInteger(value) ? "integer" : "number" };
  }
  if (typeof value === "boolean") {
    return { kind: "primitive", typeName: "boolean" };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: "array", element: { kind: "unknown" } };
    }
    const elementTypes = value.map((item) => inferType(item, `${nameHint}Item`));
    // Simplify array of objects or primitives
    const firstType = elementTypes[0];
    return { kind: "array", element: firstType };
  }
  if (typeof value === "object") {
    const fields: Record<string, InferredType> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = inferType(v, toPascalCase(k));
    }
    return { kind: "object", name: toPascalCase(nameHint), fields };
  }
  return { kind: "unknown" };
}

export function generateCodeFromJson(jsonInput: string, options: JsonToCodeOptions): string {
  const trimmed = jsonInput.trim();
  if (!trimmed) return "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`);
  }

  const rootName = toPascalCase(options.rootName.trim() || "Root");
  const inferred = inferType(parsed, rootName);

  switch (options.language) {
    case "typescript-interface":
      return generateTypeScript(inferred, rootName, "interface", options);
    case "typescript-type":
      return generateTypeScript(inferred, rootName, "type", options);
    case "golang":
      return generateGolang(inferred, rootName, options);
    case "python-pydantic":
      return generatePythonPydantic(inferred, rootName, options);
    case "python-dataclass":
      return generatePythonDataclass(inferred, rootName, options);
    case "rust-serde":
      return generateRust(inferred, rootName, options);
    case "java-record":
      return generateJavaRecord(inferred, rootName, options);
    case "csharp-record":
      return generateCSharp(inferred, rootName, options);
    default:
      return generateTypeScript(inferred, rootName, "interface", options);
  }
}

// ---------------- TypeScript ----------------
function generateTypeScript(
  type: InferredType,
  name: string,
  kind: "interface" | "type",
  options: JsonToCodeOptions
): string {
  const definitions: { name: string; code: string }[] = [];

  function formatType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        return t.typeName === "integer" ? "number" : t.typeName;
      case "null":
        return "null";
      case "unknown":
        return "unknown";
      case "array":
        return `${formatType(t.element, `${currentName}Item`)}[]`;
      case "union":
        return t.types.map((sub) => formatType(sub, currentName)).join(" | ");
      case "object": {
        const typeName = toPascalCase(currentName);
        if (options.separateNested) {
          const body = Object.entries(t.fields)
            .map(([k, v]) => {
              const opt = options.optionalFields || v.kind === "null" || v.kind === "unknown" ? "?" : "";
              const valType = formatType(v, `${typeName}_${toPascalCase(k)}`);
              return `  ${sanitizeIdentifier(k, "typescript-interface")}${opt}: ${valType};`;
            })
            .join("\n");

          const def =
            kind === "interface"
              ? `export interface ${typeName} {\n${body}\n}`
              : `export type ${typeName} = {\n${body}\n};`;

          if (!definitions.some((d) => d.name === typeName)) {
            definitions.push({ name: typeName, code: def });
          }
          return typeName;
        } else {
          const fieldsStr = Object.entries(t.fields)
            .map(([k, v]) => {
              const opt = options.optionalFields || v.kind === "null" || v.kind === "unknown" ? "?" : "";
              return `  ${sanitizeIdentifier(k, "typescript-interface")}${opt}: ${formatType(v, k)};`;
            })
            .join("\n");
          return `{\n${fieldsStr}\n}`;
        }
      }
    }
  }

  if (type.kind === "object") {
    formatType(type, name);
    return definitions.reverse().map((d) => d.code).join("\n\n");
  } else if (type.kind === "array") {
    const elemType = formatType(type.element, `${name}Item`);
    const rootDef = `export type ${name} = ${elemType}[];`;
    const subDefs = definitions.reverse().map((d) => d.code).join("\n\n");
    return subDefs ? `${subDefs}\n\n${rootDef}` : rootDef;
  } else {
    return `export type ${name} = ${formatType(type, name)};`;
  }
}

// ---------------- Golang ----------------
function generateGolang(type: InferredType, name: string, options: JsonToCodeOptions): string {
  const structs: { name: string; code: string }[] = [];

  function formatGoType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        if (t.typeName === "integer") return "int64";
        if (t.typeName === "number") return "float64";
        if (t.typeName === "boolean") return "bool";
        return "string";
      case "null":
        return "any";
      case "unknown":
        return "any";
      case "array":
        return `[]${formatGoType(t.element, `${currentName}Item`)}`;
      case "union":
        return "any";
      case "object": {
        const structName = toPascalCase(currentName);
        const fields = Object.entries(t.fields)
          .map(([k, v]) => {
            const fieldName = toPascalCase(k);
            const fieldType = formatGoType(v, `${structName}${toPascalCase(k)}`);
            const omitempty = options.optionalFields ? ",omitempty" : "";
            return `\t${fieldName} ${fieldType} \`json:"${k}${omitempty}"\``;
          })
          .join("\n");

        const code = `type ${structName} struct {\n${fields}\n}`;
        if (!structs.some((s) => s.name === structName)) {
          structs.push({ name: structName, code });
        }
        return structName;
      }
    }
  }

  if (type.kind === "object") {
    formatGoType(type, name);
    return structs.reverse().map((s) => s.code).join("\n\n");
  } else if (type.kind === "array") {
    const elemType = formatGoType(type.element, `${name}Item`);
    const rootDef = `type ${name} []${elemType}`;
    const subDefs = structs.reverse().map((s) => s.code).join("\n\n");
    return subDefs ? `${subDefs}\n\n${rootDef}` : rootDef;
  } else {
    return `type ${name} ${formatGoType(type, name)}`;
  }
}

// ---------------- Python Pydantic ----------------
function generatePythonPydantic(type: InferredType, name: string, options: JsonToCodeOptions): string {
  const models: { name: string; code: string }[] = [];
  let needsField = false;
  let needsOptional = false;

  function formatPythonType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        if (t.typeName === "integer") return "int";
        if (t.typeName === "number") return "float";
        if (t.typeName === "boolean") return "bool";
        return "str";
      case "null":
        needsOptional = true;
        return "Optional[Any]";
      case "unknown":
        return "Any";
      case "array":
        return `list[${formatPythonType(t.element, `${currentName}Item`)}]`;
      case "union":
        return "Any";
      case "object": {
        const modelName = toPascalCase(currentName);
        const fields = Object.entries(t.fields)
          .map(([k, v]) => {
            const pyName = toSnakeCase(k);
            let pyType = formatPythonType(v, `${modelName}${toPascalCase(k)}`);
            if (options.optionalFields && !pyType.startsWith("Optional")) {
              needsOptional = true;
              pyType = `Optional[${pyType}] = None`;
            }
            if (pyName !== k) {
              needsField = true;
              return `    ${pyName}: ${pyType} = Field(alias="${k}")`;
            }
            return `    ${pyName}: ${pyType}`;
          })
          .join("\n");

        const code = `class ${modelName}(BaseModel):\n${fields || "    pass"}`;
        if (!models.some((m) => m.name === modelName)) {
          models.push({ name: modelName, code });
        }
        return modelName;
      }
    }
  }

  formatPythonType(type, name);

  const imports = ["from pydantic import BaseModel" + (needsField ? ", Field" : "")];
  if (needsOptional) {
    imports.push("from typing import Optional, Any");
  } else {
    imports.push("from typing import Any");
  }

  const header = imports.join("\n");
  const body = models.reverse().map((m) => m.code).join("\n\n");
  return `${header}\n\n\n${body}`;
}

// ---------------- Python Dataclass ----------------
function generatePythonDataclass(type: InferredType, name: string, options: JsonToCodeOptions): string {
  const models: { name: string; code: string }[] = [];

  function formatPyType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        if (t.typeName === "integer") return "int";
        if (t.typeName === "number") return "float";
        if (t.typeName === "boolean") return "bool";
        return "str";
      case "null":
        return "Optional[Any] = None";
      case "unknown":
        return "Any";
      case "array":
        return `list[${formatPyType(t.element, `${currentName}Item`)}]`;
      case "union":
        return "Any";
      case "object": {
        const modelName = toPascalCase(currentName);
        const fields = Object.entries(t.fields)
          .map(([k, v]) => {
            const pyName = toSnakeCase(k);
            let pyType = formatPyType(v, `${modelName}${toPascalCase(k)}`);
            if (options.optionalFields && !pyType.includes("=")) {
              pyType = `Optional[${pyType}] = None`;
            }
            return `    ${pyName}: ${pyType}`;
          })
          .join("\n");

        const code = `@dataclass\nclass ${modelName}:\n${fields || "    pass"}`;
        if (!models.some((m) => m.name === modelName)) {
          models.push({ name: modelName, code });
        }
        return modelName;
      }
    }
  }

  formatPyType(type, name);

  const header = "from dataclasses import dataclass\nfrom typing import Optional, Any";
  const body = models.reverse().map((m) => m.code).join("\n\n");
  return `${header}\n\n\n${body}`;
}

// ---------------- Rust Serde ----------------
function generateRust(type: InferredType, name: string, options: JsonToCodeOptions): string {
  const structs: { name: string; code: string }[] = [];

  function formatRustType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        if (t.typeName === "integer") return "i64";
        if (t.typeName === "number") return "f64";
        if (t.typeName === "boolean") return "bool";
        return "String";
      case "null":
        return "Option<serde_json::Value>";
      case "unknown":
        return "serde_json::Value";
      case "array":
        return `Vec<${formatRustType(t.element, `${currentName}Item`)}>`;
      case "union":
        return "serde_json::Value";
      case "object": {
        const structName = toPascalCase(currentName);
        const fields = Object.entries(t.fields)
          .map(([k, v]) => {
            const rustName = toSnakeCase(k);
            let rustType = formatRustType(v, `${structName}${toPascalCase(k)}`);
            if (options.optionalFields && !rustType.startsWith("Option<")) {
              rustType = `Option<${rustType}>`;
            }
            let attr = "";
            if (rustName !== k) {
              attr = `    #[serde(rename = "${k}")]\n`;
            }
            return `${attr}    pub ${rustName}: ${rustType},`;
          })
          .join("\n");

        const code = `#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct ${structName} {\n${fields}\n}`;
        if (!structs.some((s) => s.name === structName)) {
          structs.push({ name: structName, code });
        }
        return structName;
      }
    }
  }

  formatRustType(type, name);

  const header = "use serde::{Deserialize, Serialize};";
  const body = structs.reverse().map((s) => s.code).join("\n\n");
  return `${header}\n\n${body}`;
}

// ---------------- Java Record ----------------
function generateJavaRecord(type: InferredType, name: string, _options: JsonToCodeOptions): string {
  const records: { name: string; code: string }[] = [];

  function formatJavaType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        if (t.typeName === "integer") return "long";
        if (t.typeName === "number") return "double";
        if (t.typeName === "boolean") return "boolean";
        return "String";
      case "null":
        return "Object";
      case "unknown":
        return "Object";
      case "array":
        return `List<${formatJavaType(t.element, `${currentName}Item`)}>`;
      case "union":
        return "Object";
      case "object": {
        const recordName = toPascalCase(currentName);
        const fields = Object.entries(t.fields)
          .map(([k, v]) => {
            const paramName = toCamelCase(k);
            const paramType = formatJavaType(v, `${recordName}${toPascalCase(k)}`);
            const annot = paramName !== k ? `@JsonProperty("${k}") ` : "";
            return `    ${annot}${paramType} ${paramName}`;
          })
          .join(",\n");

        const code = `public record ${recordName}(\n${fields}\n) {}`;
        if (!records.some((r) => r.name === recordName)) {
          records.push({ name: recordName, code });
        }
        return recordName;
      }
    }
  }

  formatJavaType(type, name);

  const header = "import com.fasterxml.jackson.annotation.JsonProperty;\nimport java.util.List;";
  const body = records.reverse().map((r) => r.code).join("\n\n");
  return `${header}\n\n${body}`;
}

// ---------------- C# Record ----------------
function generateCSharp(type: InferredType, name: string, options: JsonToCodeOptions): string {
  const records: { name: string; code: string }[] = [];

  function formatCSharpType(t: InferredType, currentName: string): string {
    switch (t.kind) {
      case "primitive":
        if (t.typeName === "integer") return "long";
        if (t.typeName === "number") return "double";
        if (t.typeName === "boolean") return "bool";
        return "string";
      case "null":
        return "object?";
      case "unknown":
        return "object?";
      case "array":
        return `List<${formatCSharpType(t.element, `${currentName}Item`)}>`;
      case "union":
        return "object?";
      case "object": {
        const recordName = toPascalCase(currentName);
        const fields = Object.entries(t.fields)
          .map(([k, v]) => {
            const propName = toPascalCase(k);
            let propType = formatCSharpType(v, `${recordName}${toPascalCase(k)}`);
            if (options.optionalFields && !propType.endsWith("?")) {
              propType += "?";
            }
            return `    [JsonPropertyName("${k}")]\n    public ${propType} ${propName} { get; init; }`;
          })
          .join("\n\n");

        const code = `public record ${recordName}\n{\n${fields}\n}`;
        if (!records.some((r) => r.name === recordName)) {
          records.push({ name: recordName, code });
        }
        return recordName;
      }
    }
  }

  formatCSharpType(type, name);

  const header = "using System.Text.Json.Serialization;\nusing System.Collections.Generic;";
  const body = records.reverse().map((r) => r.code).join("\n\n");
  return `${header}\n\n${body}`;
}
