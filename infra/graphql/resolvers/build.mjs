import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const srcDir = "graphql/resolvers/src";
const outDir = "graphql/resolvers/dist";
const entries = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

await build({
  entryPoints: entries.map((f) => join(srcDir, f)),
  outdir: outDir,
  bundle: true,
  format: "esm",
  target: "es2020",
  sourcemap: false,
  external: ["@aws-appsync/utils", "@aws-appsync/utils/rds"],
});
console.log(`bundled ${entries.length} resolvers → ${outDir}`);
