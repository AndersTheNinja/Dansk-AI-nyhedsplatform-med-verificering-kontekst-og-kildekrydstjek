import { NewsFeed } from "@/components/news-feed";
import { demoStories } from "@/lib/stories";
import { getLiveStories } from "@/lib/live-news";

export const revalidate = 300;

export default async function Home() {
  const liveStories = await getLiveStories().catch(() => []);
  const stories = liveStories.length ? liveStories : demoStories;

  return (
    <main>
      <header className="topbar">
        <div className="topbarInner shell">
          <div className="brandWrap">
            <div className="brandMark">K</div>
            <div>
              <div className="brand">KONTEKST</div>
              <div className="tagline">Nyheder. Krydstjekket af AI.</div>
            </div>
          </div>
          <div className="topStatus"><span className="liveDot" /> LIVE NYHEDER</div>
        </div>
      </header>

      <section className="hero shell">
        <div className="heroGrid">
          <div>
            <p className="eyebrow">DANSK AI-NYHEDSPLATFORM</p>
            <h1>Få nyheden.<br/><span>Forstå den.</span></h1>
            <p className="heroText">
              KONTEKST samler aktuelle danske historier fra flere kilder og viser,
              hvor stærkt historien foreløbigt er dokumenteret.
            </p>
            <div className="trustRow">
              <span>✓ Live nyhedsfeed</span>
              <span>✓ Kildekrydstjek</span>
              <span>✓ Tydelig usikkerhed</span>
            </div>
          </div>

          <aside className="signalCard">
            <div className="signalLabel">SÅDAN LÆSES KONTEKST</div>
            <div className="signalLine">
              <span className="signalIcon ok">✓</span>
              <div><strong>Bekræftet</strong><small>Kræver egentlig dokumentation fra primærkilder og uafhængige kilder.</small></div>
            </div>
            <div className="signalLine">
              <span className="signalIcon warn">!</span>
              <div><strong>Kildekrydstjek</strong><small>Flere medier omtaler samme historie, men alle fakta er ikke nødvendigvis verificeret endnu.</small></div>
            </div>
            <div className="signalLine">
              <span className="signalIcon unknown">?</span>
              <div><strong>Én kilde</strong><small>Historien afventer yderligere dokumentation.</small></div>
            </div>
          </aside>
        </div>
      </section>

      <NewsFeed initialStories={stories} />

      <footer className="footer shell">
        <div><strong>KONTEKST</strong> · offentlig MVP</div>
        <div>Nyhedslinks fører til originaludgiverne. Feed opdateres cirka hvert 5. minut.</div>
      </footer>
    </main>
  );
}
