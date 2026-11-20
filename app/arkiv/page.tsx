import type { Metadata } from "next";
import { databaseRpc } from "@/lib/database-rpc";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nyhedsarkiv | ØL.dk",
  description: "Gå på opdagelse i over 14.000 tidligere danske nyheder. Bladr kronologisk i ØL.dk's arkiv og læs originalartiklerne hos udgiverne."
};

const PAGE_SIZE = 100;
type ArchiveArticle = {
  id: number;
  url: string;
  title: string;
  source: string;
  sourceMethod?: string;
  category?: string;
  publishedAt?: string;
  andersOnly?: boolean;
};

function safeLink(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const link = new URL(raw);
    return link.protocol === "https:" && !link.username && !link.password;
  } catch { return false; }
}

function publishedDate(raw?: string) {
  if (!raw) return "Dato ukendt";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Dato ukendt";
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

async function archivePage(page: number): Promise<{ articles: ArchiveArticle[]; count: number } | null> {
  try {
    const response = await databaseRpc("oeldk_archive_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error("Database " + response.status);
    const data = await response.json();
    if (!data || !Array.isArray(data.stories) || !Number.isFinite(Number(data.totalCount))) {
      throw new Error("Invalid archive response");
    }
    const articles = (data.stories as ArchiveArticle[]).filter(row =>
      row && typeof row.title === "string" && row.title.trim().length >= 5 &&
      safeLink(row.url)
    );
    return { articles, count: Number(data.totalCount) };
  } catch (error) {
    console.error("Archive page failed", String(error));
    return null;
  }
}

function pageHref(page: number) {
  return page === 1 ? "/arkiv" : "/arkiv?side=" + page;
}

export default async function Archive({
  searchParams
}: {
  searchParams: Promise<{ side?: string | string[] }>;
}) {
  const params = await searchParams;
  const input = typeof params.side === "string" ? Number(params.side) : 1;
  const requestedPage = Number.isSafeInteger(input) ? Math.max(1, Math.min(200, input)) : 1;
  const result = await archivePage(requestedPage);
  const articleCount = result?.count ?? 0;
  const pages = Math.max(1, Math.ceil(articleCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pages);
  const articles = currentPage === requestedPage ? result?.articles ?? [] : [];
  const pageOptions = Array.from(new Set([
    1, 2, 3, 4, 5,
    Math.floor(pages / 4), Math.floor(pages / 2), Math.floor((pages * 3) / 4),
    currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2,
    pages - 1, pages
  ])).filter(page => page >= 1 && page <= pages).sort((a, b) => a - b);

  return (
    <main className="site">
      <header className="masthead shell">
        <div className="brandArea">
          <a className="logoRow logoHomeLink" href="/" aria-label="ØL.dk – seneste nyheder">
            <div className="logoBlock">ØL</div>
            <div className="siteName"><span className="siteNameAccent">.dk</span></div>
          </a>
          <div className="siteTagline"><strong><span className="brandInitial">Ø</span>jeblikkelig &amp; <span className="brandInitial">L</span>ive</strong><span className="siteTaglineSubline">Nyheder. Nu.</span></div>
        </div>
        <a className="archiveBack" href="/">← Seneste nyheder</a>
      </header>
      <div className="tealRule" />

      <section className="shell archivePage">
        <nav aria-label="Brødkrumme" className="archiveBreadcrumb">
          <a href="/">Forside</a><span aria-hidden="true">›</span><span>Nyhedsarkiv</span>
        </nav>
        <div className="archiveIntro">
          <div>
            <span className="archiveEyebrow">ØL.DK / HISTORIK</span>
            <h1>Nyhedsarkiv</h1>
            <p>Alle de ældre historier, samlet ét sted. Find den oprindelige artikel hos udgiveren – uden at vente på et AI-resumé.</p>
          </div>
          {result && <div className="archiveCount"><strong>{articleCount.toLocaleString("da-DK")}</strong><span>arkivartikler</span></div>}
        </div>

        {!result ? (
          <div className="archiveNotice" role="alert">Arkivet kunne ikke indlæses lige nu. <a href={pageHref(requestedPage)}>Prøv igen</a>.</div>
        ) : (
          <>
            <div className="archiveListHeading">
              <h2>Ældre nyheder</h2>
              <span>Side {currentPage.toLocaleString("da-DK")} af {pages.toLocaleString("da-DK")} · 100 pr. side</span>
            </div>
            <div className="archiveArticleList">
              {articles.map(article => (
                <article className="archiveArticle" key={article.id}>
                  <div className="archiveArticleMeta">
                    <span className="archiveSource">{article.source || "Ukendt medie"}</span>
                    <span>{publishedDate(article.publishedAt)}</span>
                    {article.category && <span className="archiveArticleCategory">{article.category}</span>}
                  </div>
                  <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}<span className="archiveExternal" aria-hidden="true">↗</span></a></h3>
                </article>
              ))}
              {articles.length === 0 && <p className="archiveNotice">Ingen arkivartikler på denne side. <a href="/arkiv">Start fra den nyeste</a>.</p>}
            </div>
            <nav className="archivePagination" aria-label="Sider i nyhedsarkivet">
              {currentPage > 1 && <a className="archivePageMove" href={pageHref(currentPage - 1)}>← Nyere artikler</a>}
              {pageOptions.map((page, i) => (
                <span key={page} className="archivePageLinkWrap">
                  {i > 0 && page > pageOptions[i - 1] + 1 && <span className="archiveEllipsis" aria-hidden="true">…</span>}
                  <a href={pageHref(page)} aria-current={page === currentPage ? "page" : undefined} className={page === currentPage ? "archivePageCurrent" : ""}>{page}</a>
                </span>
              ))}
              {currentPage < pages && <a className="archivePageMove" href={pageHref(currentPage + 1)}>Ældre artikler →</a>}
            </nav>
          </>
        )}
      </section>
      <footer className="footer shell"><span>© ØL.dk</span><span>Arkivet linker til originaludgiverne.</span></footer>
    </main>
  );
}
