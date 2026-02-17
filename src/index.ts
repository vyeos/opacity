import { OpenAICompatibleAnalyzer } from "./analysis/analyzer.js";
import { collectAllSignals } from "./collectors/index.js";
import { ConsoleNotifier, MultiNotifier, TelegramNotifier } from "./notifier/notifier.js";
import { routeSignal } from "./processor/router.js";
import { loadConfig } from "./shared/config.js";
import { createStore } from "./storage/index.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle(config: ReturnType<typeof loadConfig>): Promise<void> {
  const analyzer = new OpenAICompatibleAnalyzer(config);
  const notifier = new MultiNotifier([new ConsoleNotifier(config), new TelegramNotifier(config)]);
  const store = createStore(config);
  await store.init();

  try {
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
      console.log("No signals collected. Add RSS feeds, YouTube channels, or enable X collection.");
      return;
    }

    if (signals.length === 0) {
      console.log("No new signals after dedup/mute filtering.");
    }
  } finally {
    await store.close();
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  let stopRequested = false;

  process.once("SIGINT", () => {
    stopRequested = true;
  });
  process.once("SIGTERM", () => {
    stopRequested = true;
  });

  if (!config.ENABLE_AI_ANALYSIS) {
    console.log("AI analysis disabled. Sending raw signal fields only.");
  }

  if (config.RUN_CONTINUOUS) {
    console.log(`Worker running in continuous mode. Interval: ${config.RUN_INTERVAL_MINUTES} minute(s).`);
  }

  do {
    try {
      await runCycle(config);
    } catch (error) {
      console.error("Worker cycle failed", error);
      if (!config.RUN_CONTINUOUS) {
        throw error;
      }
    }

    if (!config.RUN_CONTINUOUS || stopRequested) {
      break;
    }

    await sleep(config.RUN_INTERVAL_MINUTES * 60_000);
  } while (!stopRequested);
}

main().catch((error: unknown) => {
  console.error("Fatal error in pipeline", error);
  process.exitCode = 1;
});
