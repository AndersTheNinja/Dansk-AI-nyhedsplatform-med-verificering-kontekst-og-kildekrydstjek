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
  publishedDate?: string;
  sourceMethod?: "RSS" | "WEB";
  summary: string;
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
