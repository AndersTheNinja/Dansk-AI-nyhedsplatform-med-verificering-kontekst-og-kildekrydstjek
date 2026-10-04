"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

type AiAnalysis = {
  wordingScore: number;
  wordingNote: string;
  wordingExamples: string[];
  originalityScore: number | null;
  originalityNote: string;
  originalityExamples: string[];
};

function mediaName(label: string) {
  if (/^DR\b/i.test(label)) return "Danmarks Radio";
  if (/TV\s?2/i.test(label)) return "TV2";
  if (/Berlingske/i.test(label)) return "Berlingske Tidende";
  return label;
}

function StoryCard({ story }: { story: Story }) {
  const ref = useRef<HTMLElement | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [subscriptionRequired, setSubscriptionRequired] = useState<boolean | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || attempted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const cacheKey = `kontekst-ai-v2:${story.id}`;
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            setAnalysis(JSON.parse(cached));
            setAttempted(true);
            return;
          }
        } catch {}

        setAttempted(true);
        const articleUrl = story.sources[0]?.url;
        if (articleUrl) {
          fetch("/api/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: articleUrl })
          })
            .then((response) => response.ok ? response.json() : null)
            .then((result) => {
              if (result && typeof result.requiresSubscription === "boolean") {
                setSubscriptionRequired(result.requiresSubscription);
              }
            })
            .catch(() => {});
        }

        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: story.title,
            text: story.summary,
            sources: story.sources
          })
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("AI unavailable");
            return response.json();
          })
          .then((result: AiAnalysis) => {
            setAnalysis(result);
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(result));
            } catch {}
          })
          .catch(() => {});
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [story, attempted]);

  const wordingScore = analysis?.wordingScore ?? story.neutrality.wording;
  const wordingNote = analysis?.wordingNote ?? story.neutrality.wordingNote;
  const wordingExamples = analysis?.wordingExamples ?? story.neutrality.wordingExamples;
  const originalityScore = story.neutrality.sources;
  const originalityNote = story.neutrality.sourcesNote;
  const originalityExamples = story.neutrality.sourcesExamples;

  return (
    <article className="storyRow" ref={ref}>
      <div className="storyContent">
        <h2>{story.title}</h2>
        <div className="storyMeta">
          <span>{categoryLabel[story.category] || story.category}</span>
          <span>•</span>
          <span>{story.sourceLabel}</span>
          <span>•</span>
          <span>{story.published}</span>
        </div>
        <div className="summaryRow">
          <p>{story.summary}</p>
          {story.sources[0] && (
            <a className="readMore" href={story.sources[0].url} target="_blank" rel="noreferrer">
              Læs mere{subscriptionRequired === true ? " · ABB." : ""}
            </a>
          )}
        </div>

        <div className="neutralityGrid">
          <div className="neutralityMetric" tabIndex={0}>
            <div className="neutralityInline">
              <span className="neutralityLabel">Neutralitetsscore</span>
              <div className="neutralityTrack">
                <span
                  className={`neutralityFill ${scoreClass(wordingScore)}`}
                  style={{ width: `${wordingScore}%` }}
                />
              </div>
              <strong>{wordingScore}%</strong>
            </div>
            <div className="scoreTooltip" role="tooltip">
              <strong>Baggrund for scoren</strong>
              <p>{wordingNote}</p>
              {wordingExamples.length > 0 ? (
                <ul>{wordingExamples.map((example) => <li key={example}>{example}</li>)}</ul>
              ) : (
                <p>Ingen tydelige sproglige markører blev fremhævet.</p>
              )}
            </div>
          </div>

          <div className="neutralityMetric" tabIndex={0}>
            <div className="neutralityInline">
              <span className="neutralityLabel">Originalitetsscore</span>
              <div className="neutralityTrack">
                {originalityScore === null ? (
                  <span className="neutralityFill unavailable" style={{ width: "100%" }} />
                ) : (
                  <span
                    className={`neutralityFill ${scoreClass(originalityScore)}`}
                    style={{ width: `${originalityScore}%` }}
                  />
                )}
              </div>
              <strong>{originalityScore === null ? "Ikke nok data" : `${originalityScore}%`}</strong>
            </div>
            <div className="scoreTooltip" role="tooltip">
              <strong>Baggrund for scoren</strong>
              <p>{originalityNote}</p>
              {originalityExamples.length > 0 && (
                <>
                  <div className="tooltipLabel">Andre medier med samme historie</div>
                  <ul>{originalityExamples.map((example) => <li key={example}>{example}</li>)}</ul>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="storyBottom">
          <span className="neutralityHint">
            {analysis ? "AI-analyseret" : attempted ? "Basisvurdering · AI afventer/ikke aktiveret" : "Basisvurdering"}
            {" · klik/hold over score for forklaring"}
          </span>
        </div>
      </div>
    </article>
  );
}

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const router = useRouter();
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, 300000);

    return () => window.clearInterval(interval);
  }, [router]);

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
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </section>
  );
}
