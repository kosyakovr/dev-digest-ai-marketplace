/** Wrap words that start with a matched search term in <mark> (R15). */
export function Highlight({ text, terms }) {
  const alternatives = [...new Set(terms)].filter(t => /^[a-z0-9]+$/.test(t)).sort((a, b) => b.length - a.length);
  if (!alternatives.length) return text;
  const parts = String(text).split(new RegExp(`(?<![a-z0-9])((?:${alternatives.join("|")})[a-z0-9]*)`, "gi"));
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
