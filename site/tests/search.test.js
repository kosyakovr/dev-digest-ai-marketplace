// Golden queries (spec R12): every query must keep finding its expected artifacts.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCatalog } from "../catalog/build-catalog.mjs";
import { buildIndex, runSearch } from "../src/lib/search.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const golden = JSON.parse(fs.readFileSync(new URL("./golden-queries.json", import.meta.url), "utf8"));
const catalog = buildCatalog(repoRoot);
const items = [...catalog.plugins.map(p => ({ ...p, body: p.readme })), ...catalog.artifacts];
const byId = new Map(items.map(i => [i.id, i]));
const index = buildIndex(items);

function search(query, filters = {}) {
  const f = { type: new Set(filters.type), plugin: new Set(filters.plugin), category: new Set(filters.category) };
  return runSearch(index, byId, query, f).results.map(r => r.item.id);
}

describe("golden queries", () => {
  for (const g of golden) {
    it(`"${g.query}"${g.filters ? ` with ${JSON.stringify(g.filters)}` : ""}`, () => {
      const ids = search(g.query, g.filters);
      if (g.first) expect(ids[0]).toBe(g.first);
      if (g.onlyType) expect(ids.every(id => byId.get(id).type === g.onlyType)).toBe(true);
      for (const id of g.top3 || []) expect(ids.slice(0, 3)).toContain(id);
      for (const id of g.contains || []) expect(ids).toContain(id);
      if (g.exactly) expect(ids).toEqual(g.exactly);
    });
  }

  it("covers every skill, agent and command with at least one query", () => {
    const expected = new Set(golden.flatMap(g => [g.first, ...(g.top3 || []), ...(g.contains || []), ...(g.exactly || [])].filter(Boolean)));
    const missing = catalog.artifacts.filter(a => ["skill", "agent", "command"].includes(a.type) && !expected.has(a.id)).map(a => a.id);
    expect(missing, "add a golden query for each of these").toEqual([]);
  });
});

describe("search behaviour", () => {
  it("narrows to a type when the query names one, unless told not to", () => {
    const f = { type: new Set(), plugin: new Set(), category: new Set() };
    expect(runSearch(index, byId, "review skill", f).implicitTypes).toEqual(new Set(["skill"]));
    expect(runSearch(index, byId, "review skill", f, { ignoreTypeWords: true }).implicitTypes).toBeNull();
  });

  it("counts facets without applying that facet's own filter", () => {
    const f = { type: new Set(["agent"]), plugin: new Set(), category: new Set() };
    const res = runSearch(index, byId, "", f);
    expect(res.facets.type.get("skill")).toBeGreaterThan(0);
    expect(res.results.every(r => r.item.type === "agent")).toBe(true);
  });
});
