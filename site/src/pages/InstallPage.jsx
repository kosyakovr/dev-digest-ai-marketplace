import { Link } from "react-router-dom";
import { ChannelToggle, CommandBlock, ExternalTag, ScopeToggle, SecurityBadges } from "../components.jsx";
import { marketplace, plugins, pluginsById } from "../lib/catalog.js";
import { CHANNEL_HINT, inChannel, installCommands, needsOwnInstall, notInChannel, settingsJson, versionLabel } from "../lib/install.js";
import { useApp } from "../state.jsx";

function downloadFile(name, text) {
  const url = URL.createObjectURL(new Blob([text + "\n"], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function InstallPage() {
  const { selection, toggle, scope, channel } = useApp();
  const ids = selection.filter(id => pluginsById.has(id));
  // A channel installs only what its catalog lists: no command for a latest-only plugin from stable.
  const installable = ids.filter(id => inChannel(pluginsById.get(id), channel));
  const missing = ids.filter(id => !installable.includes(id));
  const ownInstall = installable.filter(id => needsOwnInstall(pluginsById.get(id), channel));
  const mp = marketplace.channels[channel];
  const args = { ...mp, pluginIds: installable };
  const settings = settingsJson(args);

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Catalog</Link><span aria-hidden="true">/</span><span>Install list</span></nav>
      <header className="detail-head page-head">
        <h1 tabIndex={-1}>Install list</h1>
        <p className="desc muted">Pick plugins, then copy the commands, or a settings file for your team's repository.</p>
      </header>
      <div className="builder">
        <section aria-labelledby="pick-h">
          <h2 id="pick-h" className="sr-only">Plugins</h2>
          <div className="pick">
            {plugins.map(p => (
              <label key={p.id} htmlFor={`sel-${p.id}`}>
                <input type="checkbox" id={`sel-${p.id}`} checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
                <b>{p.name}</b>
                <span className="ver">{versionLabel(p) || <ExternalTag item={p} />}</span>
                <span className="pdesc">{p.description}</span>
                <span className="pdesc"><SecurityBadges plugin={p} as="span" /></span>
              </label>
            ))}
          </div>
        </section>

        <section className="out" aria-labelledby="out-h">
          <h2 id="out-h">{ids.length ? `${ids.length} plugin${ids.length === 1 ? "" : "s"} selected` : "Commands"}</h2>
          {!ids.length ? (
            <div className="empty">
              <h3>Your install list is empty</h3>
              <p>Tick plugins on the left, or use “Add to list” on any card in the catalog.</p>
              <Link className="btn btn-primary" to="/">Browse the catalog</Link>
            </div>
          ) : (
            <>
              <div className="toggles"><ChannelToggle /><ScopeToggle /></div>
              <p className="hint">
                {CHANNEL_HINT[channel]} Register one channel only: with both marketplaces added, each plugin installs twice.
              </p>
              {missing.length > 0 && <p className="notice">{notInChannel(missing, channel)}</p>}
              {installable.length > 0 && (
                <>
                  <div className="step">
                    <h3><span>1</span>{scope === "project" ? "Run once inside the repository" : "Run in any terminal"}</h3>
                    <CommandBlock text={installCommands({ ...args, scope })} />
                  </div>
                  {scope === "project" ? (
                    <>
                      <div className="step">
                        <h3><span>2</span>Commit <code>.claude/settings.json</code></h3>
                        <p className="hint">Step 1 writes this file. To set it up by hand instead, merge this into the file and commit it.</p>
                        <CommandBlock text={settings} label="Copy JSON" />
                        <div><button type="button" className="btn" onClick={() => downloadFile("settings.json", settings)}>Download settings.json</button></div>
                      </div>
                      <div className="step">
                        <h3><span>3</span>What teammates see</h3>
                        <p className="hint">
                          After they trust the folder, Claude Code adds the marketplace with auto-update on
                          {ownInstall.length < installable.length && <> and enables the plugins it lists by path</>}.
                          {ownInstall.length > 0 && <> The settings file alone does not install {ownInstall.join(", ")}: each teammate runs <code>claude plugin install &lt;name&gt;@{mp.marketplace} --scope project</code> once.</>}
                          {" "}After that, auto-update keeps the plugins current; a running session picks an update up after <code>/reload-plugins</code>.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="hint">
                      Plugins from third-party marketplaces do not auto-update by default. Turn it on in <code>/plugin</code> → Marketplaces,
                      or run <code>claude plugin marketplace update {mp.marketplace}</code>.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
