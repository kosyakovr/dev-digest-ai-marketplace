// Install commands and the team settings file (spec R21).
import { describe, expect, it } from "vitest";
import { installCommands, securityBadges, settingsJson } from "../src/lib/install.js";

const args = { repo: "kosyakovr/dev-digest-ai-marketplace", marketplace: "dev-digest-ai", pluginIds: ["architecture-review", "sdd-engineering"] };

describe("install list output", () => {
  it("adds --scope project to every command for a team repository", () => {
    expect(installCommands({ ...args, scope: "project" }).split("\n")).toEqual([
      "claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace --scope project",
      "claude plugin install architecture-review@dev-digest-ai --scope project",
      "claude plugin install sdd-engineering@dev-digest-ai --scope project",
    ]);
  });

  it("writes the settings that `marketplace add --scope project` and the installs produce", () => {
    expect(JSON.parse(settingsJson(args))).toEqual({
      extraKnownMarketplaces: { "dev-digest-ai": { source: { source: "github", repo: "kosyakovr/dev-digest-ai-marketplace" } } },
      enabledPlugins: { "architecture-review@dev-digest-ai": true, "sdd-engineering@dev-digest-ai": true },
    });
  });

  it("labels only the security-relevant parts a plugin has", () => {
    expect(securityBadges({ security: { hooks: [{}], mcpServers: [], lspServers: [], executables: ["x", "y"] } })).toEqual(["Hooks · 1", "Executables · 2"]);
    expect(securityBadges({ security: { hooks: [], mcpServers: [], lspServers: [], executables: [] } })).toEqual([]);
  });
});
