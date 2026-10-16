import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GlassNative } from "./index.js";

/** Called only inside the owner's guarded load path, never during module import. */
export function loadNative(): GlassNative {
  const filename = typeof __filename === "string" ? __filename : fileURLToPath(import.meta.url);
  const require = createRequire(filename);
  const load = require("node-gyp-build") as (path: string) => {
    LiquidGlassNative: new () => GlassNative;
  };
  const addon = load(join(dirname(filename), ".."));
  return new addon.LiquidGlassNative();
}
