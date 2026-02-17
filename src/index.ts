import { OpenAICompatibleAnalyzer } from "./analysis/analyzer.js";
import { collectAllSignals } from "./collectors/index.js";
import { ConsoleNotifier, MultiNotifier, TelegramNotifier } from "./notifier/notifier.js";
import { routeSignal } from "./processor/router.js";
import { loadConfig } from "./shared/config.js";
import { StateStore } from "./state/store.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const analyzer = new OpenAICompatibleAnalyzer(config);
  const notifier = new MultiNotifier([new ConsoleNotifier(), new TelegramNotifier(config)]);
  const stateStore = new StateStore(config.STATE_FILE);

  if (!config.ENABLE_AI_ANALYSIS) {
    console.log("AI analysis disabled. Using local heuristic summaries only.");
  }

  let state = await stateStore.load();

  const rawSignals = await collectAllSignals(config);
  const signals = rawSignals.filter(
    (event) => !state.mutedSources.includes(event.source) && !state.seenEventIds.includes(event.id)
  );

  for (const event of signals) {
    const analysis = await analyzer.analyze(event);
    const enriched = { event, analysis };
    const target = routeSignal(enriched, config);
    await notifier.notify(enriched, target);
    state = await stateStore.appendSeenEvent(state, event.id);
  }

  if (rawSignals.length === 0) {
    console.log("No signals collected. Add RSS feeds or enable mock social collectors.");
    return;
  }

  if (signals.length === 0) {
    console.log("No new signals after dedup/mute filtering.");
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error in pipeline", error);
  process.exitCode = 1;
});
