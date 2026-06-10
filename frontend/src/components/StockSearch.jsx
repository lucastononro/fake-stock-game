import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

/** Debounced ticker search box; calls onSelect(ticker) when a result is picked. */
export default function StockSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api.searchStocks(query.trim()));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query]);

  function pick(ticker) {
    onSelect(ticker);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="stock-search">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stocks (e.g. Apple, TSLA)…"
      />
      {searching && <p className="muted search-status">Searching…</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((result) => (
            <li key={result.ticker}>
              <button type="button" className="search-result" onClick={() => pick(result.ticker)}>
                <strong>{result.ticker}</strong> {result.name}{" "}
                <span className="muted">
                  {result.exchange} · {result.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
