import { create } from "zustand";
import { FigmaClient } from "../figma/figma-client";
import { db } from "../services/db";
import type { FigmaComponent } from "../types/figma";

interface FigmaStore {
  components: FigmaComponent[];
  isFetching: boolean;
  lastFetchedAt: string | null;
  error: string | null;
  fetchComponents: (
    token: string,
    fileKey: string,
    forceRefresh?: boolean,
  ) => Promise<void>;
  clearCache: () => Promise<void>;
}

export const useFigmaStore = create<FigmaStore>((set) => ({
  components: [],
  isFetching: false,
  lastFetchedAt: null,
  error: null,

  fetchComponents: async (token, fileKey, forceRefresh = false) => {
    set({ isFetching: true, error: null });

    try {
      const client = new FigmaClient(token, fileKey);
      const components = await client.fetchComponents(forceRefresh);
      set({
        components,
        isFetching: false,
        lastFetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      set({
        isFetching: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch Figma data",
      });
    }
  },

  clearCache: async () => {
    await db.figmaCache.clear();
    set({ components: [], lastFetchedAt: null });
  },
}));
