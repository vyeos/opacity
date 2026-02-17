import type { AppConfig } from "../shared/config.js";
import type { DeliveryAttempt, EnrichedSignal, NotificationTarget } from "../shared/types.js";

export interface Notifier {
  notify(signal: EnrichedSignal, target: NotificationTarget): Promise<DeliveryAttempt[]>;
}

function formatSignal(signal: EnrichedSignal, includeAnalysis: boolean): string {
  if (!includeAnalysis) {
    return [
      `Title: ${signal.event.title}`,
      `Description: ${signal.event.contentSnippet || "No description available."}`,
      `Source: ${signal.event.source}`,
      `Link: ${signal.event.url}`
    ].join("\n");
  }

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
  constructor(private readonly config: AppConfig) {}

  async notify(signal: EnrichedSignal, target: NotificationTarget): Promise<DeliveryAttempt[]> {
    const payload = formatSignal(signal, this.config.ENABLE_AI_ANALYSIS);
    const attempts: DeliveryAttempt[] = [];

    if (target.menubar) {
      console.log("\n[Menubar Inbox]\n" + payload);
      attempts.push({ channel: "menubar", status: "sent" });
    } else {
      attempts.push({ channel: "menubar", status: "skipped" });
    }

    if (target.telegram) {
      console.log("\n[Telegram Delivery]\n" + payload);
    }

    return attempts;
  }
}

export class TelegramNotifier implements Notifier {
  constructor(private readonly config: AppConfig) {}

  async notify(signal: EnrichedSignal, target: NotificationTarget): Promise<DeliveryAttempt[]> {
    if (!target.telegram) return [{ channel: "telegram", status: "skipped" }];
    if (!this.config.TELEGRAM_BOT_TOKEN || !this.config.TELEGRAM_CHAT_ID) {
      return [{ channel: "telegram", status: "skipped" }];
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: this.config.TELEGRAM_CHAT_ID,
          text: formatSignal(signal, this.config.ENABLE_AI_ANALYSIS),
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Open source", url: signal.event.url }],
              this.config.ENABLE_AI_ANALYSIS
                ? [
                    { text: "Why this matters", callback_data: `explain:${signal.event.id}` },
                    { text: "Mute source", callback_data: `mute:${signal.event.source}` }
                  ]
                : [{ text: "Mute source", callback_data: `mute:${signal.event.source}` }]
            ]
          }
        })
      });

      if (!response.ok) {
        const body = await response.text();
        console.warn(`Telegram send failed (${response.status}) for signal ${signal.event.id}: ${body}`);
        return [{ channel: "telegram", status: "failed", errorMessage: `HTTP ${response.status}: ${body}` }];
      }

      return [{ channel: "telegram", status: "sent" }];
    } catch (error) {
      console.warn(`Telegram send error for signal ${signal.event.id}`, error);
      const message = error instanceof Error ? error.message : "unknown error";
      return [{ channel: "telegram", status: "failed", errorMessage: message }];
    }
  }
}

export class MultiNotifier implements Notifier {
  constructor(private readonly notifiers: Notifier[]) {}

  async notify(signal: EnrichedSignal, target: NotificationTarget): Promise<DeliveryAttempt[]> {
    const results = await Promise.all(this.notifiers.map((notifier) => notifier.notify(signal, target)));
    return results.flat();
  }
}
