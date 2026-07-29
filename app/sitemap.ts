import type { MetadataRoute } from "next";
import { getAllDates, getAllTags } from "@/lib/news";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const dates = getAllDates();
  const tags = getAllTags();

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...dates.map((date) => ({
      url: `${SITE_URL}/archive/${date}`,
      lastModified: new Date(`${date}T00:00:00+08:00`),
      changeFrequency: "never" as const,
      priority: 0.6,
    })),
    ...tags.slice(0, 200).map(({ tag }) => ({
      url: `${SITE_URL}/tag/${encodeURIComponent(tag)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
