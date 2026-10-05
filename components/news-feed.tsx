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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ summary: string; bullets: string[]; basis?: string } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [factOpen, setFactOpen] = useState(false);
  const [factLoading, setFactLoading] = useState(false);
  const [factCheck, setFactCheck] = useState<{ verdict: string; score: number; explanation: string; claims: string[] } | null>(null);
  const [factError, setFactError] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || attempted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

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

  async function toggleSummary() {
    const nextOpen = !summaryOpen;
    setSummaryOpen(nextOpen);
    if (!nextOpen || aiSummary || summaryLoading) return;

    // A previous failure must never permanently disable the control.
    setSummaryError(null);

    const articleUrl = story.sources[0]?.url;
    if (!articleUrl) {
      setSummaryError("Der er ikke noget artikel-link at opsummere.");
      return;
    }

    const cacheKey = `kontekst-summary-v1:${story.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAiSummary(JSON.parse(cached));
        return;
      }
    } catch {}

    setSummaryLoading(true);

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: articleUrl,
          title: story.title,
          source: story.sources[0]?.label ?? story.sourceLabel,
          feedText: story.summary
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Resuméet kunne ikke laves.");
      }

      setAiSummary(result);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      } catch {}
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Resuméet kunne ikke laves.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function toggleFactCheck() {
    const nextOpen = !factOpen;
    setFactOpen(nextOpen);
    if (!nextOpen || factCheck || factLoading) return;

    const cacheKey = `kontekst-fact-v1:${story.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setFactCheck(JSON.parse(cached));
        return;
      }
    } catch {}

    setFactLoading(true);
    setFactError(null);

    try {
      const response = await fetch("/api/factcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: story.title,
          text: aiSummary?.summary || story.summary,
          sources: story.sources
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Faktatjekket kunne ikke laves.");
      setFactCheck(result);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      } catch {}
    } catch (error) {
      setFactError(error instanceof Error ? error.message : "Faktatjekket kunne ikke laves.");
    } finally {
      setFactLoading(false);
    }
  }

  return (
    <article className="storyRow" ref={ref}>
      <div className="storyContent">
        <div className="storyMeta">
          <span>{categoryLabel[story.category] || story.category}</span>
          <span>•</span>
          <span>{story.sourceLabel}</span>
          <span>•</span>
          <span>
            {story.published}
            {story.publishedDate ? ` · ${story.publishedDate}` : ""}
            {story.sourceMethod ? ` · ${story.sourceMethod}` : ""}
          </span>
        </div>
        <h2>{story.title}</h2>
        <div className="summaryRow">
          <p>{story.summary}</p>
        </div>

        <div className="scoreLine">
          <button
            type="button"
            className="aiSummaryButton"
            onClick={toggleSummary}
            aria-expanded={summaryOpen}
          >
            <span className="actionLinkText">Resumé</span><span className={`summaryChevron ${summaryOpen ? "open" : ""}`}>⌄</span>
          </button>
          <button
            type="button"
            className="aiCheckLink"
            onClick={toggleFactCheck}
            aria-expanded={factOpen}
          >
            <span className="actionLinkText">Faktatjek</span><span className={`summaryChevron ${factOpen ? "open" : ""}`}>⌄</span>
          </button>
          {story.sources[0] && subscriptionRequired !== null && (
            <a className="readMore" href={story.sources[0].url} target="_blank" rel="noreferrer">
              <span className="readMoreText">Læs mere</span> <span className="readMoreAccess">({subscriptionRequired ? "kræver abb." : "gratis"})</span> <span className="externalTextArrow" aria-hidden="true">↗</span>
            </a>
          )}
        </div>

        <div className={`aiSummaryPanel ${summaryOpen ? "open" : ""}`}>
          <div className="aiSummaryInner">
            <div className="aiSummaryHeader">Resumé</div>
            {summaryLoading && <p className="aiSummaryStatus">Henter artikel og laver resumé…</p>}
            {summaryError && <p className="aiSummaryError">{summaryError}</p>}
            {aiSummary && (
              <>
                <p>{aiSummary.summary}</p>
                {aiSummary.bullets.length > 0 && (
                  <ul>
                    {aiSummary.bullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                <div className="aiSummaryFoot">
                  Resumé baseret på {aiSummary.basis || "frit tilgængelig tekst"}.
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`aiSummaryPanel factPanel ${factOpen ? "open" : ""}`}>
          <div className="aiSummaryInner">
            <div className="aiSummaryHeader">Faktatjek</div>
            {factLoading && <p className="aiSummaryStatus">Tjekker påstandene…</p>}
            {factError && <p className="aiSummaryError">{factError}</p>}
            {factCheck && (
              <>
                <div className="factVerdict">
                  <span className={`factBadge ${factCheck.verdict}`}>{factCheck.verdict}</span>
                  <strong>{factCheck.score}%</strong>
                </div>
                <p>{factCheck.explanation}</p>
                {factCheck.claims.length > 0 && (
                  <ul>
                    {factCheck.claims.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                <div className="aiSummaryFoot">
                  AI-vurdering af det tilgængelige materiale — ikke en endelig sandhedsdom.
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("Alle emner");
  const [media, setMedia] = useState<string>("Alle medier");
  const categories = ["Alle emner", "AI/Tech", "Erhverv", "Danmark", "Aarhus"];

  const mediaOptions = useMemo(() => {
    const names = initialStories.flatMap((story) =>
      story.sources.map((source) => mediaName(source.label))
    );
    return ["Alle medier", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "da"))];
  }, [initialStories]);

  const visible = useMemo(
    () =>
      initialStories.filter((story) => {
        const matchesCategory = category === "Alle emner" || story.category === category;
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
      <div className="filterLabel">Pick ’n’ mix</div>
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
