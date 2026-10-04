import { NewsFeed } from "@/components/news-feed";
import { demoStories } from "@/lib/stories";
import { getLiveStories } from "@/lib/live-news";

export const revalidate = 300;

export default async function Home() {
  const liveStories = await getLiveStories().catch(() => []);
  const stories = liveStories.length ? liveStories : demoStories;
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const stories24h = stories.filter((story) => {
    if (!story.publishedAt) return false;
    const time = new Date(story.publishedAt).getTime();
    return Number.isFinite(time) && time >= cutoff24h;
  }).length;

  return (
    <main className="site">
      <header className="masthead shell">
        <div className="logoRow">
          <div className="logoBlock">K</div>
          <div>
            <div className="siteName">KONTEKST<span>News</span></div>
            <div className="siteTagline">Danske nyheder med objektivitets-score • Redaktør og Ai-geni: Anders Grønborg</div>
          </div>
        </div>
        <div className="headerStatus">
          <div className="liveStatusLine"><span className="liveDot" /> LIVE</div>
          <div className="headerStats">
            <span>{stories.length} nyheder i alt</span>
            <span>{stories24h} nyheder 24 t.</span>
          </div>
        </div>
      </header>

      <div className="tealRule" />

      <div className="contentShell shell">
        <section className="mainColumn">
          <NewsFeed initialStories={stories} />
        </section>

        <aside className="sidebar">
          <section className="sideBox">
            <h3>AI CHECK</h3>
            <div className="sideItem"><span className="dot ok">✓</span><div><strong>Bekræftet</strong><small>Understøttet af primærkilder og uafhængige kilder.</small></div></div>
            <div className="sideItem"><span className="dot warn">!</span><div><strong>Kildekrydstjek</strong><small>Flere medier omtaler samme historie.</small></div></div>
            <div className="sideItem"><span className="dot neutral">?</span><div><strong>Én kilde</strong><small>Historien afventer mere dokumentation.</small></div></div>
          </section>

          <section className="sideBox">
            <h3>OM KONTEKST</h3>
            <p>Vi samler historier, viser kilderne og markerer tydeligt, hvor stærkt en historie foreløbigt er dokumenteret.</p>
          </section>
        </aside>
      </div>

      <footer className="footer shell">
        <span>© KONTEKST</span>
        <span>Nyhedslinks fører til originaludgiverne.</span>
      </footer>
    </main>
  );
}
