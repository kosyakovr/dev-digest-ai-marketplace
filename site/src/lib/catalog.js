// The catalog generated from the repository at build time, plus lookups derived from it.
import data from "virtual:catalog";
import { buildIndex, TYPE_LABEL, TYPE_ORDER } from "./search.js";

export const marketplace = data.marketplace;
export const plugins = data.plugins;
export const components = data.artifacts;
/** The "How it works" page from the repository README, or null (catalog/build-catalog.mjs). */
export const guide = data.guide;

export const items = [...plugins.map(p => ({ ...p, body: p.readme })), ...components];
export const itemsById = new Map(items.map(i => [i.id, i]));
export const pluginsById = new Map(plugins.map(p => [p.id, p]));

let index;
/** The search index is built on first use, not on page load (R30). */
export function getIndex() {
  index ??= buildIndex(items);
  return index;
}

export const BASE = import.meta.env.BASE_URL;

export function componentsOf(pluginId) {
  return components.filter(c => c.plugin === pluginId);
}

export function componentSummary(pluginId) {
  const counts = {};
  for (const c of componentsOf(pluginId)) counts[c.type] = (counts[c.type] || 0) + 1;
  return TYPE_ORDER.filter(t => counts[t])
    .map(t => `${counts[t]} ${TYPE_LABEL[t].toLowerCase()}${counts[t] === 1 ? "" : "s"}`)
    .join(" · ");
}

/** Skills, agents and commands have their own page; hooks and servers link to the plugin's security section. */
export function hasPage(item) {
  return ["skill", "agent", "command"].includes(item.type);
}

export function linkFor(item) {
  if (item.type === "plugin") return `/plugins/${item.id}/`;
  if (hasPage(item)) return `/plugins/${item.plugin}/${item.type}s/${item.name}/`;
  return `/plugins/${item.plugin}/#security`;
}

export function fileUrl(repoPath, kind = "blob") {
  return `${marketplace.repoUrl}/${kind}/${marketplace.branch}/${repoPath}`;
}
