import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://xn--l-4ga.dk",
    changeFrequency: "hourly",
    priority: 1
  }];
}
