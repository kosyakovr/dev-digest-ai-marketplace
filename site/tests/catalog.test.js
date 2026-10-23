// Catalog generation (spec R2-R6, R20, R22; release-channels R15) against the real repository and a fixture marketplace.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCatalog, CatalogError, GUIDE_HEADING, siteRoutes } from "../catalog/build-catalog.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("./fixtures/marketplace", import.meta.url));

describe("real repository", () => {
  const catalog = buildCatalog(repoRoot, { base: "/base/" });
  const marketplace = JSON.parse(fs.readFileSync(path.join(repoRoot, ".claude-plugin/marketplace.json"), "utf8"));

  it("lists every plugin under plugins/ and every external marketplace entry, and nothing else (R2, R15)", () => {
    const local = fs.readdirSync(path.join(repoRoot, "plugins")).filter(d => fs.existsSync(path.join(repoRoot, "plugins", d, ".claude-plugin/plugin.json")));
    const external = catalog.plugins.filter(p => p.external).map(p => p.id);
    expect(external.every(id => marketplace.plugins.some(e => e.name === id))).toBe(true);
    expect(catalog.plugins.map(p => p.id)).toEqual([...local, ...external].sort((a, b) => a.localeCompare(b)));
  });

  it("marks each plugin's stable and latest version (R15)", () => {
    for (const p of catalog.plugins.filter(x => !x.external)) {
      const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, p.path, ".claude-plugin/plugin.json"), "utf8"));
      const entry = marketplace.plugins.find(e => e.name === p.id);
      expect(p.latestVersion).toBe(manifest.version);
      if (!entry) expect(p.stableVersion).toBeNull();
      else if (typeof entry.source === "string") expect(p.stableVersion).toBe(manifest.version);
      else expect(p.stableVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("finds every skill and agent in the default folders (R2)", () => {
    for (const entry of catalog.plugins.filter(p => !p.external)) {
      const dir = path.join(repoRoot, entry.path);
      const skills = fs.existsSync(path.join(dir, "skills")) ? fs.readdirSync(path.join(dir, "skills")).filter(d => fs.existsSync(path.join(dir, "skills", d, "SKILL.md"))) : [];
      const agents = fs.existsSync(path.join(dir, "agents")) ? fs.readdirSync(path.join(dir, "agents")).filter(f => f.endsWith(".md")) : [];
      const found = catalog.artifacts.filter(a => a.plugin === entry.name);
      expect(found.filter(a => a.type === "skill").length).toBeGreaterThanOrEqual(skills.length);
      expect(found.filter(a => a.type === "agent").length).toBeGreaterThanOrEqual(agents.length);
    }
  });

  it("gives every record the fields the site relies on (R4)", () => {
    for (const a of catalog.artifacts) {
      expect(a).toMatchObject({ id: expect.any(String), type: expect.any(String), name: expect.any(String), plugin: expect.any(String), description: expect.any(String) });
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it("writes a page for every plugin, skill, agent and command", () => {
    const paths = siteRoutes(catalog).map(r => r.path);
    expect(paths).toContain("");
    expect(paths).toContain("install/");
    for (const p of catalog.plugins) expect(paths).toContain(`plugins/${p.id}/`);
  });

  it("builds the How it works page from the README's section, diagrams included", () => {
    const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
    const { guide } = catalog;
    expect(guide.title).toBe(GUIDE_HEADING);
    expect(guide.description).toMatch(/^Four plugins, one workflow\./);
    expect(guide.html).not.toMatch(/<h1/);
    expect(guide.html).toContain("<h2>The flow</h2>");
    expect(guide.html.match(/class="language-mermaid"/g)).toHaveLength(readme.split(/^## /m).find(s => s.startsWith(GUIDE_HEADING)).match(/^```mermaid/gm).length);
    expect(guide.html).not.toContain("Use in a team repository");
    expect(guide.html).toContain('href="/base/plugins/research-tools/"');
    expect(guide.plugins).toEqual(catalog.plugins.filter(p => !p.external).map(p => p.id));
    expect(siteRoutes(catalog).find(r => r.path === "how-it-works/")).toMatchObject({ description: guide.description });
  });
});

describe("fixture marketplace", () => {
  const catalog = buildCatalog(fixtureRoot, { base: "/base/", repo: "owner/repo" });
  const byId = new Map(catalog.artifacts.map(a => [a.id, a]));
  const plugin = catalog.plugins.find(p => p.id === "full-plugin");

  it("reads hooks, MCP and LSP servers and executables (R22)", () => {
    expect(plugin.security.hooks).toEqual([{ event: "PreToolUse", matcher: "Bash", command: '"${CLAUDE_PLUGIN_ROOT}"/hooks/check.sh' }]);
    expect(plugin.security.mcpServers).toEqual([{ name: "tracker", command: "npx -y tracker-mcp" }]);
    expect(plugin.security.lspServers).toEqual([{ name: "yaml", command: "yaml-language-server --stdio" }]);
    expect(plugin.security.executables).toEqual(["fixture-tool"]);
    expect(byId.has("full-plugin/hook/PreToolUse")).toBe(true);
    expect(byId.has("full-plugin/mcp-server/tracker")).toBe(true);
  });

  it("reads commands, extra skill paths from plugin.json and site aliases (R2, R5)", () => {
    expect(byId.get("full-plugin/command/deploy").description).toBe("Deploys the current branch.");
    expect(byId.has("full-plugin/skill/extra-skill")).toBe(true);
    expect(byId.get("full-plugin/skill/main-skill").aliases).toEqual(["primary"]);
    expect(byId.get("full-plugin/skill/main-skill").files).toEqual(["skills/main-skill/references/notes.md"]);
  });

  it("shows external entries from their marketplace metadata only (R3)", () => {
    const ext = catalog.plugins.find(p => p.id === "external-plugin");
    expect(ext).toMatchObject({ external: true, source: "github.com/someone/elsewhere", path: "", latestVersion: null });
    expect(catalog.artifacts.some(a => a.plugin === "external-plugin")).toBe(false);
  });

  it("lists a plugin with a relative-path entry in both channels at the working-tree version (R15)", () => {
    expect(plugin).toMatchObject({ stableVersion: "2.0.0", latestVersion: "2.0.0", stableCommit: "", category: "testing" });
  });

  it("lists a plugin missing from the stable catalog as latest only, with pages from plugin.json (R15)", () => {
    const latestOnly = catalog.plugins.find(p => p.id === "new-plugin");
    expect(latestOnly).toMatchObject({
      external: false, stableVersion: null, latestVersion: "0.3.0", version: "0.3.0",
      description: "Not promoted to stable yet.", category: "research", path: "plugins/new-plugin",
    });
    expect(byId.get("new-plugin/skill/try-skill")).toMatchObject({ category: "research", version: "0.3.0" });
    expect(siteRoutes(catalog).map(r => r.path)).toContain("plugins/new-plugin/skills/try-skill/");
  });

  it("has no How it works page without a README section", () => {
    expect(catalog.guide).toBeNull();
    expect(siteRoutes(catalog).map(r => r.path)).not.toContain("how-it-works/");
  });

  it("describes both channels' marketplaces (R15)", () => {
    expect(catalog.marketplace.channels).toEqual({
      stable: { marketplace: "fixture-market", repo: "owner/repo", ref: "" },
      latest: { marketplace: "dev-digest-ai-latest", repo: "owner/repo", ref: "latest" },
    });
  });

  it("rewrites relative Markdown links and drops raw HTML (R20)", () => {
    const html = byId.get("full-plugin/skill/main-skill").bodyHtml;
    expect(html).toContain('href="https://github.com/owner/repo/blob/main/plugins/full-plugin/skills/main-skill/references/notes.md"');
    expect(html).toContain('href="/base/plugins/full-plugin/skills/extra-skill/"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("TODO comment");
  });
});

describe("invalid content (R6)", () => {
  it("fails with the file name when frontmatter is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
    fs.cpSync(fixtureRoot, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "plugins/full-plugin/agents/broken.md"), "No frontmatter here.\n");
    expect(() => buildCatalog(dir)).toThrow(CatalogError);
    expect(() => buildCatalog(dir)).toThrow(/plugins\/full-plugin\/agents\/broken\.md: missing YAML frontmatter/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("stable pins (R15)", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";

  /** A copy of the fixture whose stable catalog pins full-plugin to `pinSha`. */
  function pinnedCopy(pinSha) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
    fs.cpSync(fixtureRoot, dir, { recursive: true });
    const file = path.join(dir, ".claude-plugin/marketplace.json");
    const mp = JSON.parse(fs.readFileSync(file, "utf8"));
    const entry = mp.plugins.find(e => e.name === "full-plugin");
    entry.source = { source: "git-subdir", url: "https://github.com/owner/repo.git", path: "plugins/full-plugin", ref: "main", sha: pinSha };
    fs.writeFileSync(file, JSON.stringify(mp));
    return dir;
  }

  it("reads the stable version from plugin.json at the pinned commit", () => {
    const dir = pinnedCopy(sha);
    const reads = [];
    const readAtCommit = (commit, file) => { reads.push([commit, file]); return JSON.stringify({ name: "full-plugin", version: "1.5.0" }); };
    const catalog = buildCatalog(dir, { repo: "owner/repo", readAtCommit });
    fs.rmSync(dir, { recursive: true, force: true });
    expect(reads).toEqual([[sha, "plugins/full-plugin/.claude-plugin/plugin.json"]]);
    expect(catalog.plugins.find(p => p.id === "full-plugin")).toMatchObject({
      external: false, stableVersion: "1.5.0", latestVersion: "2.0.0", stableCommit: sha, category: "testing", path: "plugins/full-plugin",
    });
    expect(catalog.plugins.find(p => p.id === "new-plugin").stableVersion).toBeNull();
    expect(catalog.artifacts.some(a => a.id === "full-plugin/skill/main-skill")).toBe(true);
  });

  it("fails the build when the pinned commit cannot be read, rather than guessing", () => {
    const dir = pinnedCopy(sha);
    const readAtCommit = () => { throw new Error("fatal: invalid object name"); };
    expect(() => buildCatalog(dir, { readAtCommit })).toThrow(/full-plugin.*cannot read plugins\/full-plugin\/\.claude-plugin\/plugin\.json at 0123456/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails the build when a pin has no full sha", () => {
    const dir = pinnedCopy("abc123");
    expect(() => buildCatalog(dir, { readAtCommit: () => "{}" })).toThrow(/a pin needs a full 40-character sha/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads pinned commits from git by default", () => {
    const dir = pinnedCopy(sha);
    const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.name=Tests", "-c", "user.email=tests@example.com", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" }).trim();
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "fixture at 2.0.0");
    const head = git("rev-parse", "HEAD");
    const manifestFile = path.join(dir, "plugins/full-plugin/.claude-plugin/plugin.json");
    fs.writeFileSync(manifestFile, fs.readFileSync(manifestFile, "utf8").replace('"2.0.0"', '"2.1.0"'));
    const mpFile = path.join(dir, ".claude-plugin/marketplace.json");
    fs.writeFileSync(mpFile, fs.readFileSync(mpFile, "utf8").replace(sha, head));
    const catalog = buildCatalog(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    expect(catalog.plugins.find(p => p.id === "full-plugin")).toMatchObject({ stableVersion: "2.0.0", latestVersion: "2.1.0", stableCommit: head });
  });
});
