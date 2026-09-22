import React from "react";
import { LucideIcon } from "lucide-react";

export type ToolCategory =
  | "converters"
  | "encoders-decoders"
  | "formatters"
  | "generators"
  | "text"
  | "graphic";

export interface CategoryDefinition {
  id: ToolCategory;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  icon: LucideIcon;
  keywords: string[];
  component: React.ComponentType;
}
