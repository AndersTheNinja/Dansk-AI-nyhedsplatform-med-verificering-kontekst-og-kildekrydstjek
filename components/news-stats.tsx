"use client";

import { useEffect, useState } from "react";

type MediaCount = { source: string; last24h: number; total: number };
const numberFormat = new Intl.NumberFormat("da-DK");

export function NewsStats({ newsCount, visitorCount, error }: { newsCount: number | null; visitorCount: number | null; error: boolean }) {
  return (
    <div className="headerStatus">
      <div className="liveStatusLine"><span className="liveDot" /> LIVE</div>
      <div className="headerStats" id="news-count">
        {newsCount === null ? (error ? "Nyheder utilgængelige" : "Indlæser…") : `${numberFormat.format(newsCount)} nyheder`}
        <span> / {visitorCount === null ? "–" : numberFormat.format(visitorCount)} pers.</span>
      </div>
    </div>
  );
}

export function SidebarMediaStats() {
  const [media, setMedia] = useState<MediaCount[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="sideBox mediaStatsBox" aria-label="Nyheder fordelt på medier">
      <h3>NYHEDER PR. MEDIE</h3>
      {failed && <p className="newsStatsMessage" role="status">{media ? "Kunne ikke opdatere tallene. Viser seneste oversigt." : "Oversigten kunne ikke hentes."}</p>}
      {!media && !failed && <p className="newsStatsMessage" role="status">Henter medieoversigt…</p>}
      {media && (
        <div className="mediaStatsScroll">
          <table className="mediaStatsTable">
            <caption className="srOnly">Antal gemte artikler pr. medie</caption>
            <thead><tr><th scope="col">Medie</th><th scope="col" title="Seneste 24 timer">24 t.</th><th scope="col">I alt</th></tr></thead>
            <tbody>{media.map(row => (
              <tr key={row.source}>
                <th scope="row">{row.source}</th>
                <td>{numberFormat.format(row.last24h)}</td>
                <td>{numberFormat.format(row.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
