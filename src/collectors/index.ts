import type { AppConfig } from "../shared/config.js";
import type { SignalEvent } from "../shared/types.js";
import { RssCollector } from "./rssCollector.js";
import { XCollector } from "./xCollector.js";
import { YouTubeCollector } from "./youtubeCollector.js";

export async function collectAllSignals(config: AppConfig): Promise<SignalEvent[]> {
  const xSignals = config.ENABLE_X_COLLECTION ? await new XCollector(config).collect() : [];

  const batches = await Promise.all([
    new RssCollector(config).collect(),
    new YouTubeCollector(config).collect(),
    Promise.resolve(xSignals)
  ]);

  const events = batches.flat();
  const deduped = new Map(events.map((event) => [event.id, event]));
  return Array.from(deduped.values());
}
