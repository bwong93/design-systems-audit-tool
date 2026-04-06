export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface ComponentMetadata {
  name: string;
  filePath: string;
  directory: string;

  // File existence checks
  hasSpec: boolean;
  hasStories: boolean;
  hasIndex: boolean;

  // Exports analysis
  exports: {
    default: boolean;
    named: string[];
    types: string[];
  };

  // Props analysis
  props: PropDefinition[];

  // Token usage
  usesTokens: boolean;
  tokenUsage: string[];

  // Patterns
  extendsResponsiveCSSProps: boolean;
  usesStyledComponents: boolean;

  // Accessibility
  hasAriaProps: boolean;
  hasFocusVisible: boolean;
  semanticHTML: boolean;
  hasKeyboardSupport: boolean;

  // Token usage
  hardcodedColors: string[];

  // Coverage metrics
  testCoverage?: number;
  storyCount?: number;
}

export interface ScanResult {
  timestamp: string;
  totalComponents: number;
  components: ComponentMetadata[];
  errors: ScanError[];
}

export interface ScanError {
  componentName?: string;
  filePath: string;
  error: string;
  severity: "error" | "warning";
}
