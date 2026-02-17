import type { AppConfig } from "../shared/config.js";
import type { EnrichedSignal, NotificationTarget } from "../shared/types.js";

export function routeSignal(signal: EnrichedSignal, config: AppConfig): NotificationTarget {
  const telegramEnabled = config.ENABLE_TELEGRAM_DELIVERY;

  if (!config.ENABLE_AI_ANALYSIS) {
    return {
      menubar: true,
      telegram: telegramEnabled
    };
  }

  const score = signal.analysis.actionabilityScore;
  const urgent = signal.analysis.urgency === "now" && score >= config.PRIORITY_THRESHOLD;
  const important = score >= config.HOURLY_THRESHOLD;

  return {
    menubar: true,
    telegram: telegramEnabled && (urgent || important)
  };
}
