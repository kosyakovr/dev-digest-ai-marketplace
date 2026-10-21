// Install commands and the team settings file (spec R21), per release channel (release-channels R15).
import { describe, expect, it } from "vitest";
import { channelFor, inChannel, installCommands, notInChannel, securityBadges, settingsJson, versionLabel } from "../src/lib/install.js";

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

describe("release channels", () => {
  const latest = { repo: "kosyakovr/dev-digest-ai-marketplace", ref: "latest", marketplace: "dev-digest-ai-latest" };
  const stableRef = { repo: "kosyakovr/dev-digest-ai-marketplace", ref: "", marketplace: "dev-digest-ai" };
  const promoted = { stableVersion: "1.1.0", latestVersion: "1.2.0" };
  const latestOnly = { stableVersion: null, latestVersion: "0.3.0" };
  const external = { stableVersion: "", latestVersion: null };

  it("adds the stable marketplace from the default branch", () => {
    expect(installCommands({ ...stableRef, pluginIds: ["research-tools"], scope: "user" }).split("\n")).toEqual([
      "claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace",
      "claude plugin install research-tools@dev-digest-ai",
    ]);
  });

  it("adds the latest marketplace from its branch and installs from it", () => {
    expect(installCommands({ ...latest, pluginIds: ["new-plugin", "research-tools"], scope: "project" }).split("\n")).toEqual([
      "claude plugin marketplace add kosyakovr/dev-digest-ai-marketplace#latest --scope project",
      "claude plugin install new-plugin@dev-digest-ai-latest --scope project",
      "claude plugin install research-tools@dev-digest-ai-latest --scope project",
    ]);
  });

  it("writes team settings for the latest marketplace with its ref", () => {
    expect(JSON.parse(settingsJson({ ...latest, pluginIds: ["new-plugin"] }))).toEqual({
      extraKnownMarketplaces: { "dev-digest-ai-latest": { source: { source: "github", repo: "kosyakovr/dev-digest-ai-marketplace", ref: "latest" } } },
      enabledPlugins: { "new-plugin@dev-digest-ai-latest": true },
    });
    expect(JSON.parse(settingsJson({ ...stableRef, pluginIds: ["research-tools"] })).extraKnownMarketplaces).toEqual({
      "dev-digest-ai": { source: { source: "github", repo: "kosyakovr/dev-digest-ai-marketplace" } },
    });
  });

  it("does not offer a latest-only plugin from stable, and says why", () => {
    expect(inChannel(latestOnly, "stable")).toBe(false);
    expect(inChannel(latestOnly, "latest")).toBe(true);
    expect(inChannel(promoted, "stable")).toBe(true);
    expect(inChannel(external, "stable")).toBe(true);
    expect(inChannel(external, "latest")).toBe(false);
    expect(channelFor(latestOnly, "stable")).toBe("latest");
    expect(channelFor(promoted, "stable")).toBe("stable");
    expect(notInChannel(["new-plugin"], "stable")).toBe("new-plugin is not in the stable channel yet (latest only). Choose Latest to install it.");
    expect(notInChannel(["a", "b"], "latest")).toBe("a, b are listed only in the stable channel. Choose Stable to install them.");
  });

  it("labels each plugin's version per channel", () => {
    expect(versionLabel(promoted)).toBe("stable 1.1.0 · latest 1.2.0");
    expect(versionLabel(latestOnly)).toBe("latest only · 0.3.0");
    expect(versionLabel({ stableVersion: "1.0.0", latestVersion: null })).toBe("stable 1.0.0");
    expect(versionLabel(external)).toBe("");
  });
});
