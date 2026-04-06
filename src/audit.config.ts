export const auditConfig = {
  nucleus: {
    rootPath:
      import.meta.env.VITE_NUCLEUS_ROOT_PATH || "/Users/bentley/Dev/nucleus",
    componentPaths: ["src/components", "src/patterns"],
    tokenPath: "src/theme",
    excludePaths: ["node_modules", "dist", "test/coverage", ".storybook"],
    /** GitHub repo URL — used to generate source file links */
    githubUrl: "https://github.com/meetearnest/nucleus",
    /** Branch to link to on GitHub */
    githubBranch: "main",
    /** Storybook base URL — runs locally via `yarn storybook` in Nucleus */
    storybookUrl: import.meta.env.VITE_STORYBOOK_URL || "http://localhost:6006",
  },
  figma: {
    fileKey: import.meta.env.VITE_FIGMA_FILE_KEY || "",
    accessToken: import.meta.env.VITE_FIGMA_PERSONAL_ACCESS_TOKEN || "",
    cacheDuration: 60 * 60 * 1000, // 1 hour in milliseconds
    /**
     * Figma variant properties to exclude from code comparison.
     * "state" represents interaction states (hover, pressed) handled via CSS, not props.
     */
    excludedProperties: ["state"],
  },
  scoring: {
    weights: {
      parity: 0.3,
      accessibility: 0.25,
      tokens: 0.2,
      documentation: 0.15,
      architecture: 0.1,
    },
    thresholds: {
      excellent: 90,
      good: 75,
      fair: 60,
      poor: 0,
    },
  },
  rules: {
    "figma-parity/name-match": true,
    "figma-parity/props-match": true,
    "figma-parity/variants-match": true,
    "a11y/focus-visible": true,
    "a11y/semantic-html": true,
    "tokens/no-hardcoded-colors": true,
    "tokens/no-hardcoded-spacing": true,
    "docs/stories-required": true,
    "docs/tests-required": true,
    "architecture/file-structure": true,
    "architecture/named-exports": true,
  },
};

export type AuditConfig = typeof auditConfig;
