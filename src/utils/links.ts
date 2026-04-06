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
 * Uses the actual story title and first story name from the stories file.
 * Autodocs is disabled in Nucleus so we link to the first named story.
 */
export function storybookLink(
  componentName: string,
  storyTitle?: string,
  firstStoryName?: string,
): string {
  const base = storyTitle ?? `Components/${componentName}`;
  const slug = base.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-");
  const story = (firstStoryName ?? "default").toLowerCase();
  return `${storybookUrl}/?path=/story/${slug}--${story}`;
}

/**
 * Figma deep link to a specific component set node.
 */
export function figmaLink(fileKey: string, nodeId: string): string {
  const formattedNodeId = nodeId.replace(":", "-");
  return `https://www.figma.com/design/${fileKey}?node-id=${formattedNodeId}`;
}
