import type { AppConfig } from "../shared/config.js";
import type { EnrichedSignal, NotificationTarget } from "../shared/types.js";

export function routeSignal(signal: EnrichedSignal, config: AppConfig): NotificationTarget {
  if (!config.ENABLE_AI_ANALYSIS) {
    return {
      menubar: true,
      telegram: true
    };
  }

  const score = signal.analysis.actionabilityScore;
  const urgent = signal.analysis.urgency === "now" && score >= config.PRIORITY_THRESHOLD;
  const important = score >= config.HOURLY_THRESHOLD;

  return {
    menubar: true,
    telegram: urgent || important
  };
}
