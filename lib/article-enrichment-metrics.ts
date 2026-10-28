// Measures the article-page enrichment pass, before saved archive repair and
// picture lookup. No URLs or article text are written to telemetry.
type Lead = { lead: { source: string; description: string } };
const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

export function measureArticleEnrichment(
  before: Lead[], after: Lead[], attempted: number, minimumWords = 25
) {
  const publishers = new Map<string, { beforeShort: number; resolved: number; expanded: number }>();
  let beforeShort = 0, afterShort = 0, resolved = 0, expanded = 0, changed = 0;
  const examined = Math.min(before.length, after.length);
  for (let i = 0; i < examined; i++) {
    const original = before[i].lead;
    const updated = after[i].lead;
    const initial = words(original.description);
    const final = words(updated.description);
    const wasShort = initial < minimumWords;
    const isShort = final < minimumWords;
    if (wasShort) beforeShort++;
    if (isShort) afterShort++;
    if (final > initial) changed++;
    if (!wasShort) continue;
    const source = original.source || "Ukendt";
    const row = publishers.get(source) || { beforeShort: 0, resolved: 0, expanded: 0 };
    row.beforeShort++;
    if (!isShort) { resolved++; row.resolved++; }
    // Also count meaningful progress that does not yet pass the 25-word threshold.
    if (final >= initial + 5) { expanded++; row.expanded++; }
    publishers.set(source, row);
  }
  return {
    examined, attempted,
    beforeShort, afterShort, resolved, expanded,
    stillShort: beforeShort - resolved,
    anyTextExpanded: changed,
    resolvedPct: beforeShort ? Math.round(100 * resolved / beforeShort) : 0,
    // Bounded per-publisher evidence; never log the article text itself.
    publishers: [...publishers].sort((a,b)=>b[1].beforeShort-a[1].beforeShort)
      .slice(0,15).map(([source, values])=>({source,...values}))
  };
}
