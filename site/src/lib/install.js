// Install commands and the team settings file (spec R17, R21).

export function installCommands({ repo, marketplace, pluginIds, scope }) {
  const flag = scope === "project" ? " --scope project" : "";
  return [
    `claude plugin marketplace add ${repo}${flag}`,
    ...pluginIds.map(id => `claude plugin install ${id}@${marketplace}${flag}`),
  ].join("\n");
}

/** The .claude/settings.json that `marketplace add --scope project` plus the installs write. */
export function settingsJson({ repo, marketplace, pluginIds }) {
  return JSON.stringify(
    {
      extraKnownMarketplaces: { [marketplace]: { source: { source: "github", repo } } },
      enabledPlugins: Object.fromEntries(pluginIds.map(id => [`${id}@${marketplace}`, true])),
    },
    null,
    2,
  );
}

export function securityBadges(plugin) {
  const s = plugin.security || {};
  return [
    s.hooks?.length && `Hooks · ${s.hooks.length}`,
    s.mcpServers?.length && `MCP server · ${s.mcpServers.length}`,
    s.lspServers?.length && `LSP server · ${s.lspServers.length}`,
    s.executables?.length && `Executables · ${s.executables.length}`,
  ].filter(Boolean);
}
