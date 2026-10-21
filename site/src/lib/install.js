// Install commands and the team settings file (spec R17, R21), per release channel (release-channels R15).

export const CHANNELS = ["stable", "latest"];

/** The `marketplace add` source: owner/repo, plus #ref for a channel served from its own branch. */
const addSource = (repo, ref) => (ref ? `${repo}#${ref}` : repo);

export function installCommands({ repo, ref = "", marketplace, pluginIds, scope }) {
  const flag = scope === "project" ? " --scope project" : "";
  return [
    `claude plugin marketplace add ${addSource(repo, ref)}${flag}`,
    ...pluginIds.map(id => `claude plugin install ${id}@${marketplace}${flag}`),
  ].join("\n");
}

/** The .claude/settings.json that `marketplace add --scope project` plus the installs write, with background
 * auto-update turned on: it is off by default for third-party marketplaces. */
export function settingsJson({ repo, ref = "", marketplace, pluginIds }) {
  return JSON.stringify(
    {
      extraKnownMarketplaces: { [marketplace]: { source: { source: "github", repo, ...(ref && { ref }) }, autoUpdate: true } },
      enabledPlugins: Object.fromEntries(pluginIds.map(id => [`${id}@${marketplace}`, true])),
    },
    null,
    2,
  );
}

/** Whether a channel's catalog lists the plugin. The catalog sets a channel's version to null when it does not. */
export function inChannel(plugin, channel) {
  return (channel === "latest" ? plugin.latestVersion : plugin.stableVersion) != null;
}

/** The channel to install from: the chosen one when it lists the plugin, otherwise the one that does. */
export function channelFor(plugin, preferred) {
  return inChannel(plugin, preferred) ? preferred : CHANNELS.find(c => inChannel(plugin, c)) || preferred;
}

/** Whether each teammate installs the plugin once: a project settings file alone installs only a plugin the
 * marketplace lists by relative path, so not a stable pin (a git-subdir at a commit) or a plugin hosted elsewhere. */
export function needsOwnInstall(plugin, channel) {
  return Boolean(plugin.external || (channel === "stable" && plugin.stableCommit));
}

/** What to say instead of an install command for plugins the chosen channel does not list. */
export function notInChannel(names, channel) {
  const them = names.length === 1 ? "it" : "them";
  const are = names.length === 1 ? "is" : "are";
  return channel === "stable"
    ? `${names.join(", ")} ${are} not in the stable channel yet (latest only). Choose Latest to install ${them}.`
    : `${names.join(", ")} ${are} listed only in the stable channel. Choose Stable to install ${them}.`;
}

export const CHANNEL_HINT = {
  stable: "Stable gets a plugin version once it is promoted.",
  latest: "Latest gets every new plugin and version as soon as it is merged to main.",
};

/** "stable 1.1.0 · latest 1.2.0", or "latest only · 1.0.0" for a plugin that is not promoted yet. */
export function versionLabel(plugin) {
  const { stableVersion: stable, latestVersion: latest } = plugin;
  if (stable == null) return latest ? `latest only · ${latest}` : "";
  return [stable && `stable ${stable}`, latest && `latest ${latest}`].filter(Boolean).join(" · ");
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
