import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { Plugin, IncomingMessage, ServerResponse } from "vite";
import { FileScanner } from "./src/analyzers/file-scanner";
import { analyzeComponents } from "./src/analyzers/component-analyzer";

function scanApiPlugin(): Plugin {
  return {
    name: "scan-api",
    configureServer(server) {
      server.middlewares.use(
        "/api/scan",
        async (_req: IncomingMessage, res: ServerResponse) => {
          try {
            const nucleusPath =
              process.env.VITE_NUCLEUS_ROOT_PATH ||
              "/Users/bentley/Dev/nucleus";

            const scanner = new FileScanner(
              nucleusPath,
              ["src/components", "src/patterns"],
              ["node_modules", "dist", "test/coverage", ".storybook"],
            );

            const { components: files, errors: scanErrors } =
              await scanner.scanComponents();
            const { components, errors: analyzeErrors } =
              await analyzeComponents(files);

            const result = {
              timestamp: new Date().toISOString(),
              totalComponents: components.length,
              components,
              errors: [...scanErrors, ...analyzeErrors],
            };

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : "Scan failed",
              }),
            );
          }
        },
      );

      server.middlewares.use(
        "/api/validate-path",
        async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const url = new URL(req.url || "", "http://localhost");
            const nucleusPath =
              url.searchParams.get("path") || "/Users/bentley/Dev/nucleus";

            const scanner = new FileScanner(
              nucleusPath,
              ["src/components"],
              [],
            );
            const { components } = await scanner.scanComponents();

            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                valid: components.length > 0,
                count: components.length,
              }),
            );
          } catch {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ valid: false, count: 0 }));
          }
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), scanApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
