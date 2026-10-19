import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ExternalTag, InstallPanel, SecurityBadges, TypeBadge } from "../components.jsx";
import { componentsOf, fileUrl, linkFor, pluginsById } from "../lib/catalog.js";
import NotFoundPage from "./NotFoundPage.jsx";

function SecuritySection({ plugin }) {
  const s = plugin.security;
  const groups = [
    ["Hook", s.hooks.map(h => ({ title: `${h.event}${h.matcher ? ` · matcher “${h.matcher}”` : ""}`, code: h.command }))],
    ["MCP server", s.mcpServers.map(m => ({ title: m.name, code: m.command }))],
    ["LSP server", s.lspServers.map(l => ({ title: l.name, code: l.command }))],
    ["Executable added to PATH", s.executables.map(e => ({ title: e, code: `bin/${e}` }))],
  ].filter(([, list]) => list.length);

  let body;
  if (plugin.external) {
    body = <p className="hint">This plugin's files live in another repository, so the catalog cannot inspect them. Review its source before installing.</p>;
  } else if (groups.length) {
    body = (
      <>
        <p className="hint">These run on your machine with your permissions, outside Claude's sandbox.</p>
        <div className="sec-list">
          {groups.flatMap(([title, list]) => list.map((x, i) => (
            <div className="sec-item" key={`${title}-${i}`}>
              <h3>{title}: {x.title}</h3>
              {x.code && <code>{x.code}</code>}
            </div>
          )))}
        </div>
      </>
    );
  } else {
    body = (
      <div className="sec-ok">
        <b aria-hidden="true">✓</b>
        <p><strong>No hooks, MCP servers or executables.</strong> This plugin only adds instructions for Claude (skills, agents and commands).</p>
      </div>
    );
  }
  return (
    <section className="section" id="security" aria-labelledby="sec-h">
      <h2 id="sec-h">What runs on your machine</h2>
      {body}
    </section>
  );
}

export default function PluginPage() {
  const { plugin: id } = useParams();
  const { hash } = useLocation();
  const plugin = pluginsById.get(id);

  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash, id]);
  if (!plugin) return <NotFoundPage />;
  const comps = componentsOf(plugin.id);

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Catalog</Link><span aria-hidden="true">/</span><span>{plugin.name}</span></nav>
      <div className="detail">
        <div className="detail-main">
          <header className="detail-head">
            <div className="row"><TypeBadge type="plugin" /><ExternalTag item={plugin} /></div>
            <h1 tabIndex={-1}>{plugin.name}</h1>
            <p className="desc">{plugin.description}</p>
            <div className="row">
              {plugin.version && <span className="chip mono-chip">v{plugin.version}</span>}
              {plugin.category && <span className="chip">{plugin.category}</span>}
              <SecurityBadges plugin={plugin} />
            </div>
          </header>

          {plugin.external ? (
            <section className="section">
              <h2>Source</h2>
              <p>Listed in this marketplace, hosted at <code>{plugin.source}</code>. The catalog shows the marketplace entry only.</p>
            </section>
          ) : (
            <section className="section" aria-labelledby="comp-h">
              <h2 id="comp-h">Components</h2>
              {comps.length ? (
                <div className="comp-list">
                  {comps.map(c => (
                    <div className="comp" key={c.id}>
                      <TypeBadge type={c.type} />
                      <Link to={linkFor(c)}>{c.name}</Link>
                      <p>{c.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="hint">This plugin has no components yet.</p>}
            </section>
          )}

          <SecuritySection plugin={plugin} />

          {plugin.readmeHtml && (
            <section className="section" aria-labelledby="readme-h">
              <h2 id="readme-h">README</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: plugin.readmeHtml }} />
            </section>
          )}
          {plugin.changelogHtml && (
            <section className="section" aria-labelledby="cl-h">
              <h2 id="cl-h">Changelog</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: plugin.changelogHtml }} />
            </section>
          )}
          {plugin.path && <p><a href={fileUrl(plugin.path, "tree")} target="_blank" rel="noopener">View source on GitHub ↗</a></p>}
        </div>
        <InstallPanel plugin={plugin} />
      </div>
    </div>
  );
}
