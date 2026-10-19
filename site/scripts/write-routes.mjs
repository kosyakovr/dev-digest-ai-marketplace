// After `vite build`: write one index.html per page so every URL loads directly on GitHub Pages,
// each with its own <title> and description, plus a 404.html for unknown paths.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog, siteRoutes } from "../catalog/build-catalog.mjs";

const siteDir = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(siteDir, "dist");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const catalog = buildCatalog(path.join(siteDir, ".."));

const escapeAttr = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const page = ({ title, description }) => template
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeAttr(description || "")}$2`);

const routes = siteRoutes(catalog);
for (const route of routes) {
  const dir = path.join(dist, route.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(route));
}
fs.writeFileSync(path.join(dist, "404.html"), page({ title: `Page not found · ${catalog.marketplace.name}`, description: "" }));
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
console.log(`Wrote ${routes.length} pages and 404.html to dist/`);
