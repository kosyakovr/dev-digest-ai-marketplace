import { useId, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { componentSummary, linkFor, marketplace, plugins, pluginsById } from "./lib/catalog.js";
import { installCommands, securityBadges } from "./lib/install.js";
import { Highlight } from "./lib/highlight.jsx";
import { TYPE_LABEL } from "./lib/search.js";
import { useApp, useCopy } from "./state.jsx";

export function TypeBadge({ type }) {
  return <span className={`tbadge t-${type}`}>{TYPE_LABEL[type]}</span>;
}

export function ExternalTag({ item }) {
  return item.external ? <span className="ext-tag">External</span> : null;
}

export function CommandBlock({ text, label = "Copy" }) {
  const ref = useRef(null);
  const copy = useCopy();
  return (
    <div className="cmd">
      <pre><code ref={ref}>{text}</code></pre>
      <button type="button" className="btn" onClick={() => copy(text, ref.current)}>{label}</button>
    </div>
  );
}

export function SecurityBadges({ plugin, as: Tag = "div" }) {
  const badges = securityBadges(plugin);
  if (!badges.length) return null;
  return (
    <Tag className="sec" aria-label="Runs on your machine">
      {badges.map(b => <span key={b}>{b}</span>)}
    </Tag>
  );
}

export function AddButton({ pluginId, compact = false }) {
  const { selection, toggle } = useApp();
  const on = selection.includes(pluginId);
  const label = on ? "In install list" : compact ? "Add to list" : "Add to install list";
  return (
    <button type="button" className="btn" aria-pressed={on} onClick={() => toggle(pluginId)}>
      {on ? "✓ " : "+ "}{label}
    </button>
  );
}

export function ScopeToggle() {
  const { scope, setScope } = useApp();
  return (
    <div className="seg" role="group" aria-label="Install for">
      <button type="button" aria-pressed={scope === "user"} onClick={() => setScope("user")}>Just me</button>
      <button type="button" aria-pressed={scope === "project"} onClick={() => setScope("project")}>Team repository</button>
    </div>
  );
}

export function Card({ hit }) {
  const { item, terms } = hit;
  const plugin = item.type === "plugin" ? item : pluginsById.get(item.plugin);
  const copy = useCopy();
  const installCmd = `claude plugin install ${plugin.id}@${marketplace.name}`;
  return (
    <article className="card">
      <div className="card-top">
        <div className="tags"><TypeBadge type={item.type} /><ExternalTag item={item} /></div>
        <span className="ver">{plugin.version ? `v${plugin.version}` : ""}</span>
      </div>
      <h3 className="card-title"><Link to={linkFor(item)}><Highlight text={item.name} terms={terms} /></Link></h3>
      <p className="card-meta">
        {item.type === "plugin"
          ? item.external ? "Files hosted in another repository" : componentSummary(item.id) || "No components yet"
          : <>in <Link to={linkFor(plugin)}>{plugin.name}</Link></>}
      </p>
      <p className="card-desc"><Highlight text={item.description} terms={terms} /></p>
      <SecurityBadges plugin={plugin} />
      <div className="card-actions">
        <button type="button" className="btn" onClick={() => copy(installCmd, null)}>Copy install</button>
        <AddButton pluginId={plugin.id} compact />
      </div>
    </article>
  );
}

export function InstallPanel({ plugin }) {
  const { scope } = useApp();
  const headingId = useId();
  return (
    <aside className="panel" aria-labelledby={headingId}>
      <h2 id={headingId}>Install</h2>
      <ScopeToggle />
      <CommandBlock text={installCommands({ repo: marketplace.repo, marketplace: marketplace.name, pluginIds: [plugin.id], scope })} />
      <p className="hint">
        {scope === "project"
          ? "Run inside the repository. It writes .claude/settings.json; commit that file so teammates get the plugin after they trust the folder."
          : "Installs for your user account in every project."}
        {plugin.external ? " This plugin comes from another repository; each person installs it once." : ""}
      </p>
      <AddButton pluginId={plugin.id} />
      <p className="hint">Installing several plugins? Collect them in the <Link to="/install/">install list</Link>.</p>
    </aside>
  );
}

export function Header() {
  const { selection } = useApp();
  const count = selection.filter(id => pluginsById.has(id)).length;
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" to="/">
          <b>{marketplace.name.replace(/-ai$/, "")}<span>{marketplace.name.endsWith("-ai") ? "-ai" : ""}</span></b>
          <small>Claude Code plugins</small>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Catalog</NavLink>
          <NavLink to="/install/">Install list <span className="count" data-zero={count === 0 || undefined}>{count}</span></NavLink>
          <a href={marketplace.repoUrl} target="_blank" rel="noopener">GitHub ↗</a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const pluginCount = plugins.length;
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>
          Generated from {marketplace.repo}{marketplace.commit ? `@${marketplace.commit}` : ""} · {pluginCount} plugin{pluginCount === 1 ? "" : "s"}
        </span>
        <span>Community marketplace. Not an official Anthropic site.</span>
      </div>
    </footer>
  );
}

export function Toast() {
  const { toast } = useApp();
  return <div className="toast" role="status" aria-live="polite" hidden={!toast}>{toast}</div>;
}
