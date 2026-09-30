import { NewsFeed } from "@/components/news-feed";
import { stories } from "@/lib/stories";

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div className="brand">KONTEKST</div>
        <div className="tagline">Nyheder. Krydstjekket af AI.</div>
      </header>

      <section className="hero shell">
        <p className="eyebrow">DANSK AI-NYHEDSPLATFORM</p>
        <h1>Få nyheden — og få at vide, hvad der faktisk holder.</h1>
        <p className="heroText">
          KONTEKST samler historier fra flere kilder, finder primærkilden og viser
          verificering, usikkerheder og det vigtigste, du ellers selv skulle grave frem.
        </p>
      </section>

      <NewsFeed initialStories={stories} />

      <footer className="footer shell">
        MVP · offentligt udviklingsprojekt · kilder tilhører deres respektive udgivere
      </footer>
    </main>
  );
}
