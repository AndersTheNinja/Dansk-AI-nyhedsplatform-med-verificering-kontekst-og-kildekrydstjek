"use client";

import { useEffect, useId, useRef, useState } from "react";

type MediaCount = { source: string; last24h: number; total: number };
const numberFormat = new Intl.NumberFormat("da-DK");

export function NewsStats({ newsCount, visitorCount, error }: { newsCount: number | null; visitorCount: number | null; error: boolean }) {
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<MediaCount[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("medier") === "1") setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/news/stats", { signal: controller.signal });
        if (!response.ok) throw new Error("Statistics unavailable");
        const data = await response.json();
        if (!Array.isArray(data.media)) throw new Error("Invalid statistics");
        setMedia(data.media.sort((a: MediaCount, b: MediaCount) => a.source.localeCompare(b.source, "da")));
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 60000);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="newsStats">
    <div className="headerStatus">
      <div className="liveStatusLine"><span className="liveDot" /> LIVE</div>
      <div className="headerStats" id="news-count"><div className="newsStatsLine">
      <button type="button" ref={toggle} className="newsStatsToggle" aria-label="Vis artikelantal pr. medie" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        {newsCount === null ? (error ? "Nyheder utilgængelige" : "Indlæser…") : `${numberFormat.format(newsCount)} nyheder`}
        <span className="newsStatsChevron" aria-hidden="true">▾</span>
      </button>
      <span> / {visitorCount === null ? "–" : numberFormat.format(visitorCount)} pers.</span>
      </div></div>
    </div>
    <div className="newsStatsPanel" id={panelId} hidden={!open}>
        {failed && <p className="newsStatsMessage" role="status">{media ? "Kunne ikke opdatere tallene. Prøver igen." : "Oversigten kunne ikke hentes. Luk og åbn for at prøve igen."}</p>}
        {!media && !failed && <p className="newsStatsMessage" role="status">Henter oversigt…</p>}
        {media && <>
          <div className="newsStatsScroll">
            <table>
              <caption className="srOnly">Antal gemte artikler pr. medie</caption>
              <thead><tr><th scope="col">Medie</th><th scope="col">Seneste 24 t.</th><th scope="col">I alt</th></tr></thead>
              <tbody>{media.map((row) => <tr key={row.source}>
                <th scope="row">{row.source}</th><td>{numberFormat.format(row.last24h)}</td><td>{numberFormat.format(row.total)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </div>
  </div>;
}
