import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("index.html", import.meta.url)),
        docs: fileURLToPath(new URL("dokumentation.html", import.meta.url)),
        validator: fileURLToPath(new URL("project-location-validator/index.html", import.meta.url)),
      },
      output: {
        assetFileNames: asset => asset.names.some(name => name.endsWith("_nkk.json"))
          ? "assets/[name][extname]" : "assets/[name]-[hash][extname]",
        manualChunks: id => /\/node_modules\/ajv(?:-formats)?\//.test(id) ? "validation" : undefined,
      },
    },
  },
});
