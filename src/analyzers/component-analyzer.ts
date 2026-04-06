import * as fs from "fs";
import type { ComponentFiles } from "./file-scanner";
import type {
  ComponentMetadata,
  PropDefinition,
  ScanError,
} from "../types/component";

export class ComponentAnalyzer {
  async analyze(files: ComponentFiles): Promise<ComponentMetadata> {
    const source = fs.readFileSync(files.mainFile, "utf-8");

    return {
      name: files.name,
      filePath: files.mainFile,
      directory: files.directory,

      hasSpec: !!files.specFile,
      hasStories: !!files.storiesFile,
      hasIndex: !!files.indexFile,

      exports: this.extractExports(files.indexFile),
      props: this.extractProps(source, files.name),

      usesTokens: this.detectTokenUsage(source),
      tokenUsage: this.extractTokenNames(source),

      extendsResponsiveCSSProps: this.detectResponsiveCSSProps(source),
      usesStyledComponents: this.detectStyledComponents(source),

      hasAriaProps: this.detectAriaProps(source),
      hasFocusVisible: this.detectFocusVisible(source),
      semanticHTML: this.detectSemanticHTML(source),
      hasKeyboardSupport: this.detectKeyboardSupport(source),
      hardcodedColors: this.detectHardcodedColors(source),
      storyTitle: this.extractStoryTitle(files.storiesFile),
    };
  }

  // --- Props extraction: regex first, graceful degradation if it fails ---

  private extractProps(
    source: string,
    componentName: string,
  ): PropDefinition[] {
    try {
      return this.extractPropsViaRegex(source, componentName);
    } catch {
      return [];
    }
  }

  private extractPropsViaRegex(
    source: string,
    componentName: string,
  ): PropDefinition[] {
    // Match interface XProps or type XProps = { ... }
    const interfacePattern = new RegExp(
      `(?:interface|type)\\s+${componentName}Props[^{]*\\{([^}]+)\\}`,
      "s",
    );
    const match = source.match(interfacePattern);

    if (!match) {
      // Try generic Props interface as fallback
      const genericMatch = source.match(
        /(?:interface|type)\s+\w+Props[^{]*\{([^}]+)\}/s,
      );
      if (!genericMatch) return [];
      return this.parsePropsBlock(genericMatch[1]);
    }

    return this.parsePropsBlock(match[1]);
  }

  private parsePropsBlock(block: string): PropDefinition[] {
    const props: PropDefinition[] = [];
    const lines = block.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*"))
        continue;

      // Match: propName?: type or propName: type
      const propMatch = trimmed.match(/^(\w+)(\??):\s*(.+?)(?:;|,)?$/);
      if (propMatch) {
        props.push({
          name: propMatch[1],
          type: propMatch[3].trim(),
          required: propMatch[2] !== "?",
        });
      }
    }

    return props;
  }

  // --- Exports ---

  private extractExports(indexFile?: string): ComponentMetadata["exports"] {
    if (!indexFile || !fs.existsSync(indexFile)) {
      return { default: false, named: [], types: [] };
    }

    const source = fs.readFileSync(indexFile, "utf-8");
    const hasDefault = /export\s+default/.test(source);

    const namedMatches = source.matchAll(/export\s+\{\s*([^}]+)\s*\}/g);
    const named: string[] = [];
    const types: string[] = [];

    for (const match of namedMatches) {
      const items = match[1].split(",").map((s) => s.trim());
      for (const item of items) {
        if (item.startsWith("type ")) {
          types.push(item.replace("type ", "").trim());
        } else if (item) {
          named.push(item);
        }
      }
    }

    return { default: hasDefault, named, types };
  }

  // --- Pattern detection ---

  private detectTokenUsage(source: string): boolean {
    return /theme\.(tokens|colors|space|text|fonts)/.test(source);
  }

  private extractTokenNames(source: string): string[] {
    const matches = source.matchAll(/tokens\.(\w+)/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }

  private detectResponsiveCSSProps(source: string): boolean {
    return /ResponsiveCSSProps/.test(source);
  }

  private detectStyledComponents(source: string): boolean {
    return /styled\.|createGlobalStyle|css`/.test(source);
  }

  private detectAriaProps(source: string): boolean {
    return /aria-\w+|role=/.test(source);
  }

  private detectFocusVisible(source: string): boolean {
    return /focus-visible/.test(source);
  }

  private detectKeyboardSupport(source: string): boolean {
    return /onKeyDown|onKeyUp|onKeyPress/.test(source);
  }

  /** Reads the stories file and extracts the Storybook title e.g. "Patterns/Accordion" */
  private extractStoryTitle(storiesFile?: string): string | undefined {
    if (!storiesFile || !fs.existsSync(storiesFile)) return undefined;
    const source = fs.readFileSync(storiesFile, "utf-8");
    const match = source.match(/title:\s*['"]([^'"]+)['"]/);
    return match?.[1];
  }

  /**
   * Detects hardcoded color values in CSS property assignments inside
   * styled-components template literals. Catches hex (#fff, #ffffff),
   * rgb(), and rgba() values that should be design tokens instead.
   */
  private detectHardcodedColors(source: string): string[] {
    const violations = new Set<string>();

    // CSS properties that take color values
    const colorProps =
      "color|background(?:-color)?|background|border(?:-color)?|border|fill|stroke|outline(?:-color)?|box-shadow|text-shadow";

    // Hex colors: #rgb, #rrggbb, #rrggbbaa
    const hexPattern = new RegExp(
      `(?:${colorProps})\\s*:\\s*(#[0-9A-Fa-f]{3,8})\\b`,
      "gi",
    );
    for (const match of source.matchAll(hexPattern)) {
      violations.add(match[1].toLowerCase());
    }

    // rgb() and rgba() colors
    const rgbPattern = new RegExp(
      `(?:${colorProps})\\s*:\\s*(rgba?\\([^)]+\\))`,
      "gi",
    );
    for (const match of source.matchAll(rgbPattern)) {
      violations.add(match[1]);
    }

    return Array.from(violations);
  }

  private detectSemanticHTML(source: string): boolean {
    const semanticElements = [
      "button",
      "nav",
      "main",
      "header",
      "footer",
      "section",
      "article",
      "aside",
      "h[1-6]",
      "label",
      "input",
      "select",
      "textarea",
    ];
    return semanticElements.some((el) =>
      new RegExp(`<${el}[\\s>/]`).test(source),
    );
  }
}

export function isUnanalyzable(metadata: ComponentMetadata): boolean {
  return metadata.props.length === 0 && !metadata.usesStyledComponents;
}

export async function analyzeComponents(
  componentFiles: ComponentFiles[],
): Promise<{ components: ComponentMetadata[]; errors: ScanError[] }> {
  const analyzer = new ComponentAnalyzer();
  const components: ComponentMetadata[] = [];
  const errors: ScanError[] = [];

  for (const files of componentFiles) {
    try {
      const metadata = await analyzer.analyze(files);
      components.push(metadata);
    } catch (error) {
      errors.push({
        componentName: files.name,
        filePath: files.mainFile,
        error: error instanceof Error ? error.message : String(error),
        severity: "warning",
      });
    }
  }

  return { components, errors };
}
