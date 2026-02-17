import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { AppConfig } from "../shared/config.js";
import type { SourceKind } from "../shared/types.js";
import { createStore } from "../storage/index.js";

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      chat?: { id?: number };
      text?: string;
    };
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, code: number, payload: unknown): void {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function parseSource(data: string): SourceKind | null {
  const source = data.split(":")[1];
  if (source === "youtube" || source === "x" || source === "rss" || source === "github") {
    return source;
  }
  return null;
}

async function sendBotRequest(config: AppConfig, method: string, payload: unknown): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function startTelegramWebhookServer(config: AppConfig): Promise<void> {
  const store = createStore(config);
  await store.init();

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method !== "POST" || req.url !== "/telegram/webhook") {
      json(res, 404, { error: "Not found" });
      return;
    }

    if (config.TELEGRAM_WEBHOOK_SECRET) {
      const token = req.headers["x-telegram-bot-api-secret-token"];
      if (token !== config.TELEGRAM_WEBHOOK_SECRET) {
        json(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    try {
      const body = await readBody(req);
      const update = JSON.parse(body) as TelegramUpdate;
      const callback = update.callback_query;

      if (!callback?.id || !callback.data) {
        json(res, 200, { ok: true });
        return;
      }

      if (callback.data.startsWith("mute:")) {
        const source = parseSource(callback.data);
        if (source) {
          await store.muteSource(source);

          await sendBotRequest(config, "answerCallbackQuery", {
            callback_query_id: callback.id,
            text: `Muted source: ${source}`,
            show_alert: false
          });
        }
      }

      if (callback.data.startsWith("explain:")) {
        const eventId = callback.data.split(":")[1];
        const chatId = callback.message?.chat?.id;
        if (chatId && eventId) {
          const explainText =
            (await store.getSignalExplain(eventId)) ??
            "No stored analysis found for this event yet. Try again after the event is processed.";
          await sendBotRequest(config, "sendMessage", {
            chat_id: chatId,
            text: explainText
          });
        }

        await sendBotRequest(config, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Sent detailed breakdown",
          show_alert: false
        });
      }

      json(res, 200, { ok: true });
    } catch (error) {
      console.error("Webhook handler error", error);
      json(res, 500, { error: "Webhook handler failed" });
    }
  });

  server.listen(config.TELEGRAM_WEBHOOK_PORT, () => {
    console.log(`Telegram webhook server listening on :${config.TELEGRAM_WEBHOOK_PORT}`);
  });
}
