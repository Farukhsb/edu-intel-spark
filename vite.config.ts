import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "npm:zod": "zod",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) {
              return "charts-vendor";
            }
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
              return "react-vendor";
            }
            if (id.includes("react-router-dom")) {
              return "router-vendor";
            }
            if (id.includes("@supabase/")) {
              return "supabase-vendor";
            }
            if (id.includes("react-markdown") || id.includes("remark") || id.includes("rehype")) {
              return "markdown-vendor";
            }
            if (id.includes("posthog-js")) {
              return "analytics-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }
          }
        },
      },
    },
  },
}));
