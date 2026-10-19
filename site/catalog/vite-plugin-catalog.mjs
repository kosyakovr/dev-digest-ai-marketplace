// Exposes the catalog as `virtual:catalog` and regenerates it in the dev server when plugin files change.
import path from "node:path";
import { buildCatalog } from "./build-catalog.mjs";

const VIRTUAL_ID = "virtual:catalog";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export default function catalogPlugin({ repoRoot, base }) {
  const watched = [path.join(repoRoot, ".claude-plugin"), path.join(repoRoot, "plugins")];
  return {
    name: "marketplace-catalog",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const catalog = buildCatalog(repoRoot, { base });
      return `export default ${JSON.stringify(catalog)};`;
    },
    configureServer(server) {
      server.watcher.add(watched);
      const refresh = file => {
        if (!watched.some(dir => file.startsWith(dir))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      for (const event of ["add", "change", "unlink", "addDir", "unlinkDir"]) server.watcher.on(event, refresh);
    },
  };
}
