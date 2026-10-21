// App-wide state: the install list (kept in localStorage), the install scope and release channel, and toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { pluginsById } from "./lib/catalog.js";

const STORE_KEY = "ddai.install-list";
const AppContext = createContext(null);

function loadSelection() {
  try {
    const ids = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter(id => pluginsById.has(id)) : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }) {
  const [selection, setSelection] = useState(loadSelection);
  const [scope, setScope] = useState("user");
  const [channel, setChannel] = useState("stable");
  const [toast, setToast] = useState(null);
  const timer = useRef();

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(selection)); } catch { /* storage unavailable */ }
  }, [selection]);

  useEffect(() => {
    const onStorage = e => { if (e.key === STORE_KEY) setSelection(loadSelection()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const notify = useCallback(message => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const toggle = useCallback(id => {
    const on = selection.includes(id);
    setSelection(on ? selection.filter(x => x !== id) : [...selection, id].sort());
    notify(on ? `${id} removed from the install list` : `${id} added to the install list`);
  }, [selection, notify]);

  const value = useMemo(
    () => ({ selection, toggle, scope, setScope, channel, setChannel, notify, toast }),
    [selection, toggle, scope, channel, notify, toast],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

/** Copy text; when the clipboard is refused, select the source element so the user can copy by hand. */
export function useCopy() {
  const { notify } = useApp();
  return useCallback((text, sourceEl) => {
    const fallback = () => {
      if (sourceEl) {
        const range = document.createRange();
        range.selectNodeContents(sourceEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        notify("Text selected. Press Ctrl+C or ⌘C to copy.");
      } else {
        notify("Copying is blocked in this browser. Select the text and copy it manually.");
      }
    };
    try {
      navigator.clipboard.writeText(text).then(() => notify("Copied to clipboard"), fallback);
    } catch {
      fallback();
    }
  }, [notify]);
}
