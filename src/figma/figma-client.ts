import type {
  FigmaComponent,
  FigmaApiComponent,
  FigmaApiComponentsResponse,
} from "../types/figma";
import { db } from "../services/db";
import { auditConfig } from "../audit.config";

const FIGMA_API = "https://api.figma.com/v1";
const CACHE_TTL_MS = auditConfig.figma.cacheDuration;

export class FigmaClient {
  private token: string;
  private fileKey: string;

  constructor(token: string, fileKey: string) {
    this.token = token;
    this.fileKey = fileKey;
  }

  async fetchComponents(forceRefresh = false): Promise<FigmaComponent[]> {
    if (!forceRefresh) {
      const cached = await this.getFromCache();
      if (cached) return cached;
    }

    const data = await this.fetchFromApi();
    const components = this.parseComponents(data.meta.components);

    await this.saveToCache(components);
    return components;
  }

  private async getFromCache(): Promise<FigmaComponent[] | null> {
    const cached = await db.figmaCache
      .where("fileKey")
      .equals(this.fileKey)
      .last();

    if (!cached) return null;

    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) return null;

    return cached.components;
  }

  private async saveToCache(components: FigmaComponent[]): Promise<void> {
    // Remove old cache entries for this file
    await db.figmaCache.where("fileKey").equals(this.fileKey).delete();

    await db.figmaCache.add({
      fileKey: this.fileKey,
      fetchedAt: new Date().toISOString(),
      components,
    });
  }

  private async fetchFromApi(): Promise<FigmaApiComponentsResponse> {
    const res = await fetch(`${FIGMA_API}/files/${this.fileKey}/components`, {
      headers: { "X-Figma-Token": this.token },
    });

    if (!res.ok) {
      throw new Error(
        res.status === 403
          ? "Invalid Figma token or insufficient permissions."
          : res.status === 404
            ? "Figma file not found. Check your file key."
            : `Figma API error (${res.status})`,
      );
    }

    return res.json();
  }

  private parseComponents(raw: FigmaApiComponent[]): FigmaComponent[] {
    // Filter out variant components — these belong to a component set and
    // represent individual states (e.g. state=hover, size=small). We only
    // want the top-level logical components for parity matching.
    const topLevel = raw.filter((c) => !c.component_set_id);

    // Deduplicate by codeName so Button/Primary and Button/Secondary both
    // resolve to a single "Button" entry.
    const seen = new Set<string>();
    const deduplicated: FigmaApiComponent[] = [];
    for (const c of topLevel) {
      const codeName = this.extractCodeName(c.name, c.description ?? "");
      if (!seen.has(codeName.toLowerCase())) {
        seen.add(codeName.toLowerCase());
        deduplicated.push(c);
      }
    }

    return deduplicated.map((c: FigmaApiComponent) => ({
      id: c.node_id,
      key: c.key,
      name: c.name,
      codeName: this.extractCodeName(c.name, c.description ?? ""),
      description: c.description ?? "",
      documentation: c.description ?? "",
      variants: [],
      properties: [],
      lastModified: c.updated_at ?? new Date().toISOString(),
      thumbnailUrl: c.thumbnail_url,
    }));
  }

  /**
   * Extracts the code-side component name for matching.
   *
   * Priority:
   *  1. @code tag in description: `@code Button`
   *  2. Top-level name before first "/": `Button/Primary` → `Button`
   *  3. Full name as fallback
   */
  private extractCodeName(name: string, description: string): string {
    const codeTag = description?.match(/@code\s+(\w+)/);
    if (codeTag) return codeTag[1];

    const parts = name.split("/");
    return parts[0].trim();
  }
}

export async function getFigmaClient(): Promise<FigmaClient | null> {
  const token = import.meta.env.VITE_FIGMA_PERSONAL_ACCESS_TOKEN;
  const fileKey = import.meta.env.VITE_FIGMA_FILE_KEY;

  // Fall back to values stored in onboarding (localStorage via Zustand persist)
  const stored = localStorage.getItem("ds-audit-onboarding");
  const parsed = stored ? JSON.parse(stored) : null;
  const state = parsed?.state;

  const resolvedToken = token || state?.figmaToken;
  const resolvedFileKey = fileKey || state?.figmaFileKey;

  if (!resolvedToken || !resolvedFileKey) return null;

  return new FigmaClient(resolvedToken, resolvedFileKey);
}
