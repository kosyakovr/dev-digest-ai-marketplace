// Builds the site catalog from the marketplace repository (spec R1-R6, R20, R22).
// Runs at build time and in the dev server; the browser never reads the repository directly.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { Marked } from "marked";
import { BRANCH, LATEST_MARKETPLACE, LATEST_REF, REPO, SITE_BASE } from "./config.mjs";

export class CatalogError extends Error {}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const toPosix = p => p.split(path.sep).join("/");
const asList = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function listDir(p) { return isDir(p) ? fs.readdirSync(p).filter(n => !n.startsWith(".")).sort() : []; }

/** Parse YAML frontmatter. Falls back to plain `key: value` lines when the YAML is invalid, as Claude Code is lenient there. */
export function splitFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { data: null, body: text };
  let data;
  try {
    data = YAML.parse(match[1]) ?? {};
  } catch {
    data = {};
    for (const line of match[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { data: typeof data === "object" && data ? data : {}, body: text.slice(match[0].length) };
}

function describeSource(source) {
  if (typeof source === "string") return source;
  switch (source?.source) {
    case "github": return `github.com/${source.repo}`;
    case "git-subdir": return `${source.url} (${source.path})`;
    case "npm": return `npm: ${source.package}`;
    case "url": case "archive": return source.url;
    default: return source?.source || "unknown source";
  }
}

/** Read a file as it was at a commit. Throws when git cannot (no repository, unknown commit, shallow clone). */
const gitShow = root => (sha, file) =>
  execFileSync("git", ["-C", root, "show", `${sha}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** A stable entry pinned to a commit of this repository: git-subdir at plugins/<name>, which exists here. */
function isOwnPin(root, entry) {
  const source = entry.source;
  if (source?.source !== "git-subdir") return false;
  const sub = String(source.path || "").replace(/^\.\//, "").replace(/\/+$/, "");
  return sub === `plugins/${entry.name}` && isDir(path.join(root, sub));
}

export function buildCatalog(repoRoot, {
  base = SITE_BASE, repo = REPO, latestMarketplace = LATEST_MARKETPLACE, latestRef = LATEST_REF, readAtCommit,
} = {}) {
  const root = path.resolve(repoRoot);
  const readPinned = readAtCommit || gitShow(root);
  const rel = p => toPosix(path.relative(root, p));
  const repoUrl = `https://github.com/${repo}`;
  const errors = [];

  const readJson = (file, { required = false } = {}) => {
    if (!isFile(file)) { if (required) errors.push(`${rel(file)}: file is missing`); return null; }
    try { return JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { errors.push(`${rel(file)}: invalid JSON (${e.message})`); return null; }
  };

  const marketplace = readJson(path.join(root, ".claude-plugin", "marketplace.json"), { required: true });
  if (!marketplace) throw new CatalogError(errors.join("\n"));
  const mpName = marketplace.name;

  let commit = "";
  try { commit = execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* not a git checkout */ }

  const plugins = [];
  const raw = []; // components before Markdown rendering: { record, file, markdown }

  // Release channels (docs/specs/release-channels.md). The latest channel lists every directory under plugins/
  // that has a plugin.json; the stable catalog lists pins (git-subdir at a commit of this repository), relative
  // paths (stable at the working-tree version, the form before the switch to pins) and plugins hosted elsewhere.
  // Pages always come from the working tree; each plugin carries its version in both channels.
  const pluginsDir = path.join(root, "plugins");
  const listed = []; // { name, entry: stable entry or null, dir: local plugin directory or null, pinned }
  const claimed = new Set();
  for (const entry of marketplace.plugins || []) {
    if (typeof entry.source === "string") {
      const dir = path.resolve(root, entry.source);
      if (!dir.startsWith(root + path.sep) || !isDir(dir)) { errors.push(`marketplace entry "${entry.name}": source ${entry.source} does not exist`); continue; }
      listed.push({ name: entry.name, entry, dir, pinned: false });
      claimed.add(dir);
    } else if (isOwnPin(root, entry)) {
      const dir = path.join(pluginsDir, entry.name);
      listed.push({ name: entry.name, entry, dir, pinned: true });
      claimed.add(dir);
    } else {
      listed.push({ name: entry.name, entry, dir: null, pinned: false });
    }
  }
  const latestDirs = new Set(listDir(pluginsDir).map(n => path.join(pluginsDir, n)).filter(d => isFile(path.join(d, ".claude-plugin", "plugin.json"))));
  for (const dir of latestDirs) if (!claimed.has(dir)) listed.push({ name: path.basename(dir), entry: null, dir, pinned: false });
  listed.sort((a, b) => a.name.localeCompare(b.name));

  /** The version in plugin.json at a pinned commit; records a build error rather than guessing when git cannot read it. */
  const pinnedVersion = (name, sha) => {
    const file = `plugins/${name}/.claude-plugin/plugin.json`;
    if (!/^[0-9a-f]{40}$/.test(sha || "")) { errors.push(`marketplace entry "${name}": a pin needs a full 40-character sha`); return null; }
    try {
      const version = JSON.parse(readPinned(sha, file)).version;
      if (version) return String(version);
      errors.push(`marketplace entry "${name}": ${file} at ${sha} has no version`);
    } catch (e) {
      errors.push(`marketplace entry "${name}": cannot read ${file} at ${sha} (${String(e.message).trim().split("\n")[0]})`);
    }
    return null;
  };

  for (const { name, entry, dir, pinned } of listed) {
    const plugin = {
      id: name, type: "plugin", name, plugin: name,
      description: entry?.description || "", category: entry?.category || "", version: entry?.version || "",
      // null: the channel does not list the plugin ("latest only" when stableVersion is null).
      stableVersion: dir ? null : entry.version || "", latestVersion: null, stableCommit: pinned ? entry.source.sha || "" : "",
      external: !dir, source: dir ? "" : describeSource(entry.source),
      path: "", aliases: [], readme: "", changelog: "", readmeHtml: "", changelogHtml: "",
      security: { hooks: [], mcpServers: [], lspServers: [], executables: [] },
    };
    plugins.push(plugin);
    if (!dir) continue;

    const manifest = readJson(path.join(dir, ".claude-plugin", "plugin.json")) || {};
    const inside = p => { const abs = path.resolve(dir, p); return abs === dir || abs.startsWith(dir + path.sep) ? abs : null; };
    const aliases = manifest.metadata?.site?.aliases || {};

    plugin.version = manifest.version || plugin.version;
    plugin.latestVersion = latestDirs.has(dir) ? plugin.version : null;
    plugin.stableVersion = !entry ? null : pinned ? pinnedVersion(name, entry.source.sha) : plugin.version;
    plugin.description = entry?.description || manifest.description || "";
    plugin.category = entry?.category || manifest.metadata?.category || "";
    plugin.path = rel(dir);
    plugin.aliases = asList(aliases.plugin);
    plugin.readme = isFile(path.join(dir, "README.md")) ? fs.readFileSync(path.join(dir, "README.md"), "utf8") : "";
    plugin.changelog = isFile(path.join(dir, "CHANGELOG.md")) ? fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8") : "";

    // Markdown components. `skills` adds to skills/; `commands` and `agents` replace their default folder.
    const skillDirs = new Set();
    for (const p of ["skills", ...asList(manifest.skills)]) {
      const abs = inside(p);
      if (!abs) continue;
      if (isFile(path.join(abs, "SKILL.md"))) skillDirs.add(abs);
      else for (const child of listDir(abs)) if (isFile(path.join(abs, child, "SKILL.md"))) skillDirs.add(path.join(abs, child));
    }
    const mdFiles = paths => {
      const out = new Set();
      for (const p of paths) {
        const abs = inside(p);
        if (!abs) continue;
        if (isFile(abs) && abs.endsWith(".md")) out.add(abs);
        else for (const child of listDir(abs)) if (child.endsWith(".md") && isFile(path.join(abs, child))) out.add(path.join(abs, child));
      }
      return [...out];
    };
    const sources = [
      ...[...skillDirs].sort().map(d => ({ type: "skill", file: path.join(d, "SKILL.md"), fallbackName: path.basename(d) })),
      ...mdFiles(manifest.agents ? asList(manifest.agents) : ["agents"]).map(f => ({ type: "agent", file: f, fallbackName: path.basename(f, ".md") })),
      ...mdFiles(manifest.commands ? asList(manifest.commands) : ["commands"]).map(f => ({ type: "command", file: f, fallbackName: path.basename(f, ".md") })),
    ];
    for (const { type, file, fallbackName } of sources) {
      const { data, body } = splitFrontmatter(fs.readFileSync(file, "utf8"));
      if (!data) { errors.push(`${rel(file)}: missing YAML frontmatter`); continue; }
      const cname = String(data.name || (type === "command" ? fallbackName : "")).trim();
      const description = String(data.description || "").replace(/\s+/g, " ").trim();
      if (!cname) errors.push(`${rel(file)}: frontmatter has no name`);
      if (!description) errors.push(`${rel(file)}: frontmatter has no description`);
      if (!cname || !description) continue;
      const files = type === "skill"
        ? fs.readdirSync(path.dirname(file), { recursive: true }).map(String).filter(f => isFile(path.join(path.dirname(file), f)) && f !== "SKILL.md" && !path.basename(f).startsWith(".")).map(f => rel(path.join(path.dirname(file), f)).slice(plugin.path.length + 1)).sort()
        : [];
      const tools = Array.isArray(data.tools) ? data.tools.join(", ") : String(data.tools || "");
      raw.push({
        file, markdown: body,
        record: {
          id: `${name}/${type}/${cname}`, type, name: cname, plugin: name, description,
          category: plugin.category, version: plugin.version, path: rel(file), body, bodyHtml: "",
          files, tools, aliases: asList(aliases[`${type}/${cname}`]),
        },
      });
    }

    // Config components: defaults merge with manifest paths or inline objects.
    const configs = (defaultFile, value, key) => {
      const files = new Set(isFile(path.join(dir, defaultFile)) ? [path.join(dir, defaultFile)] : []);
      const inline = [];
      for (const v of asList(value)) {
        if (typeof v === "string") { const abs = inside(v); if (abs && isFile(abs)) files.add(abs); }
        else if (v && typeof v === "object") inline.push(v);
      }
      return [...[...files].map(f => readJson(f)), ...inline].filter(Boolean).map(c => (c[key] && typeof c[key] === "object" ? c[key] : c));
    };
    const commandOf = cfg => [cfg.command, ...asList(cfg.args)].filter(Boolean).join(" ") || cfg.url || cfg.prompt || "";

    const hookEvents = new Map();
    for (const cfg of configs("hooks/hooks.json", manifest.hooks, "hooks")) {
      for (const [event, groups] of Object.entries(cfg)) {
        for (const group of asList(groups)) {
          for (const hook of asList(group?.hooks)) {
            plugin.security.hooks.push({ event, matcher: group.matcher || "", command: commandOf(hook) });
            if (!hookEvents.has(event)) hookEvents.set(event, new Set());
            if (group.matcher) hookEvents.get(event).add(group.matcher);
          }
        }
      }
    }
    for (const cfg of configs(".mcp.json", manifest.mcpServers, "mcpServers")) {
      for (const [srv, c] of Object.entries(cfg)) plugin.security.mcpServers.push({ name: srv, command: commandOf(c || {}) });
    }
    for (const cfg of configs(".lsp.json", manifest.lspServers, "lspServers")) {
      for (const [srv, c] of Object.entries(cfg)) plugin.security.lspServers.push({ name: srv, command: commandOf(c || {}) });
    }
    plugin.security.executables = listDir(path.join(dir, "bin")).filter(f => isFile(path.join(dir, "bin", f)));

    const component = (type, cname, description) => raw.push({
      file: null, markdown: "",
      record: { id: `${name}/${type}/${cname}`, type, name: cname, plugin: name, description, category: plugin.category,
        version: plugin.version, path: plugin.path, body: "", bodyHtml: "", files: [], tools: "", aliases: asList(aliases[`${type}/${cname}`]) },
    });
    for (const [event, matchers] of hookEvents) {
      component("hook", event, `Hook that runs on ${event}${matchers.size ? ` for ${[...matchers].join(", ")}` : ""}.`);
    }
    for (const s of plugin.security.mcpServers) component("mcp-server", s.name, `MCP server${s.command ? `: ${s.command}` : ""}.`);
    for (const s of plugin.security.lspServers) component("lsp-server", s.name, `LSP server${s.command ? `: ${s.command}` : ""}.`);
  }

  if (errors.length) throw new CatalogError(`Catalog build failed:\n- ${errors.join("\n- ")}`);

  // Pages that Markdown links can point to (R20).
  const pageByFile = new Map();
  for (const p of plugins) if (p.path) for (const f of [p.path, `${p.path}/README.md`]) pageByFile.set(f, `${base}plugins/${p.id}/`);
  for (const { record } of raw) if (["skill", "agent", "command"].includes(record.type)) pageByFile.set(record.path, `${base}plugins/${record.plugin}/${record.type}s/${record.name}/`);

  const render = (markdown, fileRel) => {
    if (!markdown.trim()) return "";
    const dirParts = fileRel.split("/").slice(0, -1);
    const md = new Marked({ gfm: true });
    md.use({
      renderer: {
        link({ href, title, tokens }) {
          const text = this.parser.parseInline(tokens);
          let url = href || "";
          let external = /^[a-z][a-z0-9+.-]*:|^\/\//i.test(url);
          if (!external && !url.startsWith("#") && !url.startsWith("/")) {
            const [target, hash = ""] = url.split("#");
            const parts = [...dirParts];
            for (const seg of target.split("/")) { if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg); }
            const resolved = parts.join("/");
            const page = pageByFile.get(resolved);
            if (page) url = page + (hash ? `#${hash}` : "");
            else { url = `${repoUrl}/${target.endsWith("/") ? "tree" : "blob"}/${BRANCH}/${resolved}${hash ? `#${hash}` : ""}`; external = true; }
          }
          const attrs = external ? ' target="_blank" rel="noopener"' : "";
          return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ""}${attrs}>${text}</a>`;
        },
        // Raw HTML in Markdown is shown as text, except comments, which are dropped.
        html({ text }) { return /^\s*<!--[\s\S]*?-->\s*$/.test(text) ? "" : escapeHtml(text); },
      },
    });
    return md.parse(markdown.replace(/^\s*#\s+.*(?:\r?\n)+/, ""));
  };

  for (const p of plugins) {
    if (p.readme) p.readmeHtml = render(p.readme, `${p.path}/README.md`);
    if (p.changelog) p.changelogHtml = render(p.changelog, `${p.path}/CHANGELOG.md`);
  }
  for (const { record } of raw) if (record.body) record.bodyHtml = render(record.body, record.path);

  return {
    guide: readGuide(root, plugins, render),
    schemaVersion: 1,
    marketplace: {
      name: mpName, description: marketplace.description || "", owner: marketplace.owner?.name || "", repo, repoUrl, branch: BRANCH, commit,
      // What `marketplace add` and the install commands need per channel; `ref` is the branch a channel is served from.
      channels: {
        stable: { marketplace: mpName, repo, ref: "" },
        latest: { marketplace: latestMarketplace, repo, ref: latestRef },
      },
    },
    plugins,
    artifacts: raw.map(r => r.record),
  };
}

export const GUIDE_HEADING = "How the plugins work together";

/**
 * The "How it works" page: the README's `## How the plugins work together` section up to the next `##` heading,
 * with its headings raised one level so the page title is the only h1. Null when the README has no such section.
 * `plugins` lists the hosted plugins the section names; their pages link to it.
 */
function readGuide(root, plugins, render) {
  const file = path.join(root, "README.md");
  if (!isFile(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const body = [];
  let inside = false, fenced = false;
  for (const line of lines) {
    const heading = !fenced && /^##\s/.test(line);
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (heading && inside) break;
    if (heading && line.replace(/^##\s+/, "").trim() === GUIDE_HEADING) { inside = true; continue; }
    if (inside) body.push(!fenced && /^#{3,6}\s/.test(line) ? line.slice(1) : line);
  }
  const markdown = body.join("\n").trim();
  if (!markdown) return null;
  const firstParagraph = markdown.split(/\n\s*\n/)[0].replace(/\s+/g, " ");
  const mentions = name => new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`).test(markdown);
  return {
    title: GUIDE_HEADING,
    description: firstParagraph.replace(/[`*_]/g, ""),
    html: render(markdown, "README.md"),
    plugins: plugins.filter(p => !p.external && mentions(p.name)).map(p => p.id),
  };
}

/** All site routes, used to write one HTML file per page for GitHub Pages. */
export function siteRoutes(catalog) {
  const routes = [
    { path: "", title: `${catalog.marketplace.name} catalog`, description: catalog.marketplace.description },
    { path: "install/", title: `Install list · ${catalog.marketplace.name}`, description: "Copy install commands or a team settings file for Claude Code plugins." },
  ];
  if (catalog.guide) routes.push({ path: "how-it-works/", title: `${catalog.guide.title} · ${catalog.marketplace.name}`, description: catalog.guide.description });
  for (const p of catalog.plugins) routes.push({ path: `plugins/${p.id}/`, title: `${p.name} · ${catalog.marketplace.name}`, description: p.description });
  for (const a of catalog.artifacts) {
    if (["skill", "agent", "command"].includes(a.type)) routes.push({ path: `plugins/${a.plugin}/${a.type}s/${a.name}/`, title: `${a.name} (${a.type}) · ${catalog.marketplace.name}`, description: a.description });
  }
  return routes;
}
