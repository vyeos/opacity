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

function getAtomLink(entry: string): string {
  const hrefMatch = entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch) return decodeXmlEntities(hrefMatch[1]);
  return getTagValue(entry, "link");
}

function buildId(link: string, publishedAt: string): string {
  return createHash("sha256").update(`${link}:${publishedAt}`).digest("hex").slice(0, 16);
}

function parseRssItems(xml: string, sourceUrl: string, maxItems: number): SignalEvent[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.slice(0, maxItems).map((block) => {
    const title = getTagValue(block, "title") || "Untitled RSS item";
    const link = getTagValue(block, "link") || sourceUrl;
    const author = getTagValue(block, "dc:creator") || getTagValue(block, "author") || "Unknown author";
    const description =
      getTagValue(block, "description") || getTagValue(block, "content:encoded") || "No summary available.";
    const publishedAt = getTagValue(block, "pubDate") || new Date().toISOString();

    return {
      id: `rss-${buildId(link, publishedAt)}`,
      source: "rss",
      author,
      title,
      url: link,
      contentSnippet: description.slice(0, 400),
      publishedAt,
      tags: ["rss"]
    };
  });
}

function parseAtomEntries(xml: string, sourceUrl: string, maxItems: number): SignalEvent[] {
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  return entryBlocks.slice(0, maxItems).map((block) => {
    const title = getTagValue(block, "title") || "Untitled Atom entry";
    const link = getAtomLink(block) || sourceUrl;
    const author = getTagValue(block, "name") || getTagValue(block, "author") || "Unknown author";
    const description = getTagValue(block, "summary") || getTagValue(block, "content") || "No summary available.";
    const publishedAt = getTagValue(block, "updated") || getTagValue(block, "published") || new Date().toISOString();

    return {
      id: `rss-${buildId(link, publishedAt)}`,
      source: "rss",
      author,
      title,
      url: link,
      contentSnippet: description.slice(0, 400),
      publishedAt,
      tags: ["atom"]
    };
  });
}

export class RssCollector {
  constructor(private readonly config: AppConfig) {}

  async collect(): Promise<SignalEvent[]> {
    if (this.config.RSS_FEEDS.length === 0) {
      return [];
    }

    const batches = await Promise.all(
      this.config.RSS_FEEDS.map(async (feedUrl) => {
        try {
          const response = await fetch(feedUrl, {
            headers: {
              "user-agent": "opacity-bot/0.1"
            }
          });

          if (!response.ok) {
            console.warn(`RSS fetch failed (${response.status}) for ${feedUrl}`);
            return [];
          }

          const xml = await response.text();
          const items = parseRssItems(xml, feedUrl, this.config.RSS_MAX_ITEMS);
          if (items.length > 0) return items;
          return parseAtomEntries(xml, feedUrl, this.config.RSS_MAX_ITEMS);
        } catch (error) {
          console.warn(`RSS fetch error for ${feedUrl}`, error);
          return [];
        }
      })
    );

    return batches.flat();
  }
}
