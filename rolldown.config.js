import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.mjs",
      format: "esm",
      sourcemap: true
    },
    external: [/^node:/],
    platform: "node"
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true
    },
    external: [/^node:/],
    platform: "node"
  }
]);
