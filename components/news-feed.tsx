"use client";

import { useMemo, useState } from "react";
import type { Story } from "@/lib/stories";

const categoryLabel: Record<string,string> = {
  "AI/Tech": "AI",
  "Erhverv": "Erhverv",
  "Danmark": "DK",
  "Aarhus": "Aarhus"
};

function scoreClass(score: number) {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function mediaName(label: string) {
  if (/^DR\b/i.test(label)) return "Danmarks Radio";
  if (/TV\s?2/i.test(label)) return "TV2";
  if (/Berlingske/i.test(label)) return "Berlingske Tidende";
  return label;
}

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const [category, setCategory] = useState<string>("Alle");
  const [media, setMedia] = useState<string>("Alle medier");
  const categories = ["Alle", "AI/Tech", "Erhverv", "Danmark", "Aarhus"];

  const mediaOptions = useMemo(() => {
    const names = initialStories.flatMap((story) =>
      story.sources.map((source) => mediaName(source.label))
    );
    return ["Alle medier", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "da"))];
  }, [initialStories]);

  const visible = useMemo(
    () =>
      initialStories.filter((story) => {
        const matchesCategory = category === "Alle" || story.category === category;
        const matchesMedia =
          media === "Alle medier" ||
          story.sources.some((source) => mediaName(source.label) === media);
        return matchesCategory && matchesMedia;
      }),
    [initialStories, category, media]
  );

  return (
    <section id="feed">
      <div className="filterBar">
        {categories.map((item) => (
          <button
            key={item}
            className={`filterTab ${category === item ? "active" : ""}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mediaFilter" aria-label="Filtrer efter medie">
        <span className="mediaLabel">MEDIE:</span>
        {mediaOptions.map((item, index) => (
          <span key={item} className="mediaFilterItem">
            {index > 0 && <span className="mediaSeparator">•</span>}
            <button
              className={`mediaLink ${media === item ? "active" : ""}`}
              onClick={() => setMedia(item)}
            >
              {item}
            </button>
          </span>
        ))}
      </div>

      <div className="sectionTitle">Seneste nyheder</div>

      <div className="storyList">
        {visible.map((story) => (
          <article className="storyRow" key={story.id}>
            <div className="storyContent">
              <h2>{story.title}</h2>
              <div className="storyMeta">
                <span>{categoryLabel[story.category] || story.category}</span>
                <span>•</span>
                <span>{story.sourceLabel}</span>
                <span>•</span>
                <span>{story.published}</span>
              </div>
              <p>{story.summary}</p>

              {story.sources[0] && (
                <div className="readRow">
                  <a className="readMore" href={story.sources[0].url} target="_blank" rel="noreferrer">
                    Læs mere
                  </a>
                </div>
              )}

              <div className="neutralityGrid">
                <div className="neutralityMetric" tabIndex={0}>
                  <div className="neutralityTop">
                    <span>Neutralitet ift. formulering</span>
                    <strong>{story.neutrality.wording}%</strong>
                  </div>
                  <div className="neutralityTrack">
                    <span
                      className={`neutralityFill ${scoreClass(story.neutrality.wording)}`}
                      style={{ width: `${story.neutrality.wording}%` }}
                    />
                  </div>
                  <div className="scoreTooltip" role="tooltip">
                    <strong>Baggrund for scoren</strong>
                    <p>{story.neutrality.wordingNote}</p>
                    {story.neutrality.wordingExamples.length > 0 ? (
                      <ul>{story.neutrality.wordingExamples.map((example) => <li key={example}>{example}</li>)}</ul>
                    ) : (
                      <p>Ingen tydelige ladede eller absolutte ord blev fundet i den tilgængelige feedtekst.</p>
                    )}
                  </div>
                </div>

                <div className="neutralityMetric" tabIndex={0}>
                  <div className="neutralityTop">
                    <span>Neutralitet ift. andre kilder</span>
                    <strong>{story.neutrality.sources === null ? "Ikke nok data" : `${story.neutrality.sources}%`}</strong>
                  </div>
                  <div className="neutralityTrack">
                    {story.neutrality.sources === null ? (
                      <span className="neutralityFill unavailable" style={{ width: "100%" }} />
                    ) : (
                      <span
                        className={`neutralityFill ${scoreClass(story.neutrality.sources)}`}
                        style={{ width: `${story.neutrality.sources}%` }}
                      />
                    )}
                  </div>
                  <div className="scoreTooltip" role="tooltip">
                    <strong>Baggrund for scoren</strong>
                    <p>{story.neutrality.sourcesNote}</p>
                    {story.neutrality.sourcesExamples.length > 0 && (
                      <>
                        <div className="tooltipLabel">Sammenlignede kilder</div>
                        <ul>{story.neutrality.sourcesExamples.map((example) => <li key={example}>{example}</li>)}</ul>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="storyBottom">
                <span className="neutralityHint">AI-vurdering · klik/hold over score for forklaring</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
