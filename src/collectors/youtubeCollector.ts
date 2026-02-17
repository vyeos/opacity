import { createHash } from "node:crypto";

import type { AppConfig } from "../shared/config.js";
import type { SignalEvent } from "../shared/types.js";

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(value: string): string {
  return decodeXmlEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function getTagValue(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? stripTags(match[1]) : "";
}

function getLink(entry: string): string {
  const hrefMatch = entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return hrefMatch ? decodeXmlEntities(hrefMatch[1]) : "";
}

function buildId(link: string, publishedAt: string): string {
  return createHash("sha256").update(`${link}:${publishedAt}`).digest("hex").slice(0, 16);
}

export class YouTubeCollector {
  constructor(private readonly config: AppConfig) {}

  async collect(): Promise<SignalEvent[]> {
    if (this.config.YOUTUBE_CHANNEL_IDS.length === 0) {
      return [];
    }

    const batches = await Promise.all(
      this.config.YOUTUBE_CHANNEL_IDS.map(async (channelId) => {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
        try {
          const response = await fetch(feedUrl, {
            headers: { "user-agent": "opacity-bot/0.1" }
          });

          if (!response.ok) {
            console.warn(`YouTube feed fetch failed (${response.status}) for channel ${channelId}`);
            return [];
          }

          const xml = await response.text();
          const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

          return entries.slice(0, this.config.YOUTUBE_MAX_ITEMS).map((entry) => {
            const title = getTagValue(entry, "title") || "Untitled video";
            const url = getLink(entry) || "https://youtube.com";
            const author = getTagValue(entry, "name") || "Unknown channel";
            const snippet = getTagValue(entry, "media:description") || "No description available.";
            const publishedAt = getTagValue(entry, "published") || getTagValue(entry, "updated") || new Date().toISOString();

            return {
              id: `yt-${buildId(url, publishedAt)}`,
              source: "youtube" as const,
              author,
              title,
              url,
              contentSnippet: snippet.slice(0, 500),
              publishedAt,
              tags: ["youtube"]
            };
          });
        } catch (error) {
          console.warn(`YouTube feed fetch error for channel ${channelId}`, error);
          return [];
        }
      })
    );

    return batches.flat();
  }
}
