import type { AppConfig } from "../shared/config.js";
import type { SignalEvent } from "../shared/types.js";
import { collectMockSocialSignals } from "./mockSocialCollectors.js";
import { RssCollector } from "./rssCollector.js";

export async function collectAllSignals(config: AppConfig): Promise<SignalEvent[]> {
  const batches = await Promise.all([
    new RssCollector(config).collect(),
    config.ENABLE_MOCK_SOCIAL === true ? collectMockSocialSignals() : Promise.resolve([])
  ]);

  const events = batches.flat();
  const deduped = new Map(events.map((event) => [event.id, event]));
  return Array.from(deduped.values());
}
