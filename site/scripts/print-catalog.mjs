// Print a summary of the generated catalog (or the full JSON with --json). Useful when adding plugins.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "../catalog/build-catalog.mjs";

const catalog = buildCatalog(path.join(fileURLToPath(new URL("..", import.meta.url)), ".."));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(catalog, null, 2));
} else {
  for (const p of catalog.plugins) {
    console.log(`${p.id}${p.version ? ` v${p.version}` : ""}${p.external ? " (external)" : ""}`);
    for (const a of catalog.artifacts.filter(x => x.plugin === p.id)) console.log(`  ${a.type.padEnd(10)} ${a.name}`);
  }
}
