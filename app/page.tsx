import { NewsLoader } from "@/components/news-loader";
import { TextSizeControl } from "@/components/text-size-control";

export const revalidate = 300;

export default function Home() {
  return (
    <main className="site">
      <header className="masthead shell">
        <div className="brandArea">
          <div className="logoRow">
            <div className="logoBlock">ØL</div>
            <div className="siteName"><span className="siteNameAccent">.dk</span></div>
          </div>
          <div className="siteTagline"><strong>ØL.dk — Øjeblikkelig &amp; Lødig</strong><br />Nyheder med resumé og faktatjek.</div>
        </div>
        <div className="headerStatus">
          <div className="liveStatusLine"><span className="liveDot" /> LIVE</div>
          <div className="headerStats">
            <span id="news-count">Indlæser nyheder…</span>
          </div>
        </div>
      </header>

      <div className="tealRule" />

      <div className="contentShell shell">
        <section className="mainColumn">
          <NewsLoader />
        </section>

        <aside className="sidebar">
          <TextSizeControl />
          <section className="sideBox">
            <h3>AI CHECK</h3>
            <div className="sideItem"><div><strong>Resumé</strong><small>Få et kort resumé af artiklen</small></div></div>
            <div className="sideItem"><div><strong>Faktatjek</strong><small>OpenAI vurderer troværdigheden af nyheden</small></div></div>
          </section>

          <section className="sideBox">
            <h3>OM ØL.DK</h3>
            <p>Redaktør og ai-geni: Anders Grønborg, info@agronborg.dk</p>
          </section>
        </aside>
      </div>

      <footer className="footer shell">
        <span>© ØL.dk</span>
        <span>Nyhedslinks fører til originaludgiverne.</span>
      </footer>
    </main>
  );
}
