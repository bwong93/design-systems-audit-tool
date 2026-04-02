import { create } from "zustand";
import { persist } from "zustand/middleware";
import { validateNucleusPath } from "../services/scan-service";
import { auditConfig } from "../audit.config";

interface OnboardingStore {
  completed: boolean;
  figmaConnected: boolean;
  figmaToken: string;
  figmaFileKey: string;
  nucleusPath: string;
  nucleusValid: boolean;
  isTestingFigma: boolean;
  isValidatingPath: boolean;
  figmaError: string | null;
  pathError: string | null;

  setFigmaCredentials: (token: string, fileKey: string) => void;
  testFigmaConnection: () => Promise<boolean>;
  setNucleusPath: (path: string) => void;
  validatePath: () => Promise<boolean>;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      completed: false,
      figmaConnected: false,
      figmaToken: "",
      figmaFileKey: "",
      nucleusPath: auditConfig.nucleus.rootPath,
      nucleusValid: false,
      isTestingFigma: false,
      isValidatingPath: false,
      figmaError: null,
      pathError: null,

      setFigmaCredentials: (token, fileKey) => {
        set({ figmaToken: token, figmaFileKey: fileKey, figmaError: null });
      },

      testFigmaConnection: async () => {
        const { figmaToken, figmaFileKey } = get();
        if (!figmaToken || !figmaFileKey) {
          set({ figmaError: "Please enter both a token and a file key." });
          return false;
        }

        set({ isTestingFigma: true, figmaError: null });

        try {
          const res = await fetch(
            `https://api.figma.com/v1/files/${figmaFileKey}/components`,
            { headers: { "X-Figma-Token": figmaToken } },
          );

          if (!res.ok) {
            const msg =
              res.status === 403
                ? "Invalid token or no access to this file."
                : res.status === 404
                  ? "File not found. Check your file key."
                  : `Connection failed (${res.status}).`;
            set({ figmaError: msg, isTestingFigma: false });
            return false;
          }

          set({ figmaConnected: true, isTestingFigma: false });
          return true;
        } catch {
          set({
            figmaError: "Network error. Check your connection.",
            isTestingFigma: false,
          });
          return false;
        }
      },

      setNucleusPath: (path) => {
        set({ nucleusPath: path, pathError: null, nucleusValid: false });
      },

      validatePath: async () => {
        const { nucleusPath } = get();
        set({ isValidatingPath: true, pathError: null });

        const valid = await validateNucleusPath(nucleusPath);

        if (!valid) {
          set({
            pathError: "No components found at this path. Check the directory.",
            isValidatingPath: false,
          });
          return false;
        }

        set({ nucleusValid: true, isValidatingPath: false });
        return true;
      },

      completeOnboarding: () => set({ completed: true }),

      resetOnboarding: () =>
        set({
          completed: false,
          figmaConnected: false,
          nucleusValid: false,
          figmaError: null,
          pathError: null,
        }),
    }),
    {
      name: "ds-audit-onboarding",
      partialize: (state) => ({
        completed: state.completed,
        figmaToken: state.figmaToken,
        figmaFileKey: state.figmaFileKey,
        nucleusPath: state.nucleusPath,
        figmaConnected: state.figmaConnected,
        nucleusValid: state.nucleusValid,
      }),
    },
  ),
);
