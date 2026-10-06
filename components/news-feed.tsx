"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Story } from "@/lib/stories";

const categoryLabel: Record<string,string> = {
  "AI/Tech": "AI",
  "Erhverv": "Erhverv",
  "Danmark": "DK",
  "Aarhus": "Aarhus"
};

function storyTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mediaName(label: string) {
  if (/^DR\b|Danmarks Radio/i.test(label)) return "DR";
  if (/TV\s?2/i.test(label)) return "TV2.dk";
  if (/Berlingske/i.test(label)) return "Berlingske";
  if (/Fyens Stiftstidende|Fyens Stiftstids?\.?/i.test(label)) return "Fyens.dk";
  return label;
}

function StoryCard({ story }: { story: Story }) {
  const ref = useRef<HTMLElement | null>(null);
  const summaryTextRef = useRef<HTMLParagraphElement | null>(null);
   const [subscriptionRequired, setSubscriptionRequired] = useState<boolean | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ summary: string; bullets: string[]; basis?: string } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [summaryHasOverflow, setSummaryHasOverflow] = useState(false);
  const [factOpen, setFactOpen] = useState(false);
  const [factLoading, setFactLoading] = useState(false);
  const [factCheck, setFactCheck] = useState<{ verdict: string; score: number; explanation: string; claims: string[] } | null>(null);
  const [factError, setFactError] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || subscriptionRequired !== null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const articleUrl = story.sources[0]?.url;
        if (!articleUrl) return;

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
      },
      { rootMargin: "80px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [story, subscriptionRequired]);

  useEffect(() => {
    const node = summaryTextRef.current;
    if (!node) return;

    const measure = () => {
      if (textOpen) {
        setSummaryHasOverflow(true);
        return;
      }

      // With the 3-line clamp active, scrollHeight is larger than clientHeight
      // only when there is genuinely more text to reveal.
      setSummaryHasOverflow(node.scrollHeight > node.clientHeight + 1);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [story.summary, textOpen]);

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
          <span>{mediaName(story.sourceLabel)}</span>
          <span>•</span>
          <span>
            {story.publishedDate || "Dato ukendt"}
            {story.sourceMethod ? ` · ${story.sourceMethod}` : ""}
          </span>
        </div>
        <h2>{story.title}</h2>
        <div className={`summaryRow ${textOpen ? "expanded" : ""}`}>
          <p ref={summaryTextRef}>{story.summary}</p>
          {(summaryHasOverflow || textOpen) && (
            <button
              type="button"
              className={`storyExpandButton ${textOpen ? "open" : ""}`}
              onClick={() => setTextOpen((value) => !value)}
              aria-expanded={textOpen}
              aria-label={textOpen ? "Vis mindre" : "Vis hele nyhedsteksten"}
              title={textOpen ? "Vis mindre" : "Vis mere"}
            >
              ▾
            </button>
          )}
        </div>

        <div className="scoreLine">
          <button
            type="button"
            className="aiSummaryButton"
            onClick={toggleSummary}
            aria-expanded={summaryOpen}
          >
            <span className="actionLinkText">Resumé</span><span className={`summaryChevron ${summaryOpen ? "open" : ""}`}>▾</span>
          </button>
          <button
            type="button"
            className="aiCheckLink"
            onClick={toggleFactCheck}
            aria-expanded={factOpen}
          >
            <span className="actionLinkText">Faktatjek</span><span className={`summaryChevron ${factOpen ? "open" : ""}`}>▾</span>
          </button>
          {story.sources[0] && subscriptionRequired !== null && (
            <a className="readMore" href={story.sources[0].url} target="_blank" rel="noreferrer">
              <span className="readMoreText">Læs mere</span> <span className="readMoreAccess">({subscriptionRequired ? "abb." : "gratis"})</span> <span className="externalArrow" aria-hidden="true">{"\u2197\uFE0E"}</span>
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
  const [categoriesSelected, setCategoriesSelected] = useState<string[]>([]);
  const [mediaSelected, setMediaSelected] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(50);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const categories = ["AI/Tech", "Erhverv", "Danmark", "Aarhus"];

  const mediaOptions = useMemo(() => {
    const names = initialStories.flatMap((story) =>
      story.sources.map((source) => mediaName(source.label))
    );
    const hiddenMedia = new Set(["Fredericia Dagblad", "JydskeVestkysten", "Horsens Folkeblad", "Nordjyske"]);
    return Array.from(new Set(names))
      .filter((name) => !hiddenMedia.has(name))
      .sort((a, b) => a.localeCompare(b, "da"));
  }, [initialStories]);

  const visible = useMemo(
    () =>
      initialStories
        .filter((story) => {
          const matchesCategory =
            categoriesSelected.length === 0 || categoriesSelected.includes(story.category);
          const matchesMedia =
            mediaSelected.length === 0 ||
            story.sources.some((source) => mediaSelected.includes(mediaName(source.label)));
          return matchesCategory && matchesMedia;
        })
        .sort((a, b) => {
          const diff = storyTime(b.publishedAt) - storyTime(a.publishedAt);
          if (diff !== 0) return diff;
          return b.id.localeCompare(a.id);
        }),
    [initialStories, categoriesSelected, mediaSelected]
  );

  function toggleCategory(item: string) {
    setCategoriesSelected((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    );
  }

  function toggleMedia(item: string) {
    setMediaSelected((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    );
  }

  useEffect(() => {
    setVisibleCount(50);
  }, [categoriesSelected, mediaSelected]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= visible.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleCount((count) => Math.min(count + 50, visible.length));
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, visible.length]);

  return (
    <section id="feed">
      <div className="filterBar">
        <button
          className={`filterTab ${categoriesSelected.length === 0 ? "active" : ""}`}
          onClick={() => setCategoriesSelected([])}
        >
          Alle emner
        </button>
        {categories.map((item) => (
          <button
            key={item}
            className={`filterTab ${categoriesSelected.includes(item) ? "active" : ""}`}
            onClick={() => toggleCategory(item)}
            aria-pressed={categoriesSelected.includes(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mediaFilter" aria-label="Filtrer efter medie">
        <span className="mediaFilterItem">
          <button
            className={`mediaLink ${mediaSelected.length === 0 ? "active" : ""}`}
            onClick={() => setMediaSelected([])}
          >
            Alle medier
          </button>
        </span>
        {mediaOptions.map((item) => (
          <span key={item} className="mediaFilterItem">
            <button
              className={`mediaLink ${mediaSelected.includes(item) ? "active" : ""}`}
              onClick={() => toggleMedia(item)}
              aria-pressed={mediaSelected.includes(item)}
            >
              <span className="mediaLabelDesktop">{item}</span>
              <span className="mediaLabelMobile">
                {item === "Stiften.dk" ? "Stiften" : item === "TV2.dk" ? "TV2" : item}
              </span>
            </button>
          </span>
        ))}
      </div>

      <div className="sectionTitle">
        Seneste nyheder <span className="sectionTitleNote">baseret på dine valg</span>
      </div>

      <div className="storyList">
        {visible.slice(0, visibleCount).map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
      {visibleCount < visible.length && (
        <div ref={loadMoreRef} className="newsLoadMore" aria-hidden="true">
          Indlæser flere nyheder…
        </div>
      )}
    </section>
  );
}
