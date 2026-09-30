export type Verification = "confirmed" | "nuance" | "unverified";

export type Story = {
  id: string;
  category: "AI/Tech" | "Erhverv" | "Danmark" | "Aarhus";
  title: string;
  sourceLabel: string;
  published: string;
  summary: string;
  why: string;
  verification: Verification;
  verificationText: string;
  sources: { label: string; url: string }[];
};

export const stories: Story[] = [
  {
    id: "1",
    category: "AI/Tech",
    title: "AI-agenter rykker fra demo til daglige arbejdsgange",
    sourceLabel: "KONTEKST demo",
    published: "I dag",
    summary:
      "Flere virksomheder flytter AI fra enkeltstående chatbots til agenter, der kan udføre flertrinsopgaver på tværs af systemer. I MVP'en bruges denne historie som eksempel på, hvordan flere kilder kan samles til én nyhed.",
    why:
      "Det ændrer AI fra et skriveværktøj til et driftslag og kan skabe nye software- og serviceforretninger.",
    verification: "confirmed",
    verificationText:
      "Demoindhold. Produktionsversionen skal koble hver konkret påstand til primærkilder og mindst én uafhængig kilde.",
    sources: [
      { label: "OpenAI", url: "https://openai.com/" },
      { label: "EU Digital Strategy", url: "https://digital-strategy.ec.europa.eu/" }
    ]
  },
  {
    id: "2",
    category: "Erhverv",
    title: "Fra overskrift til signal: samme historie skal kun vises én gang",
    sourceLabel: "KONTEKST demo",
    published: "I dag",
    summary:
      "MVP'en demonstrerer principperne bag story clustering: flere artikler om den samme begivenhed bliver samlet i ét kort med fælles kontekst og flere kilder i stedet for at fylde feedet med dubletter.",
    why:
      "Det gør feedet hurtigere at scanne og giver plads til det, der faktisk er nyt i historien.",
    verification: "confirmed",
    verificationText:
      "Dette er en produktfunktion i prototypen, ikke en ekstern nyhedspåstand.",
    sources: [{ label: "Projektets GitHub", url: "https://github.com/AndersTheNinja/Dansk-AI-nyhedsplatform-med-verificering-kontekst-og-kildekrydstjek" }]
  },
  {
    id: "3",
    category: "Aarhus",
    title: "Lokale historier kan få samme kildekrydstjek som landsdækkende nyheder",
    sourceLabel: "KONTEKST demo",
    published: "I dag",
    summary:
      "Aarhus er tænkt som selvstændigt spor fra første version. Målet er at kombinere lokale medier med kommunale dagsordener, pressemeddelelser, udbud og andre primærkilder.",
    why:
      "Lokale historier har ofte færre sekundære kilder, så synlig kildeangivelse og usikkerhed bliver ekstra vigtig.",
    verification: "nuance",
    verificationText:
      "Konceptet er klart, men den automatiske kildeindsamling er endnu ikke koblet på i denne første kodeversion.",
    sources: [{ label: "Aarhus Kommune", url: "https://aarhus.dk/" }]
  }
];
