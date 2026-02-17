import { OpenAICompatibleAnalyzer } from "./analysis/analyzer.js";
import { collectAllSignals } from "./collectors/index.js";
import { MultiNotifier, ConsoleNotifier, TelegramNotifier } from "./notifier/notifier.js";
import { routeSignal } from "./processor/router.js";
import { loadConfig } from "./shared/config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const analyzer = new OpenAICompatibleAnalyzer(config);
  const notifier = new MultiNotifier([new ConsoleNotifier(), new TelegramNotifier(config)]);

  const signals = await collectAllSignals(config);
  for (const event of signals) {
    const analysis = await analyzer.analyze(event);
    const enriched = { event, analysis };
    const target = routeSignal(enriched, config);
    await notifier.notify(enriched, target);
  }

  if (signals.length === 0) {
    console.log("No signals collected. Add RSS feeds or enable mock social collectors.");
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error in pipeline", error);
  process.exitCode = 1;
});
