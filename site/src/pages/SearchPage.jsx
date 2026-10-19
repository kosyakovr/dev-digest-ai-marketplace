import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CommandBlock } from "../components.jsx";
import { getIndex, items, itemsById, marketplace, plugins } from "../lib/catalog.js";
import { runSearch, TYPE_LABEL, TYPE_ORDER } from "../lib/search.js";

const FACETS = [["type", "Type"], ["plugin", "Plugin"], ["category", "Category"]];
const EXAMPLES = ["a skill for reviewing pull requests", "write a spec", "agent", "turn a spec into a plan"];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const FACET_VALUES = {
  type: TYPE_ORDER.filter(t => items.some(i => i.type === t)),
  plugin: plugins.map(p => p.id),
  category: [...new Set(items.map(i => i.category).filter(Boolean))].sort(),
};

function readFilters(params) {
  const get = key => new Set((params.get(key) || "").split(",").filter(Boolean));
  return { type: get("type"), plugin: get("plugin"), category: get("category") };
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const filters = useMemo(() => readFilters(params), [params]);
  const [input, setInput] = useState(q);
  const [ignoreTypeWords, setIgnoreTypeWords] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() => window.matchMedia("(min-width: 861px)").matches);
  const inputRef = useRef(null);
  const debounce = useRef();

  // Keep the box in sync when the URL changes from outside (example chips, back button).
  useEffect(() => { if (document.activeElement !== inputRef.current) setInput(q); }, [q]);
  useEffect(() => setIgnoreTypeWords(false), [q]);

  const update = (changes, { replace = true } = {}) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      const text = value instanceof Set ? [...value].join(",") : value;
      if (text) next.set(key, text); else next.delete(key);
    }
    setParams(next, { replace });
  };

  const onInput = value => {
    setInput(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() ? value : "" }), 60);
  };

  const toggleFacet = (key, value) => {
    const set = new Set(filters[key]);
    if (set.has(value)) set.delete(value); else set.add(value);
    update({ [key]: set });
  };

  const res = useMemo(
    () => runSearch(getIndex(), itemsById, q, filters, { ignoreTypeWords }),
    [q, filters, ignoreTypeWords],
  );
  const activeFilters = Object.values(filters).some(s => s.size);
  const clearFilters = () => update({ type: "", plugin: "", category: "" });

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1 tabIndex={-1}>Find plugins, skills and agents for Claude Code</h1>
          <p className="lede">Search everything in the {marketplace.name} marketplace. Describe what you need in plain words.</p>
          <form className="search" role="search" onSubmit={e => e.preventDefault()}>
            <label htmlFor="q" className="sr-only">Search the catalog</label>
            <input
              id="q" ref={inputRef} type="search" autoComplete="off" spellCheck={false}
              placeholder="Try “a skill for reviewing pull requests”"
              value={input} onChange={e => onInput(e.target.value)}
            />
            <kbd aria-hidden="true">/</kbd>
          </form>
          <div className="examples">
            <span>Try:</span>
            {EXAMPLES.map(example => (
              <button key={example} type="button" onClick={() => { setInput(example); update({ q: example }, { replace: false }); }}>{example}</button>
            ))}
          </div>
          <div className="addmp">
            <span>New here? Add the marketplace once:</span>
            <CommandBlock text={`claude plugin marketplace add ${marketplace.repo}`} />
          </div>
        </div>
      </section>

      <section className="wrap results-layout">
        <details className="filters" open={filtersOpen} onToggle={e => setFiltersOpen(e.currentTarget.open)}>
          <summary>Filters{activeFilters ? ` (${Object.values(filters).reduce((n, s) => n + s.size, 0)})` : ""}</summary>
          {FACETS.map(([key, title]) => (
            <fieldset className="facet" key={key}>
              <legend>{title}</legend>
              {FACET_VALUES[key].map(value => {
                const count = res.facets[key].get(value) || 0;
                const checked = filters[key].has(value);
                const id = `f-${key}-${value}`;
                return (
                  <label key={value} htmlFor={id} data-empty={!count && !checked ? "" : undefined}>
                    <input type="checkbox" id={id} checked={checked} onChange={() => toggleFacet(key, value)} />
                    <span>{key === "type" ? TYPE_LABEL[value] : value}</span>
                    <em>{count}</em>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </details>

        <div aria-live="polite">
          {res.implicitTypes && (
            <div className="notice">
              <span>
                Showing only {[...res.implicitTypes].map(t => `${TYPE_LABEL[t].toLowerCase()}s`).join(" and ")}, because your query mentions{" "}
                {res.implicitTypes.size > 1 ? "them" : "one"}.
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setIgnoreTypeWords(true)}>Show all types</button>
            </div>
          )}
          {res.results.length ? (
            <>
              <div className="summary">
                <p><strong>{plural(res.results.length, "result")}</strong> {q ? <>for “<strong>{q}</strong>”</> : "in the catalog"}</p>
                {activeFilters && <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>}
              </div>
              <div className="grid">{res.results.map(hit => <Card key={hit.item.id} hit={hit} />)}</div>
            </>
          ) : (
            <div className="empty">
              <h2>No matches for “{q}”</h2>
              <p>We searched the names, descriptions and instructions of {plural(res.total, "artifact")}{activeFilters ? " with your filters applied" : ""}.</p>
              <div className="actions">
                {activeFilters && <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>}
                <button type="button" className="btn btn-primary" onClick={() => { setInput(""); setParams(new URLSearchParams()); inputRef.current?.focus(); }}>
                  Browse all artifacts
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
