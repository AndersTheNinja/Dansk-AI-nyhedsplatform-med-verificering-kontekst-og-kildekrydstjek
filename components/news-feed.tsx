"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Story } from "@/lib/stories";
import type { FactResult } from "@/lib/factcheck";
import { hasPublisherInterfaceText } from "@/lib/article-preview-quality";

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

function matchesMediaSelection(story: Story, selectedMedia: string[]) {
  if (selectedMedia.length === 0) return true;
  // The first source owns the displayed headline, excerpt and timestamp.
  // Secondary cross-check sources must not make another publisher's article appear.
  const primarySource = story.sources[0];
  return !!primarySource && selectedMedia.includes(mediaName(primarySource.label));
}

function splitPublishedDate(value?: string) {
  if (!value) return { time: "", rest: "Dato ukendt" };
  const [time, ...rest] = value.split(" · ");
  return { time, rest: rest.join(" · ") };
}

const feedJokes = [
  "Hvorfor tog journalisten en stige med på arbejde? Fordi historien skulle løftes til et højere niveau.",
  "Jeg bad min computer om en god nyhed. Den svarede: Du har ingen ulæste mails.",
  "Hvorfor er aviser dårlige til gemmeleg? Fordi de altid ender på forsiden.",
  "En optimist læser nyhederne og tænker: Det skal nok gå. En pessimist læser kommentarsporet.",
  "Hvad kalder man breaking news uden internet? Gammelt nyt.",
  "Hvorfor kom AI'en for sent til redaktionsmødet? Den sad fast i en lang prompt."
];

function JokeCard({ index }: { index: number }) {
  const joke = feedJokes[index % feedJokes.length];
  return (
    <article className="storyRow jokeRow">
      <div className="storyContent">
        <div className="storyMeta"><span>PAUSE</span><span>•</span><span>ØL.dk</span><span>•</span><span>Vittighed</span></div>
        <h2>Et lille nyhedsbreak</h2>
        <p>{joke}</p>
      </div>
    </article>
  );
}

// Keep the publisher's original available excerpt, capped at 100 words.
function originalExcerpt(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return { text: words.slice(0, 100).join(" "), hasMore: words.length > 100 };
}

