import { getAllDates, getNewsByDate } from "@/lib/news";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  // 取最近 7 天的条目汇入 RSS
  const items = getAllDates()
    .slice(0, 7)
    .flatMap((date) => getNewsByDate(date)?.items ?? []);

  const entries = items
    .map((item) => {
      const title = item.title_zh || item.title;
      const desc = [item.summary_zh, item.why_it_matters && `为什么重要：${item.why_it_matters}`]
        .filter(Boolean)
        .join("\n");
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <pubDate>${new Date(item.published_at).toUTCString()}</pubDate>
      <source url="${escapeXml(SITE_URL)}">${escapeXml(item.source)}</source>
      <category>${escapeXml(item.category)}</category>
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${entries}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
