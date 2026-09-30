# KONTEKST — dansk AI-nyhedsplatform

KONTEKST er en offentlig MVP for en dansk nyhedsplatform, hvor AI ikke bare opsummerer historier, men også viser:

- kildekrydstjek
- primærkilder
- usikkerheder og nuancer
- hvorfor historien er relevant
- flere kilder samlet omkring samme begivenhed

## Status

Første kodeversion er en fungerende Next.js-prototype med mobilvenligt feed, kategorier, AI CHECK-status og kildevisning.

Nyhedsindsamling, automatisk clustering, database og fuld AI-verificering kommer i næste iteration.

## Kør lokalt

```bash
npm install
npm run dev
```

Åbn derefter `http://localhost:3000`.

## AI-analyse

Kopiér `.env.example` til `.env.local` og udfyld:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

API-routen `/api/analyze` er klargjort til server-side analyse. API-nøgler må aldrig commits til GitHub.

## Redaktionelt princip

AI må ikke opfinde sikkerhed. En historie kan være:

- ✅ Bekræftet
- ⚠️ Kræver nuance
- ❓ Ikke tilstrækkeligt verificeret

Produktionsversionen skal så vidt muligt knytte centrale påstande til en primærkilde og mindst én uafhængig kilde.

## Ophavsret

Målet er ikke at genudgive komplette artikler fra danske medier. Platformen skal primært arbejde med links, metadata, korte uddrag hvor lovligt, egne resuméer og selvstændig analyse baseret på underliggende fakta og kilder.

## Roadmap

1. Rigtige nyhedsfeeds og kildeadapters
2. Story clustering / dubletfjernelse
3. Automatisk claim extraction
4. Primærkildesøgning og evidensmatrix
5. AI CHECK med citationsspor
6. "Hvad er nyt siden sidst?"
7. Brugerprofiler, alerts og betalingslag

---

Bygges åbent på GitHub.
