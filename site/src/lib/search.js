// Catalog search (spec R8-R11). Tested against the golden queries in tests/golden-queries.json (R12).
import MiniSearch from "minisearch";

export const TYPE_ORDER = ["plugin", "skill", "agent", "command", "hook", "mcp-server", "lsp-server"];
export const TYPE_LABEL = {
  plugin: "Plugin", skill: "Skill", agent: "Agent", command: "Command",
  hook: "Hook", "mcp-server": "MCP server", "lsp-server": "LSP server",
};

const TYPE_WORDS = {
  plugin: "plugin", plugins: "plugin", skill: "skill", skills: "skill", agent: "agent", agents: "agent",
  subagent: "agent", subagents: "agent", command: "command", commands: "command",
  hook: "hook", hooks: "hook", mcp: "mcp-server", lsp: "lsp-server",
};

const STOP_WORDS = new Set((
  "a about all an and any anything are as be can could do does find for from get give help how i i'd i'm id im in " +
  "is it its looking me my need needs of on one or please quick search show some something that the thing this to tool tools " +
  "use want wants way what which with would you your"
).split(" "));

/** Light English stemming applied to both the index and the query. */
export function stem(term) {
  if (term.length > 5 && term.endsWith("ing")) return term.slice(0, -3);
  if (term.length > 4 && term.endsWith("ed")) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) return term.slice(0, -1);
  return term;
}

function tokenize(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9']+/).map(t => t.replace(/'/g, "")).filter(Boolean);
}

/** Split a free-text query into search terms and type words (R8). */
export function parseQuery(query) {
  const terms = [];
  const types = new Set();
  for (const raw of String(query || "").toLowerCase().split(/[^a-z0-9']+/).filter(Boolean)) {
    const token = raw.replace(/'/g, "");
    if (TYPE_WORDS[token]) types.add(TYPE_WORDS[token]);
    else if (!STOP_WORDS.has(raw) && !STOP_WORDS.has(token)) terms.push(token);
  }
  return { terms, types };
}

export function buildIndex(items) {
  const index = new MiniSearch({
    fields: ["name", "aliases", "description", "plugin", "body"],
    extractField: (doc, field) => (field === "aliases" ? (doc.aliases || []).join(" ") : doc[field] || ""),
    tokenize,
    processTerm: term => stem(term.toLowerCase()),
    searchOptions: {
      boost: { name: 4, aliases: 3, description: 2, plugin: 1, body: 1 }, // R10
      prefix: term => term.length >= 3, // R9
      fuzzy: term => (term.length >= 6 ? 2 : term.length >= 4 ? 1 : false), // R9
      combineWith: "OR",
    },
  });
  index.addAll(items);
  return index;
}

const typeRank = item => TYPE_ORDER.indexOf(item.type);

/**
 * Run a query with filters ({ type, plugin, category }: Set each).
 * Type words in the query act as a type filter unless types are picked explicitly or ignoreTypeWords is set (R8).
 * Facet counts for a group ignore that group's own filter (R11).
 */
export function runSearch(index, itemsById, query, filters, { ignoreTypeWords = false } = {}) {
  const { terms, types } = parseQuery(query);
  const hits = terms.length
    ? index.search(terms.join(" ")).map(r => ({ item: itemsById.get(r.id), score: r.score, terms: r.terms }))
    : [...itemsById.values()].map(item => ({ item, score: 0, terms: [] }));
  hits.sort((a, b) => b.score - a.score || typeRank(a.item) - typeRank(b.item) || a.item.name.localeCompare(b.item.name));

  const implicitTypes = !ignoreTypeWords && !filters.type.size && types.size ? types : null;
  const effective = { type: filters.type.size ? filters.type : implicitTypes || new Set(), plugin: filters.plugin, category: filters.category };
  const keep = (hit, skip) => Object.entries(effective).every(([key, values]) => key === skip || !values.size || values.has(hit.item[key]));

  const facets = {};
  for (const key of ["type", "plugin", "category"]) {
    facets[key] = new Map();
    for (const hit of hits) {
      const value = hit.item[key];
      if (value && keep(hit, key)) facets[key].set(value, (facets[key].get(value) || 0) + 1);
    }
  }
  return { results: hits.filter(h => keep(h)), facets, terms, implicitTypes, total: itemsById.size };
}
