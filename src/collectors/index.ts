import type { AppConfig } from "../shared/config.js";
import type { SignalEvent } from "../shared/types.js";
import { collectMockXSignals } from "./mockSocialCollectors.js";
import { RssCollector } from "./rssCollector.js";
import { XCollector } from "./xCollector.js";
import { YouTubeCollector } from "./youtubeCollector.js";

export async function collectAllSignals(config: AppConfig): Promise<SignalEvent[]> {
  const xSignals = await new XCollector(config).collect();

  const batches = await Promise.all([
    new RssCollector(config).collect(),
    new YouTubeCollector(config).collect(),
    Promise.resolve(xSignals),
    config.ENABLE_MOCK_X === true && xSignals.length === 0 ? collectMockXSignals() : Promise.resolve([])
  ]);

  const events = batches.flat();
  const deduped = new Map(events.map((event) => [event.id, event]));
  return Array.from(deduped.values());
}
