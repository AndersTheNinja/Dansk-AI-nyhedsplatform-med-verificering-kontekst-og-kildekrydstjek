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

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const [category, setCategory] = useState<string>("Alle");
  const categories = ["Alle", "AI/Tech", "Erhverv", "Danmark", "Aarhus"];
  const visible = useMemo(
    () => initialStories.filter((s) => category === "Alle" || s.category === category),
    [initialStories, category]
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

              <div className="neutralityGrid">
                <div className="neutralityMetric" title={story.neutrality.wordingNote}>
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
                </div>

                <div className="neutralityMetric" title={story.neutrality.sourcesNote}>
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
                </div>
              </div>

              <div className="storyBottom">
                <span className="neutralityHint">AI-vurdering · klik/hold over score for forklaring</span>
                {story.sources[0] && (
                  <a className="readMore" href={story.sources[0].url} target="_blank" rel="noreferrer">
                    Læs mere
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
