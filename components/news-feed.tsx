"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isAndersWinnerskjoldStory, type Story } from "@/lib/stories";
import type { FactResult } from "@/lib/factcheck";
import { previewWordCount } from "@/lib/article-preview-quality";
import { isGenericArticleImage } from "@/lib/article-image-quality";
import { MobileMediaStats } from "@/components/news-stats";
import { AiSummaryPreview, SUMMARY_PREVIEW_WORDS } from "@/components/ai-summary-preview";
import { canonicalMediaName } from "@/lib/media-publishers";
import { deduplicateNewsStories } from "@/lib/news-quality";

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

function mediaName(label: string, url?: string) {
  return canonicalMediaName(label, url);
}

function matchesMediaSelection(story: Story, selectedMedia: string[]) {
  if (selectedMedia.length === 0) return true;
  // The first source owns the displayed headline, excerpt and timestamp.
  // Secondary cross-check sources must not make another publisher's article appear.
  const primarySource = story.sources[0];
  return !!primarySource && selectedMedia.includes(mediaName(primarySource.label, primarySource.url));
}

function splitPublishedDate(value?: string) {
  if (!value) return { time: "", rest: "Dato ukendt" };
  const [time, ...rest] = value.split(" · ");
  return { time, rest: rest.join(" · ") };
}

// The publisher's available text ends at a complete sentence near 100 words.
function originalExcerpt(value: string) {
  const { excerpt, hasMore } = previewWordCount(value);
  return { text: excerpt, hasMore };
}

