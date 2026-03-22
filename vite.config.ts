import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  base: "/ui/",
  build: {
    outDir: "../dist-ui",
    emptyOutDir: true,
  },
});
