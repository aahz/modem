import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import macros from 'unplugin-parcel-macros';
import optimizeLocales from '@react-aria/optimize-locales-plugin';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8086";

export default defineConfig({
  root: "frontend",
  plugins: [
    macros.vite(),
    react(),
    {
      ...optimizeLocales.vite({
        locales: ['en-US']
      }),
      enforce: 'pre'
    }
  ],
  base: "/ui/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": apiProxyTarget,
      "/health": apiProxyTarget,
      "/docs": apiProxyTarget,
      "/openapi.json": apiProxyTarget,
    },
  },
  build: {
    outDir: "../dist-ui",
    target: ['es2022'],
    emptyOutDir: true,
    cssMinify: 'lightningcss',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/macro-(.*)\.css$/.test(id) || /@react-spectrum\/s2\/.*\.css$/.test(id)) {
            return 's2-styles';
          }
        }
      }
    }
  },
});
