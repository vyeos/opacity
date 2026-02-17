import { OpenAICompatibleAnalyzer } from "./analysis/analyzer.js";
import { collectAllSignals } from "./collectors/index.js";
import { ConsoleNotifier, MultiNotifier, TelegramNotifier } from "./notifier/notifier.js";
import { routeSignal } from "./processor/router.js";
import { loadConfig } from "./shared/config.js";
import { SqliteStore } from "./storage/sqliteStore.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const analyzer = new OpenAICompatibleAnalyzer(config);
  const notifier = new MultiNotifier([new ConsoleNotifier(), new TelegramNotifier(config)]);
  const store = new SqliteStore(config.SQLITE_DB_PATH);
  await store.init();

  try {
    if (!config.ENABLE_AI_ANALYSIS) {
      console.log("AI analysis disabled. Using local heuristic summaries only.");
    }

    const mutedSources = await store.getMutedSources();

    const rawSignals = await collectAllSignals(config);
    const unseenSignals = await Promise.all(
      rawSignals.map(async (event) => ({ event, seen: await store.hasSignal(event.id) }))
    );
    const signals = unseenSignals
      .filter(({ event, seen }) => !seen && !mutedSources.includes(event.source))
      .map(({ event }) => event);

    for (const event of signals) {
      const analysis = await analyzer.analyze(event);
      const enriched = { event, analysis };
      await store.saveEnrichedSignal(enriched);

      const target = routeSignal(enriched, config);
      const attempts = await notifier.notify(enriched, target);
      await store.recordDeliveries(event.id, attempts);
    }

    if (rawSignals.length === 0) {
      console.log("No signals collected. Add RSS feeds or enable mock social collectors.");
      return;
    }

    if (signals.length === 0) {
      console.log("No new signals after dedup/mute filtering.");
    }
  } finally {
    store.close();
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error in pipeline", error);
  process.exitCode = 1;
});
