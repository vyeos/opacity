import type { SignalEvent } from "../shared/types.js";

interface Collector {
  collect(): Promise<SignalEvent[]>;
}

function makeId(prefix: string, n: number): string {
  return `${prefix}-${Date.now()}-${n}`;
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

export async function collectMockXSignals(): Promise<SignalEvent[]> {
  const collectors: Collector[] = [new MockXCollector()];
  const batches = await Promise.all(collectors.map((collector) => collector.collect()));
  return batches.flat();
}
