import { create } from "zustand";
import { runScan } from "../services/scan-service";
import { FigmaClient } from "../figma/figma-client";
import { runParityCheck } from "../services/parity-checker";
import { db } from "../services/db";
import type { ScanResult } from "../types/component";
import type { FigmaComponent } from "../types/figma";
import type { ParityReport } from "../types/parity";

interface AuditStore {
  isScanning: boolean;
  progress: number;
  progressLabel: string;
  results: ScanResult | null;
  figmaComponents: FigmaComponent[];
  parityReport: ParityReport | null;
  figmaError: string | null;
  error: string | null;
  startScan: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearResults: () => void;
}

function getStoredFigmaCredentials(): {
  token: string;
  fileKey: string;
} | null {
  try {
    const stored = localStorage.getItem("ds-audit-onboarding");
    const state = stored ? JSON.parse(stored)?.state : null;
    if (state?.figmaToken && state?.figmaFileKey) {
      return { token: state.figmaToken, fileKey: state.figmaFileKey };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export const useAuditStore = create<AuditStore>((set) => ({
  isScanning: false,
  progress: 0,
  progressLabel: "",
  results: null,
  figmaComponents: [],
  parityReport: null,
  figmaError: null,
  error: null,

  startScan: async () => {
    set({
      isScanning: true,
      progress: 10,
      progressLabel: "Scanning Nucleus components...",
      error: null,
      figmaError: null,
    });

    try {
      // Step 1: Scan code
      const results = await runScan();
      set({
        results,
        progress: 60,
        progressLabel: "Fetching Figma library...",
      });

      // Step 2: Fetch Figma (non-blocking — failure doesn't fail the whole scan)
      const creds = getStoredFigmaCredentials();
      if (creds) {
        try {
          const client = new FigmaClient(creds.token, creds.fileKey);
          const figmaComponents = await client.fetchComponents();
          set({
            figmaComponents,
            progress: 75,
            progressLabel: "Running parity check...",
          });

          // Step 3: Run parity check
          const parityReport = await runParityCheck(
            results.components,
            figmaComponents,
          );

          set({
            parityReport,
            progress: 90,
            progressLabel: "Saving results...",
          });

          // Calculate a11y score (% of 4 checks passing, averaged across components)
          const A11Y_KEYS = [
            "hasAriaProps",
            "hasFocusVisible",
            "semanticHTML",
            "hasKeyboardSupport",
          ] as const;
          const a11yScore =
            results.components.length > 0
              ? Math.round(
                  results.components.reduce((sum, c) => {
                    const passed = A11Y_KEYS.filter(
                      (k) => c[k as keyof typeof c],
                    ).length;
                    return sum + (passed / A11Y_KEYS.length) * 100;
                  }, 0) / results.components.length,
                )
              : 0;

          // Persist scan result and history entry to IndexedDB
          await db.scanResults.add({ ...results, id: undefined });
          await db.scanHistory.add({
            timestamp: new Date().toISOString(),
            parityScore: parityReport.overallScore,
            parityGrade: parityReport.overallGrade,
            coverageScore: parityReport.coverageScore,
            a11yScore,
            totalComponents: results.totalComponents,
            alignedCount: parityReport.alignedCount,
            issuesCount: parityReport.issuesCount,
          });
        } catch (figmaErr) {
          set({
            figmaError:
              figmaErr instanceof Error
                ? figmaErr.message
                : "Could not fetch Figma data",
          });
        }
      }

      set({ isScanning: false, progress: 100, progressLabel: "" });
    } catch (error) {
      set({
        isScanning: false,
        progress: 0,
        progressLabel: "",
        error: error instanceof Error ? error.message : "Scan failed",
      });
    }
  },

  hydrate: async () => {
    // Load the most recent scan result from IndexedDB
    const latestScan = await db.scanResults.orderBy("timestamp").last();
    if (!latestScan) return;

    // Normalise any fields added after the scan was saved (avoids undefined errors)
    const components = latestScan.components.map((c) => ({
      ...c,
      hardcodedColors: c.hardcodedColors ?? [],
      hasKeyboardSupport: c.hasKeyboardSupport ?? false,
    }));
    const results = { ...latestScan, components };

    // Load cached Figma components if available
    const figmaCache = await db.figmaCache.orderBy("fetchedAt").last();
    const figmaComponents = figmaCache?.components ?? [];

    set({ results, figmaComponents });

    // Re-run parity check to reconstruct the report
    if (figmaComponents.length > 0) {
      try {
        const parityReport = await runParityCheck(components, figmaComponents);
        set({ parityReport });
      } catch {
        // Parity check failed — results still shown without parity data
      }
    }
  },

  clearResults: () =>
    set({
      results: null,
      figmaComponents: [],
      parityReport: null,
      progress: 0,
      progressLabel: "",
      error: null,
      figmaError: null,
    }),
}));
