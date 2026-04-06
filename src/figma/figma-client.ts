import type {
  FigmaComponent,
  FigmaApiComponentSet,
  FigmaApiComponentSetsResponse,
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
    const components = this.parseComponents(data.meta.component_sets);

    // Enrich each component with properties parsed from variant children
    await this.enrichWithVariantProperties(components);

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

  private async fetchFromApi(): Promise<FigmaApiComponentSetsResponse> {
    // Use component_sets — returns one entry per logical component (Tag, Button, Input)
    // NOT /components which returns every individual variant state
    const res = await fetch(
      `${FIGMA_API}/files/${this.fileKey}/component_sets`,
      { headers: { "X-Figma-Token": this.token } },
    );

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

  /**
   * Fetches full node data for all components in one batched request and
   * parses variant child names (e.g. "variant=primary, size=large") to
   * extract property names and their possible values.
   */
  private async enrichWithVariantProperties(
    components: FigmaComponent[],
  ): Promise<void> {
    if (components.length === 0) return;

    const excluded = new Set(auditConfig.figma.excludedProperties);
    const ids = components.map((c) => c.id).join(",");

    let nodesData: Record<
      string,
      { document?: { children?: { name: string }[] } }
    >;
    try {
      const res = await fetch(
        `${FIGMA_API}/files/${this.fileKey}/nodes?ids=${ids}`,
        { headers: { "X-Figma-Token": this.token } },
      );
      if (!res.ok) return; // degrade gracefully — properties stay empty
      nodesData = (await res.json()).nodes ?? {};
    } catch {
      return; // network error — degrade gracefully
    }

    for (const component of components) {
      const children = nodesData[component.id]?.document?.children;
      if (!children?.length) continue;

      // Aggregate unique values per property name across all variant children
      const propValues = new Map<string, Set<string>>();

      for (const child of children) {
        // Each child name looks like: "variant=primary, size=large, state=default"
        for (const pair of child.name.split(",")) {
          const eqIdx = pair.indexOf("=");
          if (eqIdx === -1) continue;
          const key = pair.slice(0, eqIdx).trim().toLowerCase();
          const value = pair
            .slice(eqIdx + 1)
            .trim()
            .toLowerCase();
          if (excluded.has(key)) continue;
          if (!propValues.has(key)) propValues.set(key, new Set());
          propValues.get(key)!.add(value);
        }
      }

      component.properties = Array.from(propValues.entries()).map(
        ([name, values]) => ({ name, values: Array.from(values) }),
      );
    }
  }

  private parseComponents(raw: FigmaApiComponentSet[]): FigmaComponent[] {
    return raw.map((c: FigmaApiComponentSet) => ({
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