function StoryCard({ story }: { story: Story }) {
  const feedExcerpt = originalExcerpt(story.archiveOnly ? "" : story.summary);
  const excerpt = feedExcerpt;
  const ref = useRef<HTMLElement | null>(null);
   const [subscriptionRequired, setSubscriptionRequired] = useState<boolean | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const hasLongSummary = (story.aiSummary?.trim().split(/\s+/).filter(Boolean).length ?? 0) > SUMMARY_PREVIEW_WORDS;
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ summary: string; bullets: string[]; basis?: string; basisType?: "article_text" | "excerpt"; articleTruncated?: boolean } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(story.imageUrl && !isGenericArticleImage(story.imageUrl, story.title, story.sources[0]?.label || story.sourceLabel) ? story.imageUrl : null);
  const [imageLookupAttempted, setImageLookupAttempted] = useState(false);
  const [photoCredit, setPhotoCredit] = useState<string | null>(null);
  const [articleImageFailed, setArticleImageFailed] = useState(false);
  const [verifiedImageUrl, setVerifiedImageUrl] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageRequestInFlightRef = useRef(false);
  const imageOnDemandRequestedRef = useRef(false);
  const imageFallbackCountRef = useRef(0);
  const hasImageCandidate = Boolean(resolvedImageUrl && !articleImageFailed);
  // Only show a camera when the image genuinely loaded in this browser.
  const hasValidPhoto = hasImageCandidate && verifiedImageUrl === resolvedImageUrl;
  // The headline and text are always clickable, even while photo discovery runs.
  const canExpand = !story.archiveOnly;
  const [factOpen, setFactOpen] = useState(false);
  const [factLoading, setFactLoading] = useState(false);
  const [factCheck, setFactCheck] = useState<FactResult | null>(null);
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

  // Retrieve photos proactively near the viewport, and retry once on opening a
  // story. Some stored articles have images on the publisher page but not in RSS.
  async function ensureArticleImage(force = false) {
    const articleUrl = story.sources[0]?.url;
    if (story.archiveOnly || !articleUrl || imageRequestInFlightRef.current ||
        (imageLookupAttempted && !force) || resolvedImageUrl) return;
    imageRequestInFlightRef.current = true;
    setImageLookupAttempted(true);
    try {
      const response = await fetch("/api/article-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: articleUrl, title: story.title, failedImageUrl }),
        signal: AbortSignal.timeout(13000)
      });
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.photoCredit === "string") setPhotoCredit(data.photoCredit);
      if (typeof data.imageUrl === "string" &&
          data.imageUrl !== failedImageUrl &&
          !isGenericArticleImage(data.imageUrl, story.title, story.sources[0]?.label || story.sourceLabel, data.imageDescription || "")) {
        setArticleImageFailed(false);
        setResolvedImageUrl(data.imageUrl);
      }
    } catch { /* A blocked publisher image must not stop the news feed. */ }
    finally { imageRequestInFlightRef.current = false; }
  }

  // Preserve images supplied by the full feed after the first five-story
  // preview. React reuses the card, so its initial state would otherwise stick.
  useEffect(() => {
    const image = story.imageUrl;
    if (!image || image === failedImageUrl ||
        isGenericArticleImage(image, story.title, story.sources[0]?.label || story.sourceLabel)) return;
    setResolvedImageUrl(current => current || image);
    setArticleImageFailed(false);
  }, [story.imageUrl, story.title, story.sourceLabel, failedImageUrl]);

  useEffect(() => {
    if (story.archiveOnly || imageLookupAttempted || resolvedImageUrl) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void ensureArticleImage();
    }, { rootMargin: "300px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [story.archiveOnly, story.title, story.sources, resolvedImageUrl, imageLookupAttempted, failedImageUrl]);

  // Validate the camera icon unobtrusively. Never let a failed preflight
  // suppress the actual image when the reader opens the article.
  useEffect(() => {
    if (!resolvedImageUrl || articleImageFailed) return;
    let cancelled = false;
    const check = new Image();
    check.onload = () => {
      if (!cancelled && check.naturalWidth > 1 && check.naturalHeight > 1) {
        setVerifiedImageUrl(resolvedImageUrl);
      }
    };
    check.onerror = () => {
      if (!cancelled) setVerifiedImageUrl(null);
    };
    check.src = resolvedImageUrl;
    return () => {
      cancelled = true;
      check.onload = null;
      check.onerror = null;
    };
  }, [resolvedImageUrl, articleImageFailed]);

  function toggleStory() {
    const opening = !summaryExpanded;
    setSummaryExpanded(opening);
    if (opening && !resolvedImageUrl && !imageOnDemandRequestedRef.current) {
      imageOnDemandRequestedRef.current = true;
      void ensureArticleImage(true);
    }
  }

  function handleStoryKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleStory();
    }
  }

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
          <span>{mediaName(story.sources[0]?.label || story.sourceLabel, story.sources[0]?.url)}</span>
          <span>•</span>
          <span className="storyDateMeta">
            {(() => {
              const published = splitPublishedDate(story.publishedDate);
              return (
                <>
                  {published.time && <strong className="storyTime">Kl. {published.time}</strong>}
                  {published.rest && <span>{published.time ? " · " : ""}{published.rest}</span>}
                </>
              );
            })()}
          </span>
        </div>
        <h2
          className={canExpand ? "storyExpandableHeadline" : undefined}
          role={canExpand ? "button" : undefined}
          tabIndex={canExpand ? 0 : undefined}
          aria-expanded={canExpand ? summaryExpanded : undefined}
          aria-label={canExpand ? (summaryExpanded ? "Fold nyheden sammen: " : "Fold nyheden ud: ") + story.title : undefined}
          onClick={canExpand ? toggleStory : undefined}
          onKeyDown={canExpand ? handleStoryKeyDown : undefined}
        >{story.title}</h2>
        {story.archiveOnly
          ? <p className="storyArchiveLabel">Arkiv · Læs hele artiklen hos originalkilden</p>
          : <div className="summaryRow aiSummaryRow">
              <div className="aiSummaryBody">
                <p
                  className={`aiSummaryText ${canExpand ? "clickableSummaryText" : ""}`}
                  onClick={canExpand ? toggleStory : undefined}
                  onKeyDown={canExpand ? handleStoryKeyDown : undefined}
                  role={canExpand ? "button" : undefined}
                  tabIndex={canExpand ? 0 : undefined}
                  aria-expanded={canExpand ? summaryExpanded : undefined}
                  aria-label={canExpand ? (summaryExpanded ? "Fold nyhed og billede sammen" : "Fold nyhed og billede ud") : undefined}
                ><AiSummaryPreview story={story} expanded={summaryExpanded} /></p>
              </div>
            </div>}
        {summaryExpanded && hasImageCandidate && (
          <div className="storyArticleImageWrap">
            <img
              className="storyArticleImage"
              src={resolvedImageUrl || ""}
              alt={`Billede til artiklen: ${story.title}`}
              loading="lazy"
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth > 1 && event.currentTarget.naturalHeight > 1) {
                  setVerifiedImageUrl(resolvedImageUrl);
                }
              }}
              onError={() => {
                // If the saved publisher image is expired or blocked, try the
                // article's own verified metadata once before hiding it.
                setArticleImageFailed(true);
                setVerifiedImageUrl(null);
                if (imageFallbackCountRef.current < 1) {
                  imageFallbackCountRef.current += 1;
                  setFailedImageUrl(resolvedImageUrl);
                  setResolvedImageUrl(null);
                  setImageLookupAttempted(false);
                }
              }}
            />
            {<div className="storyPhotoCredit">{photoCredit ? `Foto: ${photoCredit}` : `Billedkilde: ${story.sourceLabel}`}</div>}
          </div>
        )}

        <div className="scoreLine">
          {false && excerpt.hasMore && <button
            type="button"
            className="aiSummaryButton"
            onClick={toggleSummary}
            aria-expanded={summaryOpen}
          >
            <span className="actionLinkText">Resumé</span><span className={`summaryChevron ${summaryOpen ? "open" : ""}`}>▾</span>
          </button>}
          {!story.archiveOnly && <button
            type="button"
            className="aiCheckLink"
            onClick={toggleFactCheck}
            aria-expanded={factOpen}
          >
            <span className="actionLinkText">AI-analyse</span><span className={`summaryChevron ${factOpen ? "open" : ""}`}>▾</span>
          </button>}
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
          {canExpand && (hasLongSummary || hasValidPhoto) && (
            <button
              type="button"
              className={`storyExpandButton ${summaryExpanded ? "open" : ""}`}
              onClick={toggleStory}
              aria-label={summaryExpanded ? "Fold nyheden sammen" : "Fold nyheden ud"}
              aria-expanded={summaryExpanded}
              title={summaryExpanded ? "Fold nyhed sammen" : "Fold nyhed ud"}
            >
              {hasValidPhoto && <svg className="storyCameraIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4Z" />
                <circle cx="12" cy="13.5" r="3.5" />
              </svg>}
              <span className="storyExpandChevron" aria-hidden="true">▾</span>
            </button>
          )}
        </div>

        <div className="aiSummaryPanel">
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
            <div className="aiSummaryHeader">AI-analyse</div>
            <a
                              className="chatGptDiscuss"
                              href={`https://chatgpt.com/?q=${encodeURIComponent(
                                `Jeg vil gerne diskutere denne nyhed, jeg har fundet på ØL.dk:\n\n${story.title}\n\nØL.dk / originalkilde: ${story.sources[0]?.url || ""}\n\nNyhedstekst/resumé: ${aiSummary?.summary || story.summary}\n\nHjælp mig med at forstå sagen, argumenterne fra de forskellige sider og hvor stærkt dokumentationen står.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Diskuter artiklen med ChatGPT <span className="externalArrow" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M6 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5A1.75 1.75 0 0 0 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V10" /><path d="M9 2h5v5" /><path d="M14 2 7.5 8.5" /></svg></span>
                            </a>
            <p className="chatGptTransferNote">Artiklens tekst overføres til ChatGPT</p>
            <div className="factTopDivider" aria-hidden="true" />
            {factLoading && <p className="aiSummaryStatus" role="status">Søger efter eksterne kilder og tjekker påstandene…</p>}
            {factError && <p className="aiSummaryError">{factError}</p>}
            {factCheck && (
              <>
                <section className="factSection">
                  <div className="factSectionHeading">
                    <span>Tekstens neutralitets-score:</span>
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
                    <span>Antal eksterne kilder:</span>
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

export function NewsFeed({ initialStories }: { initialStories: Story[] }) {
  const [categoriesSelected, setCategoriesSelected] = useState<string[]>([]);
  const [mediaSelected, setMediaSelected] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const categories = ["AI/Tech", "Erhverv", "Danmark", "Aarhus"];
  const andersTopic = "ANDERS W.";
  const [andersArchive, setAndersArchive] = useState<Story[]>([]);
  const [andersStatus, setAndersStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    async function loadAnders() {
      try {
        const response = await fetch("/api/news/anders", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Topic archive request failed");
        const data = await response.json();
        if (!Array.isArray(data.stories)) throw new Error("Invalid topic archive");
        if (!controller.signal.aborted) {
          setAndersArchive(data.stories);
          setAndersStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) setAndersStatus("error");
      }
    }
    void loadAnders();
    const interval = window.setInterval(loadAnders, 60000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, []);
  const andersStories = useMemo(() => {
    const byId = new Map<string, Story>();
    for (const story of [...andersArchive, ...initialStories.filter(isAndersWinnerskjoldStory)]) {
      const key = story.sources[0]?.url || story.id;
      const previous = byId.get(key);
      if (!previous || (previous.archiveOnly && !story.archiveOnly)) byId.set(key, story);
    }
    return deduplicateNewsStories(Array.from(byId.values()));
  }, [initialStories, andersArchive]);
  const andersCount = andersStories.length;

  const mediaOptions = useMemo(() => {
    const names = initialStories.filter(story => !story.andersOnly).map(story => {
      const lead = story.sources[0];
      return lead ? mediaName(lead.label, lead.url) : mediaName(story.sourceLabel);
    });
    const hiddenMedia = new Set(["Fredericia Dagblad", "JydskeVestkysten", "Horsens Folkeblad", "Nordjyske", "Fyens.dk"]);
    // Never create media buttons from secondary cross-check sources, or show
    // publishers with zero available news under the chosen 200-story limit.
    return Array.from(new Set(names))
      .filter(name => name && !hiddenMedia.has(name))
      .sort((a, b) => a.localeCompare(b, "da"));
  }, [initialStories]);

  const visible = useMemo(
    () =>
      (categoriesSelected.includes(andersTopic)
        ? [...initialStories.filter(story => !isAndersWinnerskjoldStory(story)), ...andersStories]
        : initialStories)
        .filter((story) => {
          if (story.andersOnly && !categoriesSelected.includes(andersTopic)) return false;
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
    [initialStories, andersStories, categoriesSelected, mediaSelected]
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
          {andersTopic} ({andersStatus === "loading" ? "…" : andersCount})
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
        <span>Seneste nyheder <span className="sectionTitleNote">(baseret på dine valg)</span></span>
        <MobileMediaStats />
      </div>

      {categoriesSelected.includes(andersTopic) && andersStatus === "loading" && <p role="status">Henter Anders W.-arkivet…</p>}
      {categoriesSelected.includes(andersTopic) && andersStatus === "error" && <p role="status">Arkivet kunne ikke hentes. Prøver automatisk igen.</p>}
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
