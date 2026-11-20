import type { Metadata } from "next";
import { NewsStatus } from "@/components/news-status";
import { TextSizeControl } from "@/components/text-size-control";
import { MediaStatsProvider, SidebarMediaStats } from "@/components/news-stats";
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
          <a className="logoRow logoHomeLink" href="/" aria-label="Gå til ØL.dk">
            <div className="logoBlock">ØL</div>
            <div className="siteName"><span className="siteNameAccent">.dk</span></div>
          </a>
          <div className="siteTagline"><strong><span className="brandInitial">Ø</span>jeblikkelig &amp; <span className="brandInitial">L</span>ive</strong><span className="siteTaglineSubline">Nyheder. Nu.</span></div>
        </div>
        <NewsStatus />
      </header>
      <div className="tealRule" />

      <MediaStatsProvider>
        <div className="contentShell shell">
          <section className="mainColumn" id="feed">
            <nav className="filterBar" aria-label="Nyhedsvisning">
              <a className="filterTab" href="/">Alle emner</a>
              <a className="filterTab archiveFilterLink active" href="/arkiv" aria-current="page">Nyhedsarkiv</a>
            </nav>

            <div className="sectionTitle sectionTitleRow">
              <span>Nyhedsarkiv <span className="sectionTitleNote">
                {result ? "(" + articleCount.toLocaleString("da-DK") + " ældre artikler · side " + currentPage + " af " + pages + ")" : "(midlertidigt utilgængeligt)"}
              </span></span>
            </div>

            {!result ? (
              <div className="newsLoadError" role="alert">Arkivet kunne ikke indlæses lige nu. <a href={pageHref(requestedPage)}>Prøv igen</a>.</div>
            ) : (
              <>
                <div className="storyList">
                  {articles.map(article => (
                    <article className="storyRow" key={article.id}>
                      <div className="storyContent">
                        <div className="storyMeta">
                          <span>{article.category === "AI/Tech" ? "AI" : article.category === "Danmark" ? "DK" : article.category || "DK"}</span>
                          <span>•</span>
                          <span>{article.source || "Ukendt medie"}</span>
                          <span>•</span>
                          <span className="storyDateMeta">{publishedDate(article.publishedAt)}</span>
                        </div>
                        <h2>{article.title}</h2>
                        <p className="storyArchiveLabel">Arkiv · Læs hele artiklen hos originalkilden</p>
                        <div className="scoreLine">
                          <a className="readMore" href={article.url} target="_blank" rel="noopener noreferrer">
                            <span className="readMoreText">Læs mere</span> <span className="externalArrow" aria-hidden="true">
                              <svg viewBox="0 0 16 16" focusable="false">
                                <path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5A1.75 1.75 0 0 0 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" />
                                <path d="M9 2h5v5" />
                                <path d="M14 2 7.5 8.5" />
                              </svg>
                            </span>
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                  {articles.length === 0 && <p className="newsLoadError">Ingen arkivartikler på denne side. <a href="/arkiv">Se de nyeste i arkivet</a>.</p>}
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

          <aside className="sidebar">
            <SidebarMediaStats />
            <TextSizeControl />
            <section className="sideBox">
              <h3>AI-analyse</h3>
              <div className="sideItem"><div><strong>Resumé</strong><small>Få et kort resumé af artiklen</small></div></div>
              <div className="sideItem"><div><strong>Faktatjek</strong><small>OpenAI vurderer troværdigheden af nyheden</small></div></div>
            </section>
            <section className="sideBox">
              <h3>OM ØL.DK</h3>
              <p>Redaktør og ai-geni: Anders Grønborg, info@agronborg.dk</p>
            </section>
          </aside>
        </div>
      </MediaStatsProvider>
      <footer className="footer shell">
        <span>© ØL.dk</span>
        <span>Nyhedslinks fører til originaludgiverne.</span>
      </footer>
    </main>
  );
}
