import { NewsFeed } from "@/components/news-feed";
import { stories } from "@/lib/stories";

export default function Home() {
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
          <div className="topStatus"><span className="liveDot" /> LIVE MVP</div>
        </div>
      </header>

      <section className="hero shell">
        <div className="heroGrid">
          <div>
            <p className="eyebrow">DANSK AI-NYHEDSPLATFORM</p>
            <h1>Få nyheden.<br/><span>Forstå den.</span></h1>
            <p className="heroText">
              KONTEKST samler historier fra flere kilder, finder primærkilden og viser
              verificering, usikkerheder og det vigtigste, du ellers selv skulle grave frem.
            </p>
            <div className="trustRow">
              <span>✓ Kildekrydstjek</span>
              <span>✓ AI-kontekst</span>
              <span>✓ Primærkilder</span>
            </div>
          </div>

          <aside className="signalCard">
            <div className="signalLabel">SÅDAN LÆSES KONTEKST</div>
            <div className="signalLine">
              <span className="signalIcon ok">✓</span>
              <div><strong>Bekræftet</strong><small>De centrale fakta understøttes af kilderne.</small></div>
            </div>
            <div className="signalLine">
              <span className="signalIcon warn">!</span>
              <div><strong>Kræver nuance</strong><small>Historien holder, men framing eller detaljer kræver kontekst.</small></div>
            </div>
            <div className="signalLine">
              <span className="signalIcon unknown">?</span>
              <div><strong>Ikke verificeret</strong><small>Der mangler troværdig dokumentation.</small></div>
            </div>
          </aside>
        </div>
      </section>

      <NewsFeed initialStories={stories} />

      <footer className="footer shell">
        <div><strong>KONTEKST</strong> · offentlig MVP</div>
        <div>Kilder og artikler tilhører deres respektive udgivere.</div>
      </footer>
    </main>
  );
}
