import { auditConfig } from "../audit.config";

const { githubUrl, githubBranch, storybookUrl, rootPath } = auditConfig.nucleus;

/**
 * GitHub source link for a component file.
 * Strips the local root path prefix to get the repo-relative path.
 */
export function githubLink(filePath: string): string {
  const repoRelative = filePath.replace(rootPath, "").replace(/^\//, "");
  return `${githubUrl}/blob/${githubBranch}/${repoRelative}`;
}

/**
 * Storybook story link for a component.
 * Uses the actual story title (e.g. "Patterns/Accordion") when available,
 * falling back to the component name under Components/.
 */
export function storybookLink(
  componentName: string,
  storyTitle?: string,
): string {
  const base = storyTitle ?? `Components/${componentName}`;
  const slug = base.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-");
  return `${storybookUrl}/?path=/docs/${slug}--docs`;
}

/**
 * Figma deep link to a specific component set node.
 */
export function figmaLink(fileKey: string, nodeId: string): string {
  const formattedNodeId = nodeId.replace(":", "-");
  return `https://www.figma.com/design/${fileKey}?node-id=${formattedNodeId}`;
}
