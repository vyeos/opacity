import type { EnrichedSignal, NotificationTarget } from "../shared/types.js";

export interface Notifier {
  notify(signal: EnrichedSignal, target: NotificationTarget): Promise<void>;
}

function formatSignal(signal: EnrichedSignal): string {
  return [
    `[${signal.event.source.toUpperCase()}] ${signal.event.title}`,
    `Author: ${signal.event.author}`,
    `Score: ${signal.analysis.actionabilityScore} | Urgency: ${signal.analysis.urgency}`,
    `Summary: ${signal.analysis.summary}`,
    `How to use: ${signal.analysis.howToUse.join("; ")}`,
    `Link: ${signal.event.url}`
  ].join("\n");
}

export class ConsoleNotifier implements Notifier {
  async notify(signal: EnrichedSignal, target: NotificationTarget): Promise<void> {
    const payload = formatSignal(signal);

    if (target.menubar) {
      console.log("\n[Menubar Inbox]\n" + payload);
    }

    if (target.telegram) {
      console.log("\n[Telegram Delivery]\n" + payload);
    }
  }
}
