import type { SignalEvent } from "../shared/types.js";

interface Collector {
  collect(): Promise<SignalEvent[]>;
}

function makeId(prefix: string, n: number): string {
  return `${prefix}-${Date.now()}-${n}`;
}

export class MockYouTubeCollector implements Collector {
  async collect(): Promise<SignalEvent[]> {
    return [
      {
        id: makeId("yt", 1),
        source: "youtube",
        author: "Fireship",
        title: "New AI coding model released",
        url: "https://youtube.com/watch?v=example1",
        contentSnippet: "A rapid walkthrough of a newly released model and tooling impacts.",
        publishedAt: new Date().toISOString(),
        tags: ["ai", "devtools"]
      }
    ];
  }
}

export class MockXCollector implements Collector {
  async collect(): Promise<SignalEvent[]> {
    return [
      {
        id: makeId("x", 1),
        source: "x",
        author: "@vercel",
        title: "We are shipping new edge runtime updates",
        url: "https://x.com/vercel/status/example2",
        contentSnippet: "Lower cold start, better observability, and new deployment controls.",
        publishedAt: new Date().toISOString(),
        tags: ["web", "infra"]
      }
    ];
  }
}

export class MockRssCollector implements Collector {
  async collect(): Promise<SignalEvent[]> {
    return [
      {
        id: makeId("rss", 1),
        source: "rss",
        author: "OpenAI News",
        title: "API update: new structured outputs",
        url: "https://example.com/openai-news",
        contentSnippet: "Developers can now enforce schema-constrained responses.",
        publishedAt: new Date().toISOString(),
        tags: ["api", "ai"]
      }
    ];
  }
}

export async function collectAllSignals(): Promise<SignalEvent[]> {
  const collectors: Collector[] = [new MockYouTubeCollector(), new MockXCollector(), new MockRssCollector()];
  const batches = await Promise.all(collectors.map((collector) => collector.collect()));
  return batches.flat();
}