function StoryCard({ story }: { story: Story }) {
  const feedExcerpt = originalExcerpt(story.summary);
  const [articlePreview, setArticlePreview] = useState<{text:string;hasMore:boolean}|null>(null);
  const excerpt = articlePreview ? {text:articlePreview.text,hasMore:articlePreview.hasMore} : feedExcerpt;
  const ref = useRef<HTMLElement | null>(null);
  const summaryTextRef = useRef<HTMLParagraphElement | null>(null);
   const [subscriptionRequired, setSubscriptionRequired] = useState<boolean | null>(null);
   const checkedAccessUrl = useRef<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ summary: string; bullets: string[]; basis?: string; basisType?: "article_text" | "excerpt"; articleTruncated?: boolean } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(story.imageUrl || null);
  const [imageLookupAttempted, setImageLookupAttempted] = useState(false);
  const [photoCredit, setPhotoCredit] = useState<string | null>(null);
  const [articleImageFailed, setArticleImageFailed] = useState(false);
  const [summaryHasOverflow, setSummaryHasOverflow] = useState(false);
  const [factOpen, setFactOpen] = useState(false);
  const [factLoading, setFactLoading] = useState(false);
  const [factCheck, setFactCheck] = useState<FactResult | null>(null);
  const [factError, setFactError] = useState<string | null>(null);

  useEffect(() => {
    const node=ref.current;
    const articleUrl=story.sources[0]?.url;
    if(!node||!articleUrl)return;
    const observer=new IntersectionObserver((entries)=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      fetch("/api/article-preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:articleUrl,title:story.title})})
        .then(response=>response.ok?response.json():null)
        .then(data=>{
          if(typeof data?.excerpt==="string"&&data.excerpt.trim()&&typeof data?.hasMore==="boolean"&& !hasPublisherInterfaceText(data.excerpt)){
            const fetchedWords=data.excerpt.trim().split(/\s+/).length;
            const feedWords=story.summary.trim().split(/\s+/).filter(Boolean).length;
            // A short partial article extract must not hide a longer publisher feed.
            // Preserve the longer confirmed source text until full article text is available.
            if(data.hasMore || fetchedWords>=feedWords){
              setArticlePreview({text:data.excerpt,hasMore:data.hasMore});
            }
          }
        }).catch(()=>{});
    },{rootMargin:"250px 0px"});
    observer.observe(node);
    return()=>observer.disconnect();
  },[story.id,story.title,story.sources]);

  useEffect(() => {
    const node = ref.current;
    const articleUrl = story.sources[0]?.url;
    if (!node || !articleUrl || checkedAccessUrl.current === articleUrl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        // Do not repeatedly request an article whose access is unknown.
        checkedAccessUrl.current = articleUrl;
        setSubscriptionRequired(null);
        fetch("/api/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: articleUrl })
        })
          .then((response) => response.ok ? response.json() : null)
          .then((result) => {
            if (checkedAccessUrl.current !== articleUrl) return;
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
  }, [story.sources]);

  useEffect(() => {
    const node = summaryTextRef.current;
    if (!node) return;

    const measure = () => {
      if (textOpen) {
        setSummaryHasOverflow(true);
        return;
      }

      // The same expand control also reveals a relevant article image,
      // even when the available editorial teaser fits within three lines.
      setSummaryHasOverflow(node.scrollHeight > node.clientHeight + 1 || Boolean(resolvedImageUrl) && !articleImageFailed);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [excerpt.text, resolvedImageUrl, articleImageFailed, textOpen]);

  // Fetch a publisher-provided preview image only if the story is opened and
  // the news feed did not already supply one. Do not guess an image by keyword.
  useEffect(() => {
    if (!textOpen || imageLookupAttempted) return;
    const articleUrl = story.sources[0]?.url;
    if (!articleUrl) return;
    setImageLookupAttempted(true);

    fetch("/api/article-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: articleUrl, title: story.title })
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (typeof data?.photoCredit === "string" && (!resolvedImageUrl || data?.imageUrl === resolvedImageUrl)) {
          setPhotoCredit(data.photoCredit);
        }
        if (typeof data?.imageUrl === "string" && !resolvedImageUrl) {
          setResolvedImageUrl(data.imageUrl);
          setArticleImageFailed(false);
        }
      })
      .catch(() => {});
  }, [textOpen, resolvedImageUrl, imageLookupAttempted, story.sources, story.title]);

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

    const cacheKey = `kontekst-summary-v2:${story.id}`;
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

    const cacheKey = `oel-fact-v3:${story.id}:${story.summary}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const saved = JSON.parse(cached);
        if (saved.expiresAt > Date.now() && saved.result?.search?.performed) {
          setFactCheck(saved.result);
          return;
        }
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
          text: story.summary,
          url: story.sources[0]?.url,
          publishedAt: story.publishedAt,
          sources: story.sources,
          neutrality: story.neutrality,
          primarySource: story.sources[0]?.label ?? story.sourceLabel
        }),
        signal: AbortSignal.timeout(95000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Faktatjekket kunne ikke laves.");
      setFactCheck(result);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ expiresAt: Date.now() + 15 * 60 * 1000, result }));
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
          <span className="storyDateMeta">
            {(() => {
              const published = splitPublishedDate(story.publishedDate);
              return (
                <>
                  {published.time && <strong className="storyTime">Kl. {published.time}</strong>}
                  {published.rest && <span>{published.time ? " · " : ""}{published.rest}</span>}
                  {story.sourceMethod ? ` · ${story.sourceMethod}` : ""}
                </>
              );
            })()}
          </span>
        </div>
        <h2
          className={summaryHasOverflow || textOpen ? "expandableStoryTitle" : undefined}
          onClick={() => {
            if (summaryHasOverflow || textOpen) setTextOpen((value) => !value);
          }}
          onKeyDown={(event) => {
            if (!(summaryHasOverflow || textOpen)) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setTextOpen((value) => !value);
            }
          }}
          role={summaryHasOverflow || textOpen ? "button" : undefined}
          tabIndex={summaryHasOverflow || textOpen ? 0 : undefined}
          aria-expanded={summaryHasOverflow || textOpen ? textOpen : undefined}
          title={summaryHasOverflow || textOpen ? (textOpen ? "Tryk for at vise mindre" : "Tryk for at vise hele teksten") : undefined}
        >
          {story.title}
        </h2>
        <div className={`summaryRow ${textOpen ? "expanded" : ""}`}>
          <p
            ref={summaryTextRef}
            className={summaryHasOverflow || textOpen ? "expandableStoryText" : undefined}
            onClick={() => {
              if (summaryHasOverflow || textOpen) setTextOpen((value) => !value);
            }}
            onKeyDown={(event) => {
              if (!(summaryHasOverflow || textOpen)) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setTextOpen((value) => !value);
              }
            }}
            role={summaryHasOverflow || textOpen ? "button" : undefined}
            tabIndex={summaryHasOverflow || textOpen ? 0 : undefined}
            aria-expanded={summaryHasOverflow || textOpen ? textOpen : undefined}
            title={summaryHasOverflow || textOpen ? (textOpen ? "Tryk for at vise mindre" : "Tryk for at vise hele teksten") : undefined}
          >
            {excerpt.text}
          </p>
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

        {textOpen && resolvedImageUrl && !articleImageFailed && (
          <div className="storyArticleImageWrap">
            <img
              className="storyArticleImage"
              src={resolvedImageUrl || ""}
              alt={`Billede til artiklen: ${story.title}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setArticleImageFailed(true)}
            />
            {<div className="storyPhotoCredit">{photoCredit ? `Foto: ${photoCredit}` : `Billedkilde: ${story.sourceLabel}`}</div>}
          </div>
        )}

        <div className="scoreLine">
          {excerpt.hasMore && <button
            type="button"
            className="aiSummaryButton"
            onClick={toggleSummary}
            aria-expanded={summaryOpen}
          >
            <span className="actionLinkText">Resumé</span><span className={`summaryChevron ${summaryOpen ? "open" : ""}`}>▾</span>
          </button>}
          <button
            type="button"
            className="aiCheckLink"
            onClick={toggleFactCheck}
            aria-expanded={factOpen}
          >
            <span className="actionLinkText">Faktatjek</span><span className={`summaryChevron ${factOpen ? "open" : ""}`}>▾</span>
          </button>
          {story.sources[0] && (
            <a className="readMore" href={story.sources[0].url} target="_blank" rel="noreferrer">
              <span className="readMoreText">Læs mere</span>{subscriptionRequired !== null && <> <span className="readMoreAccess">({subscriptionRequired ? "abb." : "gratis"})</span></>} <span className="externalArrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false">
                  <path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5A1.75 1.75 0 0 0 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" />
                  <path d="M9 2h5v5" />
                  <path d="M14 2 7.5 8.5" />
                </svg>
              </span>
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
                  Grundlag: {aiSummary.basis || "tilgængelig tekst – omfang ikke verificeret"}.{aiSummary.basisType === "excerpt" ? " Hele artiklen er ikke verificeret." : ""}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`aiSummaryPanel factPanel ${factOpen ? "open" : ""}`}>
          <div className="aiSummaryInner">
            <div className="aiSummaryHeader">Faktatjek</div>
            {factLoading && <p className="aiSummaryStatus" role="status">Søger efter eksterne kilder og tjekker påstandene…</p>}
            {factError && <p className="aiSummaryError">{factError}</p>}
            {factCheck && (
              <>
                <section className="factSection">
                  <div className="factSectionHeading">
                    <span>Neutralitet</span>
                    <strong>{factCheck.neutrality.score == null ? "Ikke vurderet" : `${factCheck.neutrality.score}/100`}</strong>
                  </div>
                  {factCheck.neutrality.score != null ? <>
                    <p><strong>Balance:</strong> {factCheck.neutrality.balance}</p>
                    <p><strong>Sprogbrug:</strong> {factCheck.neutrality.language}</p>
                  </> : <p>Neutraliteten er ikke vurderet i dette tjek.</p>}
                  {factCheck.neutrality.explanation && <p>{factCheck.neutrality.explanation}</p>}
                </section>

                <section className="factSection">
                  <div className="factSectionHeading">
                    <span>Eksterne kilder</span>
                    <strong>{factCheck.otherMedia.count}</strong>
                  </div>
                  {factCheck.otherMedia.names.length > 0 && (
                    <div className="factSourceChips">
                      {factCheck.otherMedia.names.map((name) => <span key={name}>{name}</span>)}
                    </div>
                  )}
                  <p>{factCheck.otherMedia.agreement}</p>
                </section>

                <section className="factSection">
                  <div className="factSectionHeading truthHeading">
                    <span>Påstande og dokumentation</span>
                    <strong>{factCheck.truth.score}/100</strong>
                  </div>
                  <ol className="factClaims">
                    {factCheck.claims.map((claim, index) => (
                      <li key={index}>
                        <span className={`factClaimStatus ${claim.status === "bekræftet" ? "confirmed" : claim.status === "modstridt" ? "contradicted" : "unverified"}`}>{claim.status}</span>
                        <p><strong>{claim.statement}</strong></p>
                        <p>{claim.explanation}</p>
                        <div className="factClaimLinks">
                          {claim.sourceIds.map(id => {
                            const source = factCheck.references.find(reference => reference.id === id);
                            return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>[{id}] {source.domain} ↗</a> : null;
                          })}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {factCheck.references.length > 0 && <div className="factReferenceList">
                    <strong>Kildehenvisninger</strong>
                    {factCheck.references.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {source.title} ↗</a>)}
                  </div>}
                </section>

                <p className="factBasis">{factCheck.basis}<br />Tjekket {new Date(factCheck.checkedAt).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" })}.</p>

                <section className="factConclusion">
                  <div className="factConclusionLabel">AI-konklusion</div>
                  <p>{factCheck.conclusion}</p>
                  <div className="factVerdict">
                    <span className={`factBadge ${factCheck.verdict}`}>{factCheck.verdict}</span>
                    <span>Dokumentationsstyrke: <strong>{factCheck.score}/100</strong></span>
                  </div>
                </section>

                <a
                  className="chatGptDiscuss"
                  href={`https://chatgpt.com/?q=${encodeURIComponent(
                    `Jeg vil gerne diskutere denne nyhed, jeg har fundet på ØL.dk:\n\n${story.title}\n\nØL.dk / originalkilde: ${story.sources[0]?.url || ""}\n\nNyhedstekst/resumé: ${aiSummary?.summary || story.summary}\n\nHjælp mig med at forstå sagen, argumenterne fra de forskellige sider og hvor stærkt dokumentationen står.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Diskutér nyheden med ChatGPT <span aria-hidden="true">↗</span>
                </a>

                <div className="aiSummaryFoot">
                  Vurderingen kan ændre sig, når der kommer nye oplysninger.
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}

function isAndersWinnerskjoldStory(story: Story) {
  if (story.mentions?.includes("anders-winnerskjold")) return true;

  const haystack = [
    story.title,
    story.summary,
    ...story.sources.map((source) => source.title || "")
  ]
    .join(" ")
    .toLocaleLowerCase("da-DK");

  return /\banders\s+winners(?:kjold|kiold)\b/i.test(haystack) ||
    /\bwinners(?:kjold|kiold)\b/i.test(haystack);
}

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const [categoriesSelected, setCategoriesSelected] = useState<string[]>([]);
  const [mediaSelected, setMediaSelected] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [jokeMode, setJokeMode] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const categories = ["AI/Tech", "Erhverv", "Danmark", "Aarhus"];
  const andersTopic = "ANDERS W.";
  const andersCount = useMemo(
    () => initialStories.filter(isAndersWinnerskjoldStory).length,
    [initialStories]
  );

  const mediaOptions = useMemo(() => {
    const names = initialStories.flatMap((story) =>
      story.sources.map((source) => mediaName(source.label))
    );
    const hiddenMedia = new Set(["Fredericia Dagblad", "JydskeVestkysten", "Horsens Folkeblad", "Nordjyske", "Fyens.dk"]);
    return Array.from(new Set([
      "Berlingske", "DR", "Politiken", "Børsen", "Journalisten",
      "Altinget", "Stiften.dk", "MigogAarhus", "TV2.dk",
      ...names
    ]))
      .filter((name) => !hiddenMedia.has(name))
      .sort((a, b) => a.localeCompare(b, "da"));
  }, [initialStories]);

  const visible = useMemo(
    () =>
      initialStories
        .filter((story) => {
          const matchesCategory =
            categoriesSelected.length === 0 ||
            categoriesSelected.includes(story.category) ||
            (categoriesSelected.includes(andersTopic) && isAndersWinnerskjoldStory(story));
          const matchesMedia = matchesMediaSelection(story, mediaSelected);
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
    setVisibleCount(20);
  }, [categoriesSelected, mediaSelected]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= visible.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleCount((count) => Math.min(count + 40, visible.length));
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
            data-category={item}
            className={`filterTab ${categoriesSelected.includes(item) ? "active" : ""}`}
            onClick={() => toggleCategory(item)}
            aria-pressed={categoriesSelected.includes(item)}
          >
            {item}
          </button>
        ))}
        <button
          className={`filterTab ${categoriesSelected.includes(andersTopic) ? "active" : ""}`}
          onClick={() => toggleCategory(andersTopic)}
          aria-pressed={categoriesSelected.includes(andersTopic)}
          title="Nyheder om Aarhus-borgmester Anders Winnerskjold"
        >
          {andersTopic} ({andersCount})
        </button>
      </div>

      <div className="mediaFilter" aria-label="Filtrer efter medie">
        <span className="mediaFilterItem">
          <button
            className={`mediaLink mediaAllLink ${mediaSelected.length === 0 ? "active" : ""}`}
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
                {item === "TV2.dk" ? "TV2" : item}
              </span>
            </button>
          </span>
        ))}
      </div>

      <div className="sectionTitle sectionTitleRow">
        <span>Seneste nyheder <span className="sectionTitleNote">baseret på dine valg</span></span>
        <label className="jokeToggle" title="Indsæt en vittighed som hver tiende post">
          <span>Jokes</span>
          <input
            type="checkbox"
            checked={jokeMode}
            onChange={(event) => setJokeMode(event.target.checked)}
            aria-label="Vis en vittighed som hver tiende post"
          />
          <span className="jokeSlider" aria-hidden="true" />
        </label>
      </div>

      <div className="storyList">
        {(() => {
          const items: React.ReactNode[] = [];
          visible.slice(0, visibleCount).forEach((story, index) => {
            items.push(<StoryCard key={story.id} story={story} />);
            if (jokeMode && (index + 1) % 9 === 0) {
              items.push(<JokeCard key={`joke-${index}`} index={Math.floor(index / 9)} />);
            }
          });
          return items;
        })()}
      </div>
      {visibleCount < visible.length && (
        <div ref={loadMoreRef} className="newsLoadMore" aria-hidden="true">
          Indlæser flere nyheder…
        </div>
      )}
    </section>
  );
}
