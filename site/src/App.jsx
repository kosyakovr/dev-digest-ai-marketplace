import { useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Footer, Header, Toast } from "./components.jsx";
import { guide, itemsById, marketplace, pluginsById } from "./lib/catalog.js";
import ArtifactPage from "./pages/ArtifactPage.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import InstallPage from "./pages/InstallPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import PluginPage from "./pages/PluginPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";

const KINDS = { skills: "skill", agents: "agent", commands: "command" };

function pageTitle(pathname) {
  const [, section, plugin, kind, name] = pathname.split("/");
  if (section === "install") return `Install list · ${marketplace.name}`;
  if (section === "how-it-works" && guide) return `${guide.title} · ${marketplace.name}`;
  if (section === "plugins" && kind && name) {
    const a = itemsById.get(`${plugin}/${KINDS[kind]}/${name}`);
    return a ? `${a.name} (${a.type}) · ${marketplace.name}` : `Page not found · ${marketplace.name}`;
  }
  if (section === "plugins") return pluginsById.has(plugin) ? `${plugin} · ${marketplace.name}` : `Page not found · ${marketplace.name}`;
  return section ? `Page not found · ${marketplace.name}` : `${marketplace.name} catalog`;
}

/** On navigation: update the title, scroll to the top and move focus to the page heading (R16, R29). */
function usePageChange() {
  const { pathname, hash } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    document.title = pageTitle(pathname);
    if (first.current) { first.current = false; return; }
    if (!hash) window.scrollTo(0, 0);
    document.querySelector("main h1")?.focus({ preventScroll: Boolean(hash) });
  }, [pathname, hash]);
}

function useSlashShortcut() {
  useEffect(() => {
    const onKey = e => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
      const box = document.getElementById("q");
      if (box) { e.preventDefault(); box.focus(); box.select(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export default function App() {
  usePageChange();
  useSlashShortcut();
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/install" element={<InstallPage />} />
          {guide && <Route path="/how-it-works" element={<GuidePage />} />}
          <Route path="/plugins/:plugin" element={<PluginPage />} />
          <Route path="/plugins/:plugin/:kind/:name" element={<ArtifactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <Toast />
    </>
  );
}
