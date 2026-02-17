import { MockAnalyzer } from "./analysis/analyzer.js";
import { collectAllSignals } from "./collectors/mockCollectors.js";
import { ConsoleNotifier } from "./notifier/notifier.js";
import { routeSignal } from "./processor/router.js";
import { loadConfig } from "./shared/config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const analyzer = new MockAnalyzer();
  const notifier = new ConsoleNotifier();

  const signals = await collectAllSignals();
  for (const event of signals) {
    const analysis = await analyzer.analyze(event);
    const enriched = { event, analysis };
    const target = routeSignal(enriched, config);
    await notifier.notify(enriched, target);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error in pipeline", error);
  process.exitCode = 1;
});
