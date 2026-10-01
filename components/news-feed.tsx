"use client";

import { useMemo, useState } from "react";
import type { Story } from "@/lib/stories";

const labels = {
  confirmed: "✓ Bekræftet",
  nuance: "! Kildekrydstjek",
  unverified: "? Én kilde"
};

const scores = {
  confirmed: "Stærk dokumentation",
  nuance: "Flere kilder",
  unverified: "Afventer krydstjek"
};

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const [category, setCategory] = useState<string>("Alle");
  const categories = ["Alle", "AI/Tech", "Erhverv", "Danmark", "Aarhus"];
  const visible = useMemo(
    () => initialStories.filter((s) => category === "Alle" || s.category === category),
    [initialStories, category]
  );

  return (
    <section className="shell">
      <div className="feedHeader">
        <div>
          <h2 className="feedTitle">Seneste nyheder</h2>
          <div className="feedSubtitle">Live danske historier · samlet og kildekrydstjekket automatisk</div>
        </div>
      </div>

      <div className="filters" aria-label="Nyhedskategorier">
        {categories.map((item) => (
          <button
            key={item}
            className={`filter ${category === item ? "active" : ""}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid">
        {visible.map((story) => (
          <article className="card" key={story.id}>
            <div className="meta">
              <strong>{story.category}</strong>
              <span>•</span>
              <span className="metaPill">{story.sourceLabel}</span>
              <span>{story.published}</span>
            </div>

            <h2>{story.title}</h2>
            <p className="summary">{story.summary}</p>

            <div className="check">
              <div className="checkTop">
                <div className="checkRow">
                  <span className={`badge ${story.verification}`}>{labels[story.verification]}</span>
                  <span>AI CHECK</span>
                </div>
                <span className="evidenceScore">{scores[story.verification]}</span>
              </div>

              <p className="summary checkText">{story.verificationText}</p>

              <div className="why">
                <strong>Hvorfor relevant</strong>
                <p className="summary">{story.why}</p>
              </div>
            </div>

            <div className="sources">
              <strong>Kilder</strong>
              {story.sources.map((source) => (
                <a className="sourceLink" key={source.url + source.label} href={source.url} target="_blank" rel="noreferrer">
                  ↗ {source.label}
                </a>
              ))}
            </div>

            <div className="actions">
              {story.sources[0] && (
                <a className="button primary" href={story.sources[0].url} target="_blank" rel="noreferrer">
                  Læs original
                </a>
              )}
              <button className="button" onClick={() => navigator.clipboard?.writeText(story.title)}>
                Kopiér overskrift
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
