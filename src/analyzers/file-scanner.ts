import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";
import type { ScanError } from "../types/component";

export interface ComponentFiles {
  name: string;
  directory: string;
  mainFile: string;
  specFile?: string;
  storiesFile?: string;
  indexFile?: string;
  additionalFiles: string[];
}

export class FileScanner {
  private rootPath: string;
  private componentPaths: string[];
  private excludePaths: string[];

  constructor(
    rootPath: string,
    componentPaths: string[],
    excludePaths: string[] = []
  ) {
    this.rootPath = rootPath;
    this.componentPaths = componentPaths;
    this.excludePaths = excludePaths;
  }

  /**
   * Scan for all components in the specified paths
   */
  async scanComponents(): Promise<{
    components: ComponentFiles[];
    errors: ScanError[];
  }> {
    const components: ComponentFiles[] = [];
    const errors: ScanError[] = [];

    for (const componentPath of this.componentPaths) {
      const fullPath = path.join(this.rootPath, componentPath);

      try {
        const componentDirs = await this.findComponentDirectories(fullPath);

        for (const dir of componentDirs) {
          try {
            const componentFiles = await this.analyzeComponentDirectory(dir);
            if (componentFiles) {
              components.push(componentFiles);
            }
          } catch (error) {
            errors.push({
              filePath: dir,
              error: error instanceof Error ? error.message : String(error),
              severity: "warning",
            });
          }
        }
      } catch (error) {
        errors.push({
          filePath: fullPath,
          error: `Failed to scan path: ${
            error instanceof Error ? error.message : String(error)
          }`,
          severity: "error",
        });
      }
    }

    return { components, errors };
  }

  /**
   * Find all component directories (directories containing .tsx files)
   */
  private async findComponentDirectories(basePath: string): Promise<string[]> {
    // Find all .tsx files (excluding .spec.tsx and .stories.tsx)
    const pattern = path.join(basePath, "**/*.tsx");
    const files = await glob(pattern, {
      ignore: [
        "**/*.spec.tsx",
        "**/*.stories.tsx",
        ...this.excludePaths.map((p) => `**/${p}/**`),
      ],
    });

    // Extract unique directories
    const directories = new Set<string>();
    for (const file of files) {
      directories.add(path.dirname(file));
    }

    return Array.from(directories).sort();
  }

  /**
   * Analyze a component directory to find all related files
   */
  private async analyzeComponentDirectory(
    directory: string
  ): Promise<ComponentFiles | null> {
    const files = fs.readdirSync(directory);

    // Find the main component file (ComponentName.tsx, not .spec or .stories)
    const mainFile = files.find(
      (f) =>
        f.endsWith(".tsx") &&
        !f.endsWith(".spec.tsx") &&
        !f.endsWith(".stories.tsx")
    );

    if (!mainFile) {
      return null;
    }

    const componentName = path.basename(mainFile, ".tsx");
    const specFile = files.find((f) => f === `${componentName}.spec.tsx`);
    const storiesFile = files.find((f) => f === `${componentName}.stories.tsx`);
    const indexFile = files.find((f) => f === "index.ts" || f === "index.tsx");

    // Additional files (other .tsx, .ts files)
    const additionalFiles = files.filter(
      (f) =>
        (f.endsWith(".tsx") || f.endsWith(".ts")) &&
        f !== mainFile &&
        f !== specFile &&
        f !== storiesFile &&
        f !== indexFile
    );

    return {
      name: componentName,
      directory,
      mainFile: path.join(directory, mainFile),
      specFile: specFile ? path.join(directory, specFile) : undefined,
      storiesFile: storiesFile ? path.join(directory, storiesFile) : undefined,
      indexFile: indexFile ? path.join(directory, indexFile) : undefined,
      additionalFiles: additionalFiles.map((f) => path.join(directory, f)),
    };
  }
}
