// Catalog generation (spec R2-R6, R20, R22) against the real repository and a fixture marketplace.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCatalog, CatalogError, siteRoutes } from "../catalog/build-catalog.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("./fixtures/marketplace", import.meta.url));

describe("real repository", () => {
  const catalog = buildCatalog(repoRoot, { base: "/base/" });
  const marketplace = JSON.parse(fs.readFileSync(path.join(repoRoot, ".claude-plugin/marketplace.json"), "utf8"));

  it("lists every marketplace entry, and nothing else (R2)", () => {
    expect(catalog.plugins.map(p => p.id)).toEqual(marketplace.plugins.map(p => p.name));
  });

  it("finds every skill and agent in the default folders (R2)", () => {
    for (const entry of marketplace.plugins.filter(e => typeof e.source === "string")) {
      const dir = path.join(repoRoot, entry.source);
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
    expect(ext).toMatchObject({ external: true, source: "github.com/someone/elsewhere", path: "" });
    expect(catalog.artifacts.some(a => a.plugin === "external-plugin")).toBe(false);
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
