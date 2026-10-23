import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { guide } from "../lib/catalog.js";

/**
 * Replace each ```mermaid block with its diagram. Mermaid loads as its own chunk on this page only, so the
 * main bundle stays within its budget (spec R30); until it renders, or if it fails, the block shows the source.
 */
function useMermaid(ref) {
  useEffect(() => {
    const blocks = [...ref.current.querySelectorAll("pre > code.language-mermaid")];
    if (!blocks.length) return;
    let cancelled = false;
    import("mermaid").then(async ({ default: mermaid }) => {
      if (cancelled) return;
      const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default", fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        // Natural size: a wide flow scrolls sideways instead of shrinking past legibility.
        flowchart: { useMaxWidth: false } });
      for (const [i, code] of blocks.entries()) {
        try {
          const { svg } = await mermaid.render(`guide-diagram-${i}`, code.textContent);
          if (cancelled) return;
          const figure = document.createElement("figure");
          figure.className = "diagram";
          figure.innerHTML = svg;
          code.parentElement.replaceWith(figure);
          // A diagram wider than the page scrolls sideways; keyboard users reach it to scroll it (spec R29).
          if (figure.scrollWidth > figure.clientWidth) Object.assign(figure, { tabIndex: 0, ariaLabel: "Diagram, scrolls sideways" });
        } catch { /* keep the source block */ }
      }
    }).catch(() => { /* keep the source blocks */ });
    return () => { cancelled = true; };
  }, [ref]);
}

export default function GuidePage() {
  const ref = useRef(null);
  useMermaid(ref);
  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Catalog</Link><span aria-hidden="true">/</span><span>How it works</span></nav>
      <header className="detail-head page-head">
        <h1 tabIndex={-1}>{guide.title}</h1>
      </header>
      <div className="prose guide" ref={ref} dangerouslySetInnerHTML={{ __html: guide.html }} />
    </div>
  );
}
