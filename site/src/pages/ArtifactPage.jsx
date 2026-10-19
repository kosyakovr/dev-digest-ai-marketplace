import { Link, useParams } from "react-router-dom";
import { CommandBlock, InstallPanel, TypeBadge } from "../components.jsx";
import { fileUrl, itemsById, pluginsById } from "../lib/catalog.js";
import NotFoundPage from "./NotFoundPage.jsx";

const KINDS = { skills: "skill", agents: "agent", commands: "command" };

function Usage({ artifact }) {
  if (artifact.type === "agent") {
    return (
      <>
        <p>Claude delegates to this agent when a task matches its description. You can also ask for it by name:</p>
        <CommandBlock text={`Use the ${artifact.name} agent to …`} />
      </>
    );
  }
  return (
    <>
      <p>Run it directly:</p>
      <CommandBlock text={`/${artifact.plugin}:${artifact.name}`} />
      <p className="hint">
        {artifact.type === "skill"
          ? "Or describe the task in plain words. Claude loads the skill when your request matches its description."
          : "Type the command in a Claude Code session."}
      </p>
    </>
  );
}

export default function ArtifactPage() {
  const { plugin: pluginId, kind, name } = useParams();
  const artifact = KINDS[kind] && itemsById.get(`${pluginId}/${KINDS[kind]}/${name}`);
  const plugin = pluginsById.get(pluginId);
  if (!artifact || !plugin) return <NotFoundPage />;
  const tools = artifact.tools.split(",").map(t => t.trim()).filter(Boolean);

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Catalog</Link><span aria-hidden="true">/</span>
        <Link to={`/plugins/${plugin.id}/`}>{plugin.name}</Link><span aria-hidden="true">/</span>
        <span>{artifact.name}</span>
      </nav>
      <div className="detail">
        <div className="detail-main">
          <header className="detail-head">
            <div className="row"><TypeBadge type={artifact.type} /></div>
            <h1 tabIndex={-1}>{artifact.name}</h1>
            <p className="desc">{artifact.description}</p>
          </header>

          <section className="section" aria-labelledby="use-h">
            <h2 id="use-h">How to use it</h2>
            <Usage artifact={artifact} />
          </section>

          <section className="section" aria-labelledby="facts-h">
            <h2 id="facts-h">Details</h2>
            <dl className="kv">
              <dt>Plugin</dt>
              <dd><Link to={`/plugins/${plugin.id}/`}>{plugin.name}</Link> {plugin.version && <span className="ver">v{plugin.version}</span>}</dd>
              {tools.length > 0 && <><dt>Tools</dt><dd>{tools.map(t => <span key={t} className="chip mono-chip">{t}</span>)}</dd></>}
              <dt>Source</dt>
              <dd><a className="mono" href={fileUrl(artifact.path)} target="_blank" rel="noopener">{artifact.path}</a></dd>
              {artifact.files.length > 0 && (
                <>
                  <dt>Bundled files</dt>
                  <dd>
                    <ul className="files">
                      {artifact.files.map(f => <li key={f}><a href={fileUrl(`${plugin.path}/${f}`)} target="_blank" rel="noopener">{f}</a></li>)}
                    </ul>
                  </dd>
                </>
              )}
            </dl>
          </section>

          {artifact.bodyHtml && (
            <section className="section" aria-labelledby="body-h">
              <h2 id="body-h">Instructions Claude follows</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: artifact.bodyHtml }} />
            </section>
          )}
        </div>
        <InstallPanel plugin={plugin} />
      </div>
    </div>
  );
}
