import type { AppConfig } from "../shared/config.js";
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
    `Good: ${signal.analysis.whatIsGood.join("; ")}`,
    `Bad: ${signal.analysis.whatIsBad.join("; ")}`,
    `How to use: ${signal.analysis.howToUse.join("; ")}`,
    `Where to use: ${signal.analysis.whereToUse.join("; ")}`,
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

export class TelegramNotifier implements Notifier {
  constructor(private readonly config: AppConfig) {}

  async notify(signal: EnrichedSignal, target: NotificationTarget): Promise<void> {
    if (!target.telegram) return;
    if (!this.config.TELEGRAM_BOT_TOKEN || !this.config.TELEGRAM_CHAT_ID) return;

    const response = await fetch(`https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: this.config.TELEGRAM_CHAT_ID,
        text: formatSignal(signal),
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "Open source", url: signal.event.url }],
            [
              { text: "Why this matters", callback_data: `explain:${signal.event.id}` },
              { text: "Mute source", callback_data: `mute:${signal.event.source}` }
            ]
          ]
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`Telegram send failed (${response.status}) for signal ${signal.event.id}: ${body}`);
    }
  }
}

export class MultiNotifier implements Notifier {
  constructor(private readonly notifiers: Notifier[]) {}

  async notify(signal: EnrichedSignal, target: NotificationTarget): Promise<void> {
    await Promise.all(this.notifiers.map((notifier) => notifier.notify(signal, target)));
  }
}
