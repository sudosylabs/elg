import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "js/index.ts",
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  fixedExtension: false,
  outDir: "dist",
  target: "node22",
  platform: "node",
  tsconfig: "tsconfig.build.json",
  deps: { neverBundle: ["node-gyp-build"] },
  outputOptions: { exports: "named" },
});
