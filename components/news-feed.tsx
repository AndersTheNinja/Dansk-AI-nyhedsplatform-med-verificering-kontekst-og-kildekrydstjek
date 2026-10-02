"use client";

import { useMemo, useState } from "react";
import type { Story } from "@/lib/stories";

const labels = {
  confirmed: "✓ Bekræftet",
  nuance: "! Kildekrydstjek",
  unverified: "? Én kilde"
};

const categoryGlyph: Record<string,string> = {
  "AI/Tech": "AI",
  "Erhverv": "E",
  "Danmark": "DK",
  "Aarhus": "A"
};

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
            <div className={`thumb thumb-${story.category.replace(/[^a-z]/gi,"").toLowerCase()}`}>
              <span>{categoryGlyph[story.category] || "K"}</span>
            </div>

            <div className="storyContent">
              <h2>{story.title}</h2>
              <div className="storyMeta">
                <span>{story.sourceLabel}</span>
                <span>•</span>
                <span>{story.published}</span>
                <span>•</span>
                <span>{story.category}</span>
              </div>
              <p>{story.summary}</p>
              <div className="storyBottom">
                <span className={`miniBadge ${story.verification}`}>{labels[story.verification]}</span>
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
