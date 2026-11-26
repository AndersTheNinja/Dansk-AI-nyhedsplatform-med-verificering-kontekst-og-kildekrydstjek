export type Verification = "confirmed" | "nuance" | "unverified";

export type Neutrality = {
  wording: number;
  wordingNote: string;
  wordingExamples: string[];
  sources: number | null;
  sourcesNote: string;
  sourcesExamples: string[];
};

export type Story = {
  id: string;
  category: "AI/Tech" | "Erhverv" | "Danmark" | "Aarhus";
  title: string;
  sourceLabel: string;
  published: string;
  publishedAt?: string;
  publishedDate?: string;
  sourceMethod?: "RSS" | "WEB";
  summary: string;
  /** Precomputed AI summary. Only ready stories are returned to public clients. */
  aiSummary?: string;
  /** Historical headline without an AI summary. */
  archiveOnly?: boolean;
  mentions?: string[];
  /** Opinion items explicitly reserved for the ANDERS W. topic. */
  andersOnly?: boolean;
  imageUrl?: string;
  why: string;
  verification: Verification;
  verificationText: string;
  neutrality: Neutrality;
  sources: { label: string; url: string; title?: string; method?: "RSS" | "WEB" }[];
};

export const demoStories: Story[] = [
  {
    id: "demo-1",
    category: "AI/Tech",
    title: "Live-nyhedsfeed kunne ikke indlæses",
    sourceLabel: "KONTEKST",
    published: "Nu",
    publishedAt: new Date().toISOString(),
    publishedDate: new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date()),
    sourceMethod: "WEB",
    summary:
      "Siden kunne ikke hente det eksterne nyhedsfeed i denne kørsel. Den forsøger automatisk igen ved næste opdatering.",
    why:
      "Fallback-kortet gør, at siden stadig virker, hvis en ekstern nyhedskilde midlertidigt er utilgængelig.",
    verification: "unverified",
    verificationText:
      "Ingen ekstern historie er vist i dette fallback-kort.",
    neutrality: {
      wording: 100,
      wordingNote: "Fallback-tekst uden vurderende nyhedsformuleringer.",
      wordingExamples: [],
      sources: null,
      sourcesNote: "Ingen ekstern nyhed at sammenligne med andre kilder.",
      sourcesExamples: []
    },
    sources: [
      {
        label: "Projektets GitHub",
        url: "https://github.com/AndersTheNinja/Dansk-AI-nyhedsplatform-med-verificering-kontekst-og-kildekrydstjek"
      }
    ]
  }
];


/** Match actual editorial text and unambiguous references to the Aarhus mayor. */
export function mentionsAndersWinnerskjold(...parts: (string | undefined | null)[]): boolean {
  const text = parts.filter(Boolean).join(" ").normalize("NFKC")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/[\u00ad\u200b]/g, "").replace(/[-‐‑–—_]/g, " ");
  return /\bwinners(?:kjold|kiold)s?\b/iu.test(text)
    || /\b(?:aarhus(?:s|')?\s+borgmester(?:en)?|borgmester(?:en)?\s+(?:i|for)\s+aarhus|aarhusborgmester(?:en)?)\b/iu.test(text)
    || /\bborgmester(?:en)?\s+anders\s+w\b/iu.test(text);
}

export function isAndersWinnerskjoldStory(story: Story): boolean {
  const lead = story.sources?.[0];
  return !!story.mentions?.includes("anders-winnerskjold") ||
    mentionsAndersWinnerskjold(story.title, story.summary, story.aiSummary, lead?.title, lead?.url);
}
