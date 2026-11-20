import type { MetadataRoute } from "next";
import { databaseRpc } from "@/lib/database-rpc";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://xn--l-4ga.dk";
  let count = 0;
  try {
    const response = await databaseRpc("oeldk_archive_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_limit: 1, p_offset: 0 }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store"
    });
    if (response.ok) {
      const data = await response.json();
      count = Math.max(0, Math.min(20000, Number(data?.totalCount) || 0));
    }
  } catch (error) {
    console.warn("Sitemap archive count unavailable", String(error));
  }

  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: base + "/arkiv", changeFrequency: "daily", priority: 0.8 },
    ...Array.from({ length: Math.max(0, Math.ceil(count / 100) - 1) }, (_, index) => ({
      url: base + "/arkiv?side=" + (index + 2),
      changeFrequency: "daily" as const,
      priority: 0.5
    }))
  ];
}
